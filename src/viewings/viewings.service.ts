import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ViewingRequest,
  ViewingStatus,
} from './entities/viewing-request.entity';
import { House, HouseStatus } from '../houses/entities/house.entity';
import {
  HouseAgent,
  HouseAgentStatus,
} from '../houses/entities/house-agent.entity';
import { User, UserRole } from '../users/entities/user.entity';

export class CreateViewingDto {
  houseId: string;
  preferredDate: string;
  tenantMessage?: string;
}

export class UpdateViewingDto {
  status?: ViewingStatus;
  confirmedDate?: string;
  agentNotes?: string;
  tenantInterestedAfterViewing?: boolean;
  cancellationReason?: string;
}

@Injectable()
export class ViewingsService {
  constructor(
    @InjectRepository(ViewingRequest)
    private viewingRepository: Repository<ViewingRequest>,
    @InjectRepository(House)
    private houseRepository: Repository<House>,
    @InjectRepository(HouseAgent)
    private houseAgentRepository: Repository<HouseAgent>,
  ) {}

  async requestViewing(dto: CreateViewingDto, tenant: User) {
    const house = await this.houseRepository.findOne({
      where: { id: dto.houseId, status: HouseStatus.ACTIVE },
    });

    if (!house) throw new NotFoundException('House not found or not available');

    // Find the primary agent for this house
    const primaryAgent = await this.houseAgentRepository.findOne({
      where: {
        houseId: dto.houseId,
        isPrimary: true,
        status: HouseAgentStatus.ACTIVE,
      },
    });

    const viewing = this.viewingRepository.create({
      houseId: dto.houseId,
      tenantId: tenant.id,
      assignedAgentId: primaryAgent?.id,
      preferredDate: new Date(dto.preferredDate),
      tenantMessage: dto.tenantMessage,
      status: ViewingStatus.PENDING,
    });

    return this.viewingRepository.save(viewing);
  }

  async getViewingsForAgent(agentId: string) {
    return this.viewingRepository.find({
      where: { assignedAgentId: agentId },
      relations: ['house', 'tenant'],
      order: { preferredDate: 'ASC' },
    });
  }

  async getViewingsForOwner(ownerId: string) {
    return this.viewingRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.house', 'house')
      .leftJoinAndSelect('v.tenant', 'tenant')
      .leftJoinAndSelect('v.assignedAgent', 'agent')
      .where('house.ownerId = :ownerId', { ownerId })
      .orderBy('v.preferredDate', 'ASC')
      .getMany();
  }

  async getViewingsForTenant(tenantId: string) {
    return this.viewingRepository.find({
      where: { tenantId },
      relations: ['house', 'assignedAgent'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateViewing(id: string, dto: UpdateViewingDto, user: User) {
    const viewing = await this.viewingRepository.findOne({
      where: { id },
      relations: ['house', 'assignedAgent'],
    });

    if (!viewing) throw new NotFoundException('Viewing not found');

    // Permissions: agents can confirm/complete, tenants can cancel
    if (
      user.role === UserRole.TENANT &&
      dto.status !== ViewingStatus.CANCELLED
    ) {
      throw new ForbiddenException('Tenants can only cancel viewings');
    }

    Object.assign(viewing, dto);

    if (dto.confirmedDate) {
      viewing.confirmedDate = new Date(dto.confirmedDate);
    }

    return this.viewingRepository.save(viewing);
  }

  async findOne(id: string) {
    const viewing = await this.viewingRepository.findOne({
      where: { id },
      relations: ['house', 'tenant', 'assignedAgent'],
    });
    if (!viewing) throw new NotFoundException('Viewing not found');
    return viewing;
  }
}
