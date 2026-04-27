/* eslint-disable @typescript-eslint/no-unsafe-return */
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
import { AgentProfile } from '../agents/entities/agent-profile.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

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
    @InjectRepository(AgentProfile)
    private agentProfileRepository: Repository<AgentProfile>,
    private notificationsService: NotificationsService,
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

    const saved = await this.viewingRepository.save(viewing);

    // Notify the assigned agent
    if (primaryAgent) {
      const agentProfile = await this.agentProfileRepository.findOne({
        where: { id: primaryAgent.agentId },
        relations: ['user'],
      });
      if (agentProfile?.userId) {
        await this.notificationsService.create(
          agentProfile.userId,
          NotificationType.VIEWING_REQUEST,
          'New Viewing Request',
          `A tenant has requested to view ${house.title} on ${new Date(dto.preferredDate).toLocaleDateString()}.`,
          { viewingId: saved.id, houseId: dto.houseId },
        );
      }
    }

    // Notify the house owner
    if (house.ownerId) {
      await this.notificationsService.create(
        house.ownerId,
        NotificationType.VIEWING_REQUEST,
        'Viewing Requested for Your Property',
        `A tenant has requested to view ${house.title}.`,
        { viewingId: saved.id, houseId: dto.houseId },
      );
    }

    return saved;
  }

  async getViewingsForAgent(agentProfileId: string) {
    const viewings = await this.viewingRepository.find({
      where: { assignedAgentId: agentProfileId },
      relations: ['house', 'tenant'],
      order: { preferredDate: 'ASC' },
    });
    return viewings.map((v) => this.toFrontendFormat(v));
  }

  async getAgentProfileByUserId(userId: string): Promise<AgentProfile | null> {
    return this.agentProfileRepository.findOne({ where: { userId } });
  }

  async getViewingsForOwner(ownerId: string) {
    const viewings = await this.viewingRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.house', 'house')
      .leftJoinAndSelect('v.tenant', 'tenant')
      .leftJoinAndSelect('v.assignedAgent', 'agent')
      .where('house.ownerId = :ownerId', { ownerId })
      .orderBy('v.preferredDate', 'ASC')
      .getMany();
    return viewings.map((v) => this.toFrontendFormat(v));
  }

  async getViewingsForTenant(tenantId: string) {
    const viewings = await this.viewingRepository.find({
      where: { tenantId },
      relations: ['house', 'assignedAgent'],
      order: { createdAt: 'DESC' },
    });
    return viewings.map((v) => this.toFrontendFormat(v));
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

    const saved = await this.viewingRepository.save(viewing);

    // Notify tenant when agent confirms the viewing
    if (dto.status === ViewingStatus.CONFIRMED) {
      await this.notificationsService.create(
        viewing.tenantId,
        NotificationType.VIEWING_CONFIRMED,
        'Viewing Confirmed',
        `Your viewing of ${viewing.house?.title ?? 'the property'} has been confirmed.`,
        { viewingId: viewing.id },
      );
    }

    // Notify owner when agent marks tenant as interested after viewing
    if (dto.tenantInterestedAfterViewing && viewing.house?.ownerId) {
      await this.notificationsService.create(
        viewing.house.ownerId,
        NotificationType.TENANCY_CONFIRMATION_NEEDED,
        'Tenant Interested — Action Required',
        `An agent has reported that a tenant is seriously interested in ${viewing.house.title}. Please review and approve or decline.`,
        { viewingId: viewing.id, houseId: viewing.houseId },
      );
    }

    return this.toFrontendFormat(saved);
  }

  async findOne(id: string) {
    const viewing = await this.viewingRepository.findOne({
      where: { id },
      relations: ['house', 'tenant', 'assignedAgent'],
    });
    if (!viewing) throw new NotFoundException('Viewing not found');
    return this.toFrontendFormat(viewing);
  }

  /**
   * Map backend ViewingRequest to frontend Viewing shape:
   * { id, agentId, tenantName, propertyTitle, time, status }
   */
  private toFrontendFormat(viewing: ViewingRequest): any {
    // Map statuses: pending/confirmed → upcoming, no_show → cancelled
    let frontendStatus: 'upcoming' | 'completed' | 'cancelled' = 'upcoming';
    switch (viewing.status) {
      case ViewingStatus.PENDING:
      case ViewingStatus.CONFIRMED:
        frontendStatus = 'upcoming';
        break;
      case ViewingStatus.COMPLETED:
        frontendStatus = 'completed';
        break;
      case ViewingStatus.CANCELLED:
      case ViewingStatus.NO_SHOW:
        frontendStatus = 'cancelled';
        break;
    }

    // Get tenant name from the relation
    let tenantName = 'Unknown';
    if (viewing.tenant) {
      const t = viewing.tenant;
      tenantName =
        `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Unknown';
    }

    // Use confirmedDate if available, otherwise preferredDate
    const time = viewing.confirmedDate
      ? viewing.confirmedDate.toISOString()
      : viewing.preferredDate
        ? viewing.preferredDate.toISOString()
        : '';

    return {
      id: viewing.id,
      agentId: viewing.assignedAgentId || '',
      tenantName,
      propertyTitle: viewing.house?.title || 'Unknown Property',
      time,
      status: frontendStatus,
    };
  }
}
