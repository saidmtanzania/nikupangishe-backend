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
import { Tenancy, TenancyStatus } from '../houses/entities/tenancy.entity';
import { House, HouseStatus } from '../houses/entities/house.entity';
import { TenantProfile } from '../tenants/entities/tenant-profile.entity';
import { User } from '../users/entities/user.entity';

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

    return this.exchangeRepository.save(exchange);
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
    return this.exchangeRepository.save(exchange);
  }

  private async completeExchange(exchangeId: string) {
    const exchange = await this.findOne(exchangeId);

    // End current tenancies
    await this.tenancyRepository.update(exchange.initiatorTenancyId, {
      status: TenancyStatus.TRANSFERRED,
      endDate: new Date(),
    });

    if (exchange.targetTenancyId) {
      await this.tenancyRepository.update(exchange.targetTenancyId, {
        status: TenancyStatus.TRANSFERRED,
        endDate: new Date(),
      });
    }

    exchange.status = ExchangeStatus.COMPLETED;
    exchange.completedAt = new Date();
    return this.exchangeRepository.save(exchange);
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
