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
import { DataSource, EntityManager, Repository } from 'typeorm';
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
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { recordAgentCommission } from './commission.util';
import { ConfirmTenancyDto, CreateExchangeDto } from './dto/exchange.dto';

export { CreateExchangeDto, ConfirmTenancyDto };

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
    private dataSource: DataSource,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
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

    if (dto.targetHouseId === activeTenancy.houseId) {
      throw new BadRequestException('You already live in this house');
    }

    const targetHouse = await this.houseRepository.findOne({
      where: { id: dto.targetHouseId },
    });
    if (!targetHouse || !targetHouse.isVerified) {
      throw new NotFoundException('Target house not found or not available');
    }

    let targetTenancy: Tenancy | null = null;
    if (dto.exchangeType === ExchangeType.EXCHANGE) {
      // A swap targets an occupied house whose tenant is open to exchanging.
      if (!targetHouse.isOpenToExchange) {
        throw new BadRequestException('This house is not open to exchanges');
      }
      targetTenancy = await this.tenancyRepository.findOne({
        where: { houseId: dto.targetHouseId, status: TenancyStatus.ACTIVE },
      });
      if (!targetTenancy) {
        throw new BadRequestException(
          'Target house has no active tenant for an exchange. Use MOVE type instead.',
        );
      }
    } else if (targetHouse.status !== HouseStatus.ACTIVE) {
      // A move targets a vacant, listed house.
      throw new BadRequestException(
        'Target house is not available to move into',
      );
    }

    const openStatuses = [
      ExchangeStatus.PENDING,
      ExchangeStatus.INITIATOR_OWNER_APPROVED,
      ExchangeStatus.TARGET_OWNER_APPROVED,
      ExchangeStatus.BOTH_OWNERS_APPROVED,
    ];
    const existingOpen = await this.exchangeRepository.findOne({
      where: openStatuses.map((status) => ({
        initiatorTenantId: tenantProfile.id,
        targetHouseId: dto.targetHouseId,
        status,
      })),
    });
    if (existingOpen) {
      throw new BadRequestException(
        'You already have an open request for this house',
      );
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
    if (
      activeTenancy.house?.ownerId &&
      activeTenancy.house.ownerId !== targetHouse.ownerId
    ) {
      await notifyOwner(activeTenancy.house.ownerId, activeTenancy.house.title);
    }

    if (targetTenancy) {
      const targetTenant = await this.tenantProfileRepository.findOne({
        where: { id: targetTenancy.tenantId },
      });
      if (targetTenant?.userId) {
        await this.notificationsService.create(
          targetTenant.userId,
          NotificationType.EXCHANGE_REQUEST,
          'Someone Wants to Exchange Houses With You',
          `A tenant has proposed exchanging their home for ${targetHouse.title}. Both owners must approve before anything changes.`,
          { exchangeId: saved.id },
        );
      }
    }

    return saved;
  }

  // Owner approves the exchange from their side
  async ownerApprove(exchangeId: string, owner: User) {
    const result = await this.dataSource.transaction(async (manager) => {
      const exchangeRepository = manager.getRepository(ExchangeRequest);
      const houseRepository = manager.getRepository(House);
      // Lock the row on its own: Postgres rejects FOR UPDATE on outer joins.
      const exchange = await exchangeRepository.findOne({
        where: { id: exchangeId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!exchange) throw new NotFoundException('Exchange request not found');
      exchange.initiatorTenancy = (await manager
        .getRepository(Tenancy)
        .findOne({ where: { id: exchange.initiatorTenancyId } })) as Tenancy;

      if (
        [
          ExchangeStatus.COMPLETED,
          ExchangeStatus.REJECTED,
          ExchangeStatus.CANCELLED,
        ].includes(exchange.status)
      ) {
        return exchange;
      }

      const initiatorHouse = exchange.initiatorTenancy?.houseId
        ? await houseRepository.findOne({
            where: { id: exchange.initiatorTenancy.houseId },
          })
        : null;
      const targetHouse = await houseRepository.findOne({
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
      }

      if (isTargetOwner && !exchange.targetOwnerApproved) {
        exchange.targetOwnerApproved = true;
        exchange.targetOwnerApprovedAt = new Date();
      }

      if (exchange.initiatorOwnerApproved && exchange.targetOwnerApproved) {
        exchange.status = ExchangeStatus.BOTH_OWNERS_APPROVED;
        await exchangeRepository.save(exchange);
        return this.completeExchange(exchange.id, manager);
      }

      exchange.status = exchange.initiatorOwnerApproved
        ? ExchangeStatus.INITIATOR_OWNER_APPROVED
        : ExchangeStatus.TARGET_OWNER_APPROVED;
      return exchangeRepository.save(exchange);
    });

    if (result.status === ExchangeStatus.COMPLETED) {
      const initiatorHouseId = await this.getInitiatorHouseId(result);
      await invalidateHouses(
        this.cacheManager,
        [result.targetHouseId, initiatorHouseId].filter(Boolean),
      );
    }
    return result;
  }

  async ownerReject(exchangeId: string, owner: User, reason: string) {
    const exchange = await this.findOne(exchangeId);

    if (
      [
        ExchangeStatus.COMPLETED,
        ExchangeStatus.REJECTED,
        ExchangeStatus.CANCELLED,
      ].includes(exchange.status)
    ) {
      throw new BadRequestException('This exchange request is already closed');
    }

    const initiatorHouseId = await this.getInitiatorHouseId(exchange);
    const initiatorHouse = initiatorHouseId
      ? await this.houseRepository.findOne({ where: { id: initiatorHouseId } })
      : null;
    const targetHouse = await this.houseRepository.findOne({
      where: { id: exchange.targetHouseId },
    });

    if (
      initiatorHouse?.ownerId !== owner.id &&
      targetHouse?.ownerId !== owner.id
    ) {
      throw new ForbiddenException(
        'You are not an owner of a house involved in this exchange',
      );
    }

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

  private async completeExchange(
    exchangeId: string,
    manager: EntityManager = this.dataSource.manager,
  ) {
    const exchangeRepository = manager.getRepository(ExchangeRequest);
    const tenancyRepository = manager.getRepository(Tenancy);
    const houseRepository = manager.getRepository(House);
    const tenantProfileRepository = manager.getRepository(TenantProfile);

    // Lock the exchange row on its own (FOR UPDATE cannot span outer joins).
    const exchange = await exchangeRepository.findOne({
      where: { id: exchangeId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!exchange) throw new NotFoundException('Exchange request not found');
    if (exchange.status === ExchangeStatus.COMPLETED) return exchange;

    const initiatorTenancy = await tenancyRepository.findOne({
      where: { id: exchange.initiatorTenancyId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!initiatorTenancy || initiatorTenancy.status !== TenancyStatus.ACTIVE) {
      throw new BadRequestException(
        'The initiating tenancy is no longer active',
      );
    }

    const targetTenancy = exchange.targetTenancyId
      ? await tenancyRepository.findOne({
          where: { id: exchange.targetTenancyId },
          lock: { mode: 'pessimistic_write' },
        })
      : null;
    if (
      exchange.exchangeType === ExchangeType.EXCHANGE &&
      (!targetTenancy || targetTenancy.status !== TenancyStatus.ACTIVE)
    ) {
      throw new BadRequestException('The other tenancy is no longer active');
    }

    const initiatorHouse = await houseRepository.findOne({
      where: { id: initiatorTenancy.houseId },
      lock: { mode: 'pessimistic_write' },
    });
    const targetHouse = await houseRepository.findOne({
      where: { id: exchange.targetHouseId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!initiatorHouse || !targetHouse) {
      throw new BadRequestException(
        'A house in this exchange no longer exists',
      );
    }

    if (exchange.exchangeType === ExchangeType.MOVE) {
      const occupied = await tenancyRepository.findOne({
        where: { houseId: targetHouse.id, status: TenancyStatus.ACTIVE },
      });
      if (occupied) {
        throw new BadRequestException('The target house is no longer vacant');
      }
    }

    const now = new Date();

    // End current tenancies first so the one-active-tenancy indexes allow the new ones.
    await tenancyRepository.update(initiatorTenancy.id, {
      status: TenancyStatus.TRANSFERRED,
      endDate: now,
    });
    if (targetTenancy) {
      await tenancyRepository.update(targetTenancy.id, {
        status: TenancyStatus.TRANSFERRED,
        endDate: now,
      });
    }

    // Initiator moves into the target house at that house's rent.
    const initiatorRent = Number(
      exchange.exchangeType === ExchangeType.EXCHANGE &&
        targetTenancy?.agreedRent
        ? targetTenancy.agreedRent
        : targetHouse.rentAmount,
    );
    const initiatorCommission = await recordAgentCommission(manager, {
      houseId: targetHouse.id,
      tenantProfileId: exchange.initiatorTenantId,
      monthlyRent: initiatorRent,
      type: CommissionType.EXCHANGE,
      exchangeRequestId: exchange.id,
      currency: targetHouse.currency,
    });
    await tenancyRepository.save(
      tenancyRepository.create({
        houseId: targetHouse.id,
        tenantId: exchange.initiatorTenantId,
        status: TenancyStatus.ACTIVE,
        startDate: now,
        agreedRent: initiatorRent,
        currency: targetHouse.currency,
        paymentInstructions:
          exchange.exchangeType === ExchangeType.EXCHANGE
            ? (targetTenancy?.paymentInstructions ?? null)
            : null,
        facilitatingAgentId: initiatorCommission?.agentProfileId,
        agentCommissionRate: initiatorCommission?.rate,
        agentCommissionAmount: initiatorCommission?.amount,
      }),
    );
    await houseRepository.update(targetHouse.id, {
      status: HouseStatus.RENTED,
    });

    if (exchange.exchangeType === ExchangeType.EXCHANGE && targetTenancy) {
      // The other tenant moves into the initiator's old house at its rent.
      const targetRent = Number(
        initiatorTenancy.agreedRent ?? initiatorHouse.rentAmount,
      );
      const targetCommission = await recordAgentCommission(manager, {
        houseId: initiatorHouse.id,
        tenantProfileId: targetTenancy.tenantId,
        monthlyRent: targetRent,
        type: CommissionType.EXCHANGE,
        exchangeRequestId: exchange.id,
        currency: initiatorHouse.currency,
      });
      await tenancyRepository.save(
        tenancyRepository.create({
          houseId: initiatorHouse.id,
          tenantId: targetTenancy.tenantId,
          status: TenancyStatus.ACTIVE,
          startDate: now,
          agreedRent: targetRent,
          currency: initiatorHouse.currency,
          paymentInstructions: initiatorTenancy.paymentInstructions ?? null,
          facilitatingAgentId: targetCommission?.agentProfileId,
          agentCommissionRate: targetCommission?.rate,
          agentCommissionAmount: targetCommission?.amount,
        }),
      );
      await houseRepository.update(initiatorHouse.id, {
        status: HouseStatus.RENTED,
      });
    } else {
      // MOVE: the initiator's old house is vacant and listed again.
      await houseRepository.update(initiatorHouse.id, {
        status: HouseStatus.ACTIVE,
      });
    }

    exchange.status = ExchangeStatus.COMPLETED;
    exchange.completedAt = now;
    exchange.facilitatingAgentId =
      initiatorCommission?.agentProfileId ?? exchange.facilitatingAgentId;
    const completed = await exchangeRepository.save(exchange);

    const initiatorTenant = await tenantProfileRepository.findOne({
      where: { id: exchange.initiatorTenantId },
    });
    if (initiatorTenant?.userId) {
      await this.notificationsService.create(
        initiatorTenant.userId,
        NotificationType.EXCHANGE_COMPLETED,
        'Your Move/Exchange is Complete',
        `Both owners approved. Your tenancy at ${targetHouse.title} is now active.`,
        { exchangeId },
      );
    }

    if (
      exchange.exchangeType === ExchangeType.EXCHANGE &&
      exchange.targetTenantId
    ) {
      const targetTenant = await tenantProfileRepository.findOne({
        where: { id: exchange.targetTenantId },
      });
      if (targetTenant?.userId) {
        await this.notificationsService.create(
          targetTenant.userId,
          NotificationType.EXCHANGE_COMPLETED,
          'House Exchange Complete',
          `The exchange is complete. Your tenancy at ${initiatorHouse.title} is now active.`,
          { exchangeId },
        );
      }
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
  async findOneFormatted(id: string, user: User): Promise<any> {
    const exchange = await this.findOne(id);
    await this.assertExchangeAccess(exchange, user);
    return this.toFrontendFormat(exchange);
  }

  /** Only the tenants, owners and managing agents involved (or an admin) may read an exchange. */
  private async assertExchangeAccess(
    exchange: ExchangeRequest,
    user: User,
  ): Promise<void> {
    if (user.role === UserRole.ADMIN) return;

    if (user.role === UserRole.TENANT) {
      if (
        exchange.initiatorTenant?.userId === user.id ||
        exchange.targetTenant?.userId === user.id
      ) {
        return;
      }
    }

    const houseIds = [exchange.targetHouseId];
    const initiatorHouseId =
      exchange.initiatorTenancy?.houseId ??
      (await this.getInitiatorHouseId(exchange));
    if (initiatorHouseId) houseIds.push(initiatorHouseId);

    if (user.role === UserRole.OWNER) {
      const owned = await this.houseRepository.count({
        where: houseIds.map((id) => ({ id, ownerId: user.id })),
      });
      if (owned > 0) return;
    }

    if (user.role === UserRole.AGENT) {
      const agentProfile = await this.agentProfileRepository.findOne({
        where: { userId: user.id },
        select: ['id'],
      });
      if (agentProfile) {
        const managing = await this.houseAgentRepository.count({
          where: houseIds.map((houseId) => ({
            houseId,
            agentId: agentProfile.id,
            status: HouseAgentStatus.ACTIVE,
          })),
        });
        if (managing > 0) return;
      }
    }

    throw new ForbiddenException('You do not have access to this exchange');
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
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Start date is invalid');
    }
    if (dto.agreedRent !== undefined && dto.agreedRent < 0) {
      throw new BadRequestException('Agreed rent cannot be negative');
    }

    let created = false;
    const tenancy = await this.dataSource.transaction(async (manager) => {
      const houseRepository = manager.getRepository(House);
      const tenantProfileRepository = manager.getRepository(TenantProfile);
      const tenancyRepository = manager.getRepository(Tenancy);

      const house = await houseRepository.findOne({
        where: { id: dto.houseId, ownerId: owner.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!house) {
        throw new ForbiddenException(
          'House not found or you are not the owner',
        );
      }

      const tenantProfile = await tenantProfileRepository.findOne({
        where: { userId: dto.tenantUserId },
      });

      if (!tenantProfile) throw new NotFoundException('Tenant not found');

      const activeHouseTenancy = await tenancyRepository.findOne({
        where: { houseId: dto.houseId, status: TenancyStatus.ACTIVE },
        lock: { mode: 'pessimistic_write' },
      });
      if (activeHouseTenancy) {
        if (activeHouseTenancy.tenantId === tenantProfile.id) {
          return activeHouseTenancy;
        }
        throw new BadRequestException(
          'This house already has an active tenant',
        );
      }

      const activeTenantTenancy = await tenancyRepository.findOne({
        where: { tenantId: tenantProfile.id, status: TenancyStatus.ACTIVE },
        lock: { mode: 'pessimistic_write' },
      });
      if (activeTenantTenancy) {
        throw new BadRequestException(
          'This tenant already has an active tenancy',
        );
      }

      const tenancy = tenancyRepository.create({
        houseId: dto.houseId,
        tenantId: tenantProfile.id,
        status: TenancyStatus.ACTIVE,
        startDate,
        agreedRent: dto.agreedRent ?? Number(house.rentAmount),
        currency: house.currency,
        paymentInstructions: dto.paymentInstructions?.trim() || null,
      });

      house.status = HouseStatus.RENTED;
      await houseRepository.save(house);
      created = true;
      return tenancyRepository.save(tenancy);
    });

    if (created) {
      await invalidateHouses(this.cacheManager, [tenancy.houseId]);
      await this.notificationsService.create(
        dto.tenantUserId,
        NotificationType.TENANCY_CONFIRMED,
        'Tenancy Confirmed',
        'The owner confirmed your tenancy. Your new home is now recorded on Nikupangishe.',
        { tenancyId: tenancy.id, houseId: tenancy.houseId },
      );
    }

    return tenancy;
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
        ? {
            id: t.house.id,
            title: t.house.title,
            city: t.house.city,
            area: t.house.area,
            images: t.house.photos ?? [],
          }
        : undefined,
      tenantId: t.tenantId,
      tenant: t.tenant?.user
        ? {
            id: t.tenant.user.id,
            firstName: t.tenant.user.firstName,
            lastName: t.tenant.user.lastName,
            email: t.tenant.user.email,
            phone: t.tenant.user.phone,
            avatar: t.tenant.user.avatar,
            profilePhoto: t.tenant.user.avatar,
          }
        : undefined,
      status: t.status,
      startDate: t.startDate ? t.startDate.toISOString() : null,
      endDate: t.endDate ? t.endDate.toISOString() : null,
      agreedRent: t.agreedRent ? Number(t.agreedRent) : null,
      currency: t.currency,
      agentCommissionRate: t.agentCommissionRate
        ? Number(t.agentCommissionRate)
        : null,
      commissionPaid: t.commissionPaid,
      paymentInstructions: t.paymentInstructions ?? null,
      notes: t.notes,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async getTenantTenancy(userId: string) {
    const tenantProfile = await this.tenantProfileRepository.findOne({
      where: { userId },
      select: ['id'],
    });

    if (!tenantProfile) return null;

    const tenancy = await this.tenancyRepository.findOne({
      where: {
        tenantId: tenantProfile.id,
        status: TenancyStatus.ACTIVE,
      },
      relations: ['house', 'tenant', 'tenant.user'],
      order: { createdAt: 'DESC' },
    });

    if (!tenancy) return null;

    return {
      id: tenancy.id,
      houseId: tenancy.houseId,
      house: tenancy.house
        ? {
            id: tenancy.house.id,
            title: tenancy.house.title,
            city: tenancy.house.city,
            area: tenancy.house.area,
            images: tenancy.house.photos ?? [],
          }
        : undefined,
      tenantId: tenancy.tenantId,
      tenant: tenancy.tenant?.user
        ? {
            id: tenancy.tenant.user.id,
            firstName: tenancy.tenant.user.firstName,
            lastName: tenancy.tenant.user.lastName,
            email: tenancy.tenant.user.email,
            phone: tenancy.tenant.user.phone,
            avatar: tenancy.tenant.user.avatar,
          }
        : undefined,
      status: tenancy.status,
      startDate: tenancy.startDate ? tenancy.startDate.toISOString() : null,
      endDate: tenancy.endDate ? tenancy.endDate.toISOString() : null,
      agreedRent:
        tenancy.agreedRent !== null && tenancy.agreedRent !== undefined
          ? Number(tenancy.agreedRent)
          : null,
      currency: tenancy.currency,
      agentCommissionRate:
        tenancy.agentCommissionRate !== null &&
        tenancy.agentCommissionRate !== undefined
          ? Number(tenancy.agentCommissionRate)
          : null,
      agentCommissionAmount:
        tenancy.agentCommissionAmount !== null &&
        tenancy.agentCommissionAmount !== undefined
          ? Number(tenancy.agentCommissionAmount)
          : undefined,
      commissionPaid: tenancy.commissionPaid,
      paymentInstructions: tenancy.paymentInstructions ?? null,
      notes: tenancy.notes,
      createdAt: tenancy.createdAt.toISOString(),
    };
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
