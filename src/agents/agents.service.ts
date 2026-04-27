/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AgentProfile,
  AgentVerificationStatus,
} from './entities/agent-profile.entity';
import { User, UserRole } from '../users/entities/user.entity';
import {
  UpdateAgentProfileDto,
  VerifyAgentDto,
  AgentFilterDto,
} from './dto/agent.dto';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(AgentProfile)
    private agentProfileRepository: Repository<AgentProfile>,
  ) {}

  async findAll(filters: AgentFilterDto) {
    const { verificationStatus, page = 1, limit = 20 } = filters;

    const qb = this.agentProfileRepository
      .createQueryBuilder('agent')
      .leftJoinAndSelect('agent.user', 'user')
      .orderBy('agent.rating', 'DESC')
      .addOrderBy('agent.totalCompletedDeals', 'DESC');

    if (verificationStatus) {
      qb.where('agent.verificationStatus = :verificationStatus', {
        verificationStatus,
      });
    } else {
      // Public listing only shows verified agents
      qb.where('agent.verificationStatus = :status', {
        status: AgentVerificationStatus.VERIFIED,
      });
    }

    const skip = (page - 1) * limit;
    const [agents, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: agents.map((a) => this.toPublicFormat(a)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const agent = await this.agentProfileRepository.findOne({
      where: { id },
      relations: ['user', 'houseAssignments', 'houseAssignments.house'],
    });
    if (!agent) throw new NotFoundException('Agent not found');
    return this.toPublicFormat(agent);
  }

  async getMyProfile(userId: string) {
    const agent = await this.agentProfileRepository.findOne({
      where: { userId },
      relations: ['user', 'houseAssignments', 'houseAssignments.house'],
    });
    if (!agent) throw new NotFoundException('Agent profile not found');
    return agent;
  }

  async updateProfile(
    userId: string,
    dto: UpdateAgentProfileDto,
    requestingUser: User,
  ) {
    const agent = await this.agentProfileRepository.findOne({
      where: { userId },
    });
    if (!agent) throw new NotFoundException('Agent profile not found');

    if (agent.userId !== requestingUser.id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    Object.assign(agent, dto);

    // If agent uploads documents, move to pending verification
    if (
      (dto.nationalIdUrl || dto.licenseDocUrl) &&
      agent.verificationStatus === AgentVerificationStatus.REJECTED
    ) {
      agent.verificationStatus = AgentVerificationStatus.PENDING;
      agent.rejectionReason = null as any;
    }

    return this.agentProfileRepository.save(agent);
  }

  async getPendingVerification(admin: User) {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
    return this.agentProfileRepository.find({
      where: { verificationStatus: AgentVerificationStatus.PENDING },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async adminFindAll(
    admin: User,
    filters: { verificationStatus?: string; page?: number; limit?: number },
  ) {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
    const { verificationStatus, page = 1, limit = 20 } = filters;

    const qb = this.agentProfileRepository
      .createQueryBuilder('agent')
      .leftJoinAndSelect('agent.user', 'user')
      .leftJoinAndSelect('agent.houseAssignments', 'assignments')
      .orderBy('agent.createdAt', 'DESC');

    if (verificationStatus && verificationStatus !== 'all') {
      qb.andWhere('agent.verificationStatus = :verificationStatus', {
        verificationStatus,
      });
    }

    const [agents, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: agents.map((a) => ({
        ...this.toPublicFormat(a),
        user: a.user
          ? {
              firstName: a.user.firstName,
              lastName: a.user.lastName,
              email: a.user.email,
              phone: a.user.phone,
              status: a.user.status,
            }
          : null,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async verifyAgent(agentId: string, dto: VerifyAgentDto, admin: User) {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    const agent = await this.agentProfileRepository.findOne({
      where: { id: agentId },
      relations: ['user'],
    });
    if (!agent) throw new NotFoundException('Agent not found');

    if (agent.verificationStatus !== AgentVerificationStatus.PENDING) {
      throw new BadRequestException('Agent is not pending verification');
    }

    if (dto.approved) {
      agent.verificationStatus = AgentVerificationStatus.VERIFIED;
      agent.rejectionReason = null as any;
    } else {
      if (!dto.rejectionReason) {
        throw new BadRequestException('Rejection reason is required');
      }
      agent.verificationStatus = AgentVerificationStatus.REJECTED;
      agent.rejectionReason = dto.rejectionReason;
    }

    return this.agentProfileRepository.save(agent);
  }

  private toPublicFormat(agent: AgentProfile): Record<string, any> {
    return {
      id: agent.id,
      userId: agent.userId,
      name: agent.user
        ? `${agent.user.firstName} ${agent.user.lastName}`.trim()
        : 'Unknown',
      avatar: agent.user?.avatar ?? null,
      phone: agent.user?.phone ?? null,
      agencyName: agent.agencyName,
      licenseNumber: agent.licenseNumber,
      bio: agent.bio,
      verificationStatus: agent.verificationStatus,
      commissionRate: agent.commissionRate,
      totalCompletedDeals: agent.totalCompletedDeals,
      rating: agent.rating,
      reviewCount: agent.reviewCount,
      managedHouseCount: agent.houseAssignments?.length ?? 0,
      createdAt: agent.createdAt,
    };
  }
}
