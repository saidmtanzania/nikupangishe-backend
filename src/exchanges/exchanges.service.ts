/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ExchangeRequest,
  ExchangeStatus,
  ExchangeType,
} from './entities/exchange-request.entity';
import {
  CommissionRecord,
  CommissionType,
} from './entities/commission-record.entity';
import { Tenancy, TenancyStatus } from '../houses/entities/tenancy.entity';
import { House, HouseStatus } from '../houses/entities/house.entity';
import { TenantProfile } from '../tenants/entities/tenant-profile.entity';
import { AgentProfile } from '../agents/entities/agent-profile.entity';
import {
  HouseAgent,
  HouseAgentStatus,
} from '../houses/entities/house-agent.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

export class CreateExchangeDto {
  exchangeType: ExchangeType;
  targetHouseId: string;
  notes?: string;
}

export class ConfirmTenancyDto {
  tenantUserId: string;
  houseId: string;
  startDate?: string;
  agreedRent?: number;
}

@Injectable()
export class ExchangesService {
  constructor(
    @InjectRepository(ExchangeRequest)
    private exchangeRepository: Repository<ExchangeRequest>,
    @InjectRepository(Tenancy)
    private tenancyRepository: Repository<Tenancy>,
    @InjectRepository(House)
    private houseRepository: Repository<House>,
    @InjectRepository(TenantProfile)
    private tenantProfileRepository: Repository<TenantProfile>,
    @InjectRepository(CommissionRecord)
    private commissionRepository: Repository<CommissionRecord>,
    @InjectRepository(AgentProfile)
    private agentProfileRepository: Repository<AgentProfile>,
    @InjectRepository(HouseAgent)
    private houseAgentRepository: Repository<HouseAgent>,
    private notificationsService: NotificationsService,
  ) {}

  async createExchangeRequest(dto: CreateExchangeDto, tenant: User) {
    // Find tenant's active tenancy
    const tenantProfile = await this.tenantProfileRepository.findOne({
      where: { userId: tenant.id },
    });

    if (!tenantProfile)
      throw new BadRequestException('Tenant profile not found');

    const activeTenancy = await this.tenancyRepository.findOne({
      where: { tenantId: tenantProfile.id, status: TenancyStatus.ACTIVE },
      relations: ['house'],
    });

    if (!activeTenancy) {
      throw new BadRequestException(
        'You must have an active tenancy to request a move or exchange',
      );
    }

    const targetHouse = await this.houseRepository.findOne({
      where: { id: dto.targetHouseId, status: HouseStatus.ACTIVE },
    });

    if (!targetHouse)
      throw new NotFoundException('Target house not found or not available');

    // For exchange type, check if target house has a tenant
    let targetTenancy: Tenancy | null = null;
    if (dto.exchangeType === ExchangeType.EXCHANGE) {
      targetTenancy = await this.tenancyRepository.findOne({
        where: { houseId: dto.targetHouseId, status: TenancyStatus.ACTIVE },
      });

      if (!targetTenancy) {
        throw new BadRequestException(
          'Target house has no active tenant for an exchange. Use MOVE type instead.',
        );
      }
    }

    const exchange = this.exchangeRepository.create({
      exchangeType: dto.exchangeType,
      initiatorTenantId: tenantProfile.id,
      initiatorTenancyId: activeTenancy.id,
      targetHouseId: dto.targetHouseId,
      targetTenantId: targetTenancy?.tenantId,
      targetTenancyId: targetTenancy?.id,
      notes: dto.notes,
    });

    const saved = await this.exchangeRepository.save(exchange);

    // Notify both house owners that approval is needed
    const notifyOwner = async (ownerId: string, houseName: string) => {
      await this.notificationsService.create(
        ownerId,
        NotificationType.EXCHANGE_OWNER_APPROVAL_NEEDED,
        'Exchange Request — Approval Needed',
        `A tenant has requested to move into or exchange ${houseName}. Please review and approve or decline.`,
        { exchangeId: saved.id },
      );
    };

    if (targetHouse.ownerId) {
      await notifyOwner(targetHouse.ownerId, targetHouse.title);
    }
    if (activeTenancy.house?.ownerId) {
      await notifyOwner(activeTenancy.house.ownerId, activeTenancy.house.title);
    }

    return saved;
  }

  // Owner approves the exchange from their side
  async ownerApprove(exchangeId: string, owner: User) {
    const exchange = await this.findOne(exchangeId);

    const initiatorHouseId = await this.getInitiatorHouseId(exchange);

    const initiatorHouse = initiatorHouseId
      ? await this.houseRepository.findOne({ where: { id: initiatorHouseId } })
      : null;

    const targetHouse = await this.houseRepository.findOne({
      where: { id: exchange.targetHouseId },
    });

    const isInitiatorOwner = initiatorHouse?.ownerId === owner.id;
    const isTargetOwner = targetHouse?.ownerId === owner.id;

    if (!isInitiatorOwner && !isTargetOwner) {
      throw new ForbiddenException(
        'You are not an owner of a house involved in this exchange',
      );
    }

    if (isInitiatorOwner && !exchange.initiatorOwnerApproved) {
      exchange.initiatorOwnerApproved = true;
      exchange.initiatorOwnerApprovedAt = new Date();
      exchange.status = ExchangeStatus.INITIATOR_OWNER_APPROVED;
    }

    if (isTargetOwner && !exchange.targetOwnerApproved) {
      exchange.targetOwnerApproved = true;
      exchange.targetOwnerApprovedAt = new Date();
      exchange.status = ExchangeStatus.TARGET_OWNER_APPROVED;
    }

    if (exchange.initiatorOwnerApproved && exchange.targetOwnerApproved) {
      exchange.status = ExchangeStatus.BOTH_OWNERS_APPROVED;
      await this.exchangeRepository.save(exchange);
      return this.completeExchange(exchange.id);
    }

    return this.exchangeRepository.save(exchange);
  }

  async ownerReject(exchangeId: string, owner: User, reason: string) {
    const exchange = await this.findOne(exchangeId);

    exchange.status = ExchangeStatus.REJECTED;
    exchange.rejectionReason = reason;
    const saved = await this.exchangeRepository.save(exchange);

    // Notify initiating tenant
    const tenantProfile = exchange.initiatorTenant;
    if (tenantProfile?.userId) {
      await this.notificationsService.create(
        tenantProfile.userId,
        NotificationType.EXCHANGE_REJECTED,
        'Exchange Request Declined',
        `Your exchange/move request has been declined. Reason: ${reason}`,
        { exchangeId },
      );
    }

    return saved;
  }

  private async completeExchange(exchangeId: string) {
    const exchange = await this.findOne(exchangeId);

    const initiatorTenancy = await this.tenancyRepository.findOne({
      where: { id: exchange.initiatorTenancyId },
    });
    const targetTenancy = exchange.targetTenancyId
      ? await this.tenancyRepository.findOne({
          where: { id: exchange.targetTenancyId },
        })
      : null;

    // End current tenancies
    await this.tenancyRepository.update(exchange.initiatorTenancyId, {
      status: TenancyStatus.TRANSFERRED,
      endDate: new Date(),
    });

    if (targetTenancy) {
      await this.tenancyRepository.update(exchange.targetTenancyId, {
        status: TenancyStatus.TRANSFERRED,
        endDate: new Date(),
      });
    }

    // Create new tenancy for initiator in the target house
    const newInitiatorTenancy = this.tenancyRepository.create({
      houseId: exchange.targetHouseId,
      tenantId: exchange.initiatorTenantId,
      status: TenancyStatus.ACTIVE,
      startDate: new Date(),
      agreedRent: initiatorTenancy?.agreedRent,
    });
    await this.tenancyRepository.save(newInitiatorTenancy);

    // Update target house to RENTED
    await this.houseRepository.update(exchange.targetHouseId, {
      status: HouseStatus.RENTED,
    });

    // If EXCHANGE type: create new tenancy for target tenant in initiator's old house
    if (
      exchange.exchangeType === ExchangeType.EXCHANGE &&
      targetTenancy &&
      exchange.targetTenantId &&
      initiatorTenancy
    ) {
      const newTargetTenancy = this.tenancyRepository.create({
        houseId: initiatorTenancy.houseId,
        tenantId: exchange.targetTenantId,
        status: TenancyStatus.ACTIVE,
        startDate: new Date(),
        agreedRent: targetTenancy.agreedRent,
      });
      await this.tenancyRepository.save(newTargetTenancy);

      await this.houseRepository.update(initiatorTenancy.houseId, {
        status: HouseStatus.RENTED,
      });
    } else if (initiatorTenancy) {
      // MOVE type: initiator's old house becomes available again
      await this.houseRepository.update(initiatorTenancy.houseId, {
        status: HouseStatus.ACTIVE,
      });
    }

    // Record commission for the facilitating agent
    if (exchange.facilitatingAgentId) {
      const agentProfile = await this.agentProfileRepository.findOne({
        where: { id: exchange.facilitatingAgentId },
      });

      if (agentProfile) {
        const commissionAmount =
          ((newInitiatorTenancy.agreedRent ?? 0) *
            (agentProfile.commissionRate ?? 5)) /
          100;

        const record = this.commissionRepository.create({
          houseId: exchange.targetHouseId,
          agentId: exchange.facilitatingAgentId,
          tenantId: exchange.initiatorTenantId,
          type: CommissionType.EXCHANGE,
          amount: commissionAmount,
          exchangeRequestId: exchange.id,
        });
        await this.commissionRepository.save(record);

        // Increment agent stats
        await this.agentProfileRepository.increment(
          { id: exchange.facilitatingAgentId },
          'totalCompletedDeals',
          1,
        );

        // Increment house-agent deal count
        await this.houseAgentRepository
          .createQueryBuilder()
          .update()
          .set({ dealsCompleted: () => 'deals_completed + 1' })
          .where(
            'agentId = :agentId AND houseId = :houseId AND status = :status',
            {
              agentId: exchange.facilitatingAgentId,
              houseId: exchange.targetHouseId,
              status: HouseAgentStatus.ACTIVE,
            },
          )
          .execute();
      }
    }

    exchange.status = ExchangeStatus.COMPLETED;
    exchange.completedAt = new Date();
    const completed = await this.exchangeRepository.save(exchange);

    // Notify initiating tenant
    if (exchange.initiatorTenant?.userId) {
      await this.notificationsService.create(
        exchange.initiatorTenant.userId,
        NotificationType.EXCHANGE_COMPLETED,
        'Your Move/Exchange is Complete',
        `Your request has been fully approved and your new tenancy is now active.`,
        { exchangeId },
      );
    }

    // Notify target tenant (for EXCHANGE type)
    if (
      exchange.exchangeType === ExchangeType.EXCHANGE &&
      exchange.targetTenant?.userId
    ) {
      await this.notificationsService.create(
        exchange.targetTenant.userId,
        NotificationType.EXCHANGE_COMPLETED,
        'House Exchange Complete',
        `The house exchange has been completed. Your new tenancy is now active.`,
        { exchangeId },
      );
    }

    return completed;
  }

  async findOne(id: string) {
    const exchange = await this.exchangeRepository.findOne({
      where: { id },
      relations: [
        'initiatorTenant',
        'initiatorTenant.user',
        'initiatorTenancy',
        'initiatorTenancy.house',
        'targetHouse',
        'targetTenant',
        'targetTenant.user',
      ],
    });
    if (!exchange) throw new NotFoundException('Exchange request not found');
    return exchange;
  }

  /**
   * Returns a single exchange in the frontend ExchangeRequest format.
   */
  async findOneFormatted(id: string): Promise<any> {
    const exchange = await this.findOne(id);
    return this.toFrontendFormat(exchange);
  }

  async getExchangesForTenant(tenantProfileId: string) {
    const exchanges = await this.exchangeRepository.find({
      where: { initiatorTenantId: tenantProfileId },
      relations: [
        'targetHouse',
        'initiatorTenancy',
        'initiatorTenancy.house',
        'initiatorTenant',
        'initiatorTenant.user',
      ],
      order: { createdAt: 'DESC' },
    });
    return exchanges.map((e) => this.toFrontendFormat(e));
  }

  async getExchangesForTenantUser(userId: string) {
    const tenantProfile = await this.tenantProfileRepository.findOne({
      where: { userId },
      select: ['id'],
    });

    if (!tenantProfile) {
      return [];
    }

    return this.getExchangesForTenant(tenantProfile.id);
  }

  async getExchangesForOwner(ownerId: string) {
    const exchanges = await this.exchangeRepository
      .createQueryBuilder('ex')
      .leftJoinAndSelect('ex.targetHouse', 'targetHouse')
      .leftJoinAndSelect('ex.initiatorTenant', 'initiatorTenant')
      .leftJoinAndSelect('initiatorTenant.user', 'initiatorUser')
      .leftJoinAndSelect('ex.initiatorTenancy', 'initiatorTenancy')
      .leftJoinAndSelect('initiatorTenancy.house', 'initiatorHouse')
      .where(
        'targetHouse.ownerId = :ownerId OR initiatorHouse.ownerId = :ownerId',
        { ownerId },
      )
      .orderBy('ex.createdAt', 'DESC')
      .getMany();
    return exchanges.map((e) => this.toFrontendFormat(e));
  }

  // Confirm tenancy - owner verifies tenant lives in house
  async confirmTenancy(dto: ConfirmTenancyDto, owner: User) {
    const house = await this.houseRepository.findOne({
      where: { id: dto.houseId, ownerId: owner.id },
    });

    if (!house)
      throw new ForbiddenException('House not found or you are not the owner');

    const tenantProfile = await this.tenantProfileRepository.findOne({
      where: { userId: dto.tenantUserId },
    });

    if (!tenantProfile) throw new NotFoundException('Tenant not found');

    const tenancy = this.tenancyRepository.create({
      houseId: dto.houseId,
      tenantId: tenantProfile.id,
      status: TenancyStatus.ACTIVE,
      startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
      agreedRent: dto.agreedRent,
    });

    // Mark house as rented
    house.status = HouseStatus.RENTED;
    await this.houseRepository.save(house);

    return this.tenancyRepository.save(tenancy);
  }

  async getOwnerTenancies(ownerId: string) {
    const tenancies = await this.tenancyRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.house', 'house')
      .leftJoinAndSelect('t.tenant', 'tenantProfile')
      .leftJoinAndSelect('tenantProfile.user', 'user')
      .where('house.ownerId = :ownerId', { ownerId })
      .orderBy('t.createdAt', 'DESC')
      .getMany();

    return tenancies.map((t) => ({
      id: t.id,
      houseId: t.houseId,
      house: t.house
        ? { id: t.house.id, title: t.house.title, city: t.house.city, area: t.house.area, images: t.house.photos ?? [] }
        : undefined,
      tenantId: t.tenantId,
      tenant: t.tenant?.user
        ? {
            id: t.tenant.user.id,
            firstName: t.tenant.user.firstName,
            lastName: t.tenant.user.lastName,
            email: t.tenant.user.email,
            phone: t.tenant.user.phone,
            profilePhoto: t.tenant.user.avatar,
          }
        : undefined,
      status: t.status,
      startDate: t.startDate ? t.startDate.toISOString() : null,
      endDate: t.endDate ? t.endDate.toISOString() : null,
      agreedRent: t.agreedRent ? Number(t.agreedRent) : null,
      currency: t.currency,
      agentCommissionRate: t.agentCommissionRate ? Number(t.agentCommissionRate) : null,
      commissionPaid: t.commissionPaid,
      notes: t.notes,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  private async getInitiatorHouseId(
    exchange: ExchangeRequest,
  ): Promise<string> {
    const tenancy = await this.tenancyRepository.findOne({
      where: { id: exchange.initiatorTenancyId },
    });
    return tenancy?.houseId ?? '';
  }

  /**
   * Map backend ExchangeRequest entity to frontend ExchangeRequest shape.
   * Frontend expects: { id, fromTenantId, fromTenantName, fromPropertyId,
   *   fromPropertyTitle, toPropertyId, toPropertyTitle, status, createdAt, reason }
   */
  private toFrontendFormat(exchange: ExchangeRequest): any {
    // Map complex statuses to simple frontend statuses
    let frontendStatus: 'pending' | 'approved' | 'rejected' | 'completed' =
      'pending';
    switch (exchange.status) {
      case ExchangeStatus.PENDING:
      case ExchangeStatus.INITIATOR_OWNER_APPROVED:
      case ExchangeStatus.TARGET_OWNER_APPROVED:
        frontendStatus = 'pending';
        break;
      case ExchangeStatus.BOTH_OWNERS_APPROVED:
        frontendStatus = 'approved';
        break;
      case ExchangeStatus.COMPLETED:
        frontendStatus = 'completed';
        break;
      case ExchangeStatus.REJECTED:
      case ExchangeStatus.CANCELLED:
        frontendStatus = 'rejected';
        break;
    }

    // Get tenant name from the initiatorTenant -> user relation
    let fromTenantName = 'Unknown';
    if (exchange.initiatorTenant?.user) {
      const u = exchange.initiatorTenant.user;
      fromTenantName =
        `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown';
    }

    // Get from property (initiator's current house via tenancy)
    const fromPropertyId = exchange.initiatorTenancy?.houseId || '';
    const fromPropertyTitle =
      exchange.initiatorTenancy?.house?.title || 'Unknown Property';

    return {
      id: exchange.id,
      fromTenantId: exchange.initiatorTenantId,
      fromTenantName,
      fromPropertyId,
      fromPropertyTitle,
      toPropertyId: exchange.targetHouseId,
      toPropertyTitle: exchange.targetHouse?.title || 'Unknown Property',
      status: frontendStatus,
      createdAt: exchange.createdAt
        ? exchange.createdAt.toISOString()
        : new Date().toISOString(),
      reason: exchange.notes || exchange.rejectionReason || '',
    };
  }
}
