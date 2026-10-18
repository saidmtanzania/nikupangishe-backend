/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { invalidateHouses } from '../houses/house-cache.util';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
import { Tenancy, TenancyStatus } from '../houses/entities/tenancy.entity';
import { TenantProfile } from '../tenants/entities/tenant-profile.entity';
import { CommissionType } from '../exchanges/entities/commission-record.entity';
import { recordAgentCommission } from '../exchanges/commission.util';
import {
  ApproveTenantDto,
  CreateViewingDto,
  UpdateViewingDto,
} from './dto/viewing.dto';

export { ApproveTenantDto, CreateViewingDto, UpdateViewingDto };

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
    private dataSource: DataSource,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async requestViewing(dto: CreateViewingDto, tenant: User) {
    const preferredDate = new Date(dto.preferredDate);
    if (Number.isNaN(preferredDate.getTime()) || preferredDate <= new Date()) {
      throw new BadRequestException('Viewing date must be a valid future date');
    }

    const house = await this.houseRepository.findOne({
      where: { id: dto.houseId, status: HouseStatus.ACTIVE },
    });

    if (!house) throw new NotFoundException('House not found or not available');

    const existingViewing = await this.viewingRepository.findOne({
      where: [
        {
          houseId: dto.houseId,
          tenantId: tenant.id,
          status: ViewingStatus.PENDING,
        },
        {
          houseId: dto.houseId,
          tenantId: tenant.id,
          status: ViewingStatus.CONFIRMED,
        },
      ],
    });
    if (existingViewing) {
      throw new BadRequestException(
        'You already have an active viewing request for this house',
      );
    }

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
      preferredDate,
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
      relations: ['house', 'assignedAgent', 'assignedAgent.agent'],
    });

    if (!viewing) throw new NotFoundException('Viewing not found');

    this.assertViewingAccess(viewing, user);

    if (
      !dto.status &&
      !dto.confirmedDate &&
      dto.agentNotes === undefined &&
      dto.tenantInterestedAfterViewing === undefined &&
      dto.cancellationReason === undefined
    ) {
      throw new BadRequestException('At least one viewing update is required');
    }

    // Permissions: agents can confirm/complete, tenants can cancel
    if (
      user.role === UserRole.TENANT &&
      dto.status !== ViewingStatus.CANCELLED
    ) {
      throw new ForbiddenException('Tenants can only cancel viewings');
    }

    if (
      user.role === UserRole.AGENT &&
      dto.status === ViewingStatus.CANCELLED &&
      !dto.cancellationReason
    ) {
      throw new BadRequestException(
        'A cancellation reason is required when an agent cancels a viewing',
      );
    }

    if (
      dto.status &&
      [
        ViewingStatus.COMPLETED,
        ViewingStatus.CANCELLED,
        ViewingStatus.NO_SHOW,
      ].includes(viewing.status) &&
      dto.status !== viewing.status
    ) {
      throw new BadRequestException('A closed viewing cannot change status');
    }

    if (dto.tenantInterestedAfterViewing !== undefined) {
      if (user.role !== UserRole.AGENT && user.role !== UserRole.ADMIN) {
        throw new ForbiddenException(
          'Only the assigned agent can report tenant interest',
        );
      }
      const resultingStatus = dto.status ?? viewing.status;
      if (
        dto.tenantInterestedAfterViewing &&
        resultingStatus !== ViewingStatus.COMPLETED
      ) {
        throw new BadRequestException(
          'Tenant interest can only be reported for a completed viewing',
        );
      }
    }

    if (dto.confirmedDate) {
      const confirmedDate = new Date(dto.confirmedDate);
      if (Number.isNaN(confirmedDate.getTime())) {
        throw new BadRequestException('Confirmed date is invalid');
      }
      viewing.confirmedDate = confirmedDate;
    }

    if (dto.status) viewing.status = dto.status;
    if (dto.agentNotes !== undefined) viewing.agentNotes = dto.agentNotes;
    if (dto.tenantInterestedAfterViewing !== undefined) {
      viewing.tenantInterestedAfterViewing = dto.tenantInterestedAfterViewing;
    }
    if (dto.cancellationReason !== undefined) {
      viewing.cancellationReason = dto.cancellationReason;
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

  /**
   * Owner gives final approval to a tenant the agent reported as seriously
   * interested after a completed viewing. Creates the official tenancy,
   * records the payment details shared with the tenant, marks the house as
   * rented and records the managing agent's placement commission.
   */
  async approveTenant(viewingId: string, dto: ApproveTenantDto, owner: User) {
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();

    const result = await this.dataSource.transaction(async (manager) => {
      const viewingRepository = manager.getRepository(ViewingRequest);
      const houseRepository = manager.getRepository(House);
      const tenancyRepository = manager.getRepository(Tenancy);
      const tenantProfileRepository = manager.getRepository(TenantProfile);

      // Lock rows individually: Postgres refuses FOR UPDATE across outer joins.
      const viewing = await viewingRepository.findOne({
        where: { id: viewingId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!viewing) throw new NotFoundException('Viewing not found');

      const house = await houseRepository.findOne({
        where: { id: viewing.houseId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!house || house.ownerId !== owner.id) {
        throw new ForbiddenException(
          'You do not own the house for this viewing',
        );
      }

      if (
        viewing.status !== ViewingStatus.COMPLETED ||
        !viewing.tenantInterestedAfterViewing
      ) {
        throw new BadRequestException(
          'Only tenants the agent reported as interested after a completed viewing can be approved',
        );
      }

      const alreadyApproved = await tenancyRepository.findOne({
        where: { viewingRequestId: viewing.id },
      });
      if (alreadyApproved) {
        throw new BadRequestException('This tenant has already been approved');
      }

      const tenantProfile = await tenantProfileRepository.findOne({
        where: { userId: viewing.tenantId },
      });
      if (!tenantProfile)
        throw new NotFoundException('Tenant profile not found');

      const houseTaken = await tenancyRepository.findOne({
        where: { houseId: house.id, status: TenancyStatus.ACTIVE },
      });
      if (houseTaken) {
        throw new BadRequestException(
          'This house already has an active tenant',
        );
      }

      const tenantHasHome = await tenancyRepository.findOne({
        where: { tenantId: tenantProfile.id, status: TenancyStatus.ACTIVE },
      });
      if (tenantHasHome) {
        throw new BadRequestException(
          'This tenant already has an active tenancy. They should request a move or exchange instead.',
        );
      }

      const agreedRent = dto.agreedRent ?? Number(house.rentAmount);

      const commission = await recordAgentCommission(manager, {
        houseId: house.id,
        tenantProfileId: tenantProfile.id,
        monthlyRent: agreedRent,
        type: CommissionType.INITIAL_PLACEMENT,
        houseAgentId: viewing.assignedAgentId,
        currency: house.currency,
      });

      const tenancy = await tenancyRepository.save(
        tenancyRepository.create({
          houseId: house.id,
          tenantId: tenantProfile.id,
          status: TenancyStatus.ACTIVE,
          startDate,
          agreedRent,
          currency: house.currency,
          paymentInstructions: dto.paymentInstructions.trim(),
          viewingRequestId: viewing.id,
          facilitatingAgentId: commission?.agentProfileId,
          agentCommissionRate: commission?.rate,
          agentCommissionAmount: commission?.amount,
        }),
      );

      house.status = HouseStatus.RENTED;
      await houseRepository.save(house);

      return { tenancy, commission, house, tenantUserId: viewing.tenantId };
    });

    await invalidateHouses(this.cacheManager, [result.house.id]);

    await this.notificationsService.create(
      result.tenantUserId,
      NotificationType.TENANCY_CONFIRMED,
      'You Have Been Approved',
      `The owner approved you for ${result.house.title}. Open your tenancy to see the official payment details. Pay rent directly to the owner.`,
      { tenancyId: result.tenancy.id, houseId: result.house.id },
    );

    if (result.commission) {
      const agentProfile = await this.agentProfileRepository.findOne({
        where: { id: result.commission.agentProfileId },
      });
      if (agentProfile?.userId) {
        await this.notificationsService.create(
          agentProfile.userId,
          NotificationType.TENANCY_CONFIRMED,
          'Tenant Approved — Commission Recorded',
          `The owner approved your tenant for ${result.house.title}. A commission of ${result.commission.amount.toLocaleString()} ${result.house.currency} has been recorded.`,
          { tenancyId: result.tenancy.id, houseId: result.house.id },
        );
      }
    }

    return {
      tenancy: {
        ...result.tenancy,
        agreedRent: Number(result.tenancy.agreedRent),
        agentCommissionRate:
          result.tenancy.agentCommissionRate != null
            ? Number(result.tenancy.agentCommissionRate)
            : null,
        agentCommissionAmount:
          result.tenancy.agentCommissionAmount != null
            ? Number(result.tenancy.agentCommissionAmount)
            : null,
      },
      commission: result.commission
        ? {
            id: result.commission.record.id,
            type: result.commission.record.type,
            amount: result.commission.amount,
            rate: result.commission.rate,
            currency: result.commission.record.currency,
          }
        : null,
    };
  }

  async findOne(id: string, user: User) {
    const viewing = await this.viewingRepository.findOne({
      where: { id },
      relations: ['house', 'tenant', 'assignedAgent', 'assignedAgent.agent'],
    });
    if (!viewing) throw new NotFoundException('Viewing not found');
    this.assertViewingAccess(viewing, user);
    return this.toFrontendFormat(viewing);
  }

  private assertViewingAccess(viewing: ViewingRequest, user: User): void {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.TENANT && viewing.tenantId === user.id) return;
    if (user.role === UserRole.OWNER && viewing.house?.ownerId === user.id) {
      return;
    }
    if (
      user.role === UserRole.AGENT &&
      viewing.assignedAgent?.agent?.userId === user.id
    ) {
      return;
    }
    throw new ForbiddenException('You do not have access to this viewing');
  }

  /**
   * Map backend ViewingRequest to frontend Viewing shape:
   * { id, agentId, tenantName, propertyTitle, time, status }
   */
  private toFrontendFormat(viewing: ViewingRequest): any {
    const tenant = viewing.tenant
      ? {
          id: viewing.tenant.id,
          firstName: viewing.tenant.firstName,
          lastName: viewing.tenant.lastName,
          email: viewing.tenant.email,
          phone: viewing.tenant.phone,
          avatar: viewing.tenant.avatar,
        }
      : undefined;
    return {
      id: viewing.id,
      houseId: viewing.houseId,
      house: viewing.house
        ? {
            id: viewing.house.id,
            title: viewing.house.title,
            city: viewing.house.city,
            area: viewing.house.area,
            images: viewing.house.photos ?? [],
          }
        : undefined,
      tenantId: viewing.tenantId,
      tenant,
      assignedAgentId: viewing.assignedAgentId,
      status: viewing.status,
      preferredDate: viewing.preferredDate?.toISOString() ?? '',
      confirmedDate: viewing.confirmedDate?.toISOString(),
      tenantMessage: viewing.tenantMessage,
      agentNotes: viewing.agentNotes,
      tenantInterestedAfterViewing: viewing.tenantInterestedAfterViewing,
      cancellationReason: viewing.cancellationReason,
      createdAt: viewing.createdAt?.toISOString() ?? '',
    };
  }
}
