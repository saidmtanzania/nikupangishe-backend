import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { House, HouseStatus } from './entities/house.entity';
import { HouseAgent, HouseAgentStatus } from './entities/house-agent.entity';
import {
  AgentProfile,
  AgentVerificationStatus,
} from '../agents/entities/agent-profile.entity';
import { User, UserRole } from '../users/entities/user.entity';
import {
  CreateHouseDto,
  UpdateHouseDto,
  HouseFilterDto,
  AssignAgentDto,
  VerifyHouseDto,
} from './dto/house.dto';

@Injectable()
export class HousesService {
  constructor(
    @InjectRepository(House)
    private houseRepository: Repository<House>,
    @InjectRepository(HouseAgent)
    private houseAgentRepository: Repository<HouseAgent>,
    @InjectRepository(AgentProfile)
    private agentProfileRepository: Repository<AgentProfile>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async create(createHouseDto: CreateHouseDto, owner: User) {
    if (owner.role !== UserRole.OWNER && owner.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only property owners can list houses');
    }

    // Check for duplicate listing by proximity (within 20m radius)
    const nearby = await this.checkForDuplicateByGPS(
      createHouseDto.latitude,
      createHouseDto.longitude,
      owner.id,
    );

    if (nearby) {
      throw new ConflictException(
        'A house already exists at this location. Duplicate listings are not allowed.',
      );
    }

    const house = this.houseRepository.create({
      ...createHouseDto,
      ownerId: owner.id,
      status: HouseStatus.PENDING_VERIFICATION,
    });

    const saved = await this.houseRepository.save(house);
    await this.invalidateListingsCache();
    return saved;
  }

  async findAll(filters: HouseFilterDto) {
    const cacheKey = `houses:list:${JSON.stringify(filters)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const qb = this.houseRepository
      .createQueryBuilder('house')
      .leftJoinAndSelect('house.owner', 'owner')
      .leftJoinAndSelect(
        'house.agentAssignments',
        'assignments',
        'assignments.status = :active',
        {
          active: HouseAgentStatus.ACTIVE,
        },
      )
      .leftJoinAndSelect('assignments.agent', 'agent')
      .leftJoinAndSelect('agent.user', 'agentUser')
      .where('house.status = :status', { status: HouseStatus.ACTIVE });

    this.applyFilters(qb, filters);

    const { page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const [houses, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const result = {
      data: houses,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cacheManager.set(cacheKey, result, 300); // Cache 5 mins
    return result;
  }

  async findOne(id: string, isPublic = false): Promise<House> {
    const cacheKey = `house:${id}`;
    if (isPublic) {
      const cached = await this.cacheManager.get<House>(cacheKey);
      if (cached) return cached;
    }

    const house = await this.houseRepository.findOne({
      where: { id },
      relations: [
        'owner',
        'agentAssignments',
        'agentAssignments.agent',
        'agentAssignments.agent.user',
        'tenancies',
      ],
    });

    if (!house) throw new NotFoundException('House not found');

    if (isPublic && house.status !== HouseStatus.ACTIVE) {
      throw new NotFoundException('House not found or not available');
    }

    if (isPublic) {
      await this.cacheManager.set(cacheKey, house, 300);
    }

    return house;
  }

  async update(id: string, updateDto: UpdateHouseDto, user: User) {
    const house = await this.findOne(id);
    this.assertOwnership(house, user);

    // If owner updates details, put back to pending verification
    const needsReverification = !!(
      updateDto.address ||
      updateDto.latitude ||
      updateDto.longitude
    );

    Object.assign(house, updateDto);

    if (needsReverification && house.status === HouseStatus.ACTIVE) {
      house.status = HouseStatus.PENDING_VERIFICATION;
    }

    const updated = await this.houseRepository.save(house);
    await this.invalidateHouseCache(id);
    return updated;
  }

  async remove(id: string, user: User) {
    const house = await this.findOne(id);
    this.assertOwnership(house, user);
    house.status = HouseStatus.INACTIVE;
    await this.houseRepository.save(house);
    await this.invalidateHouseCache(id);
    return { message: 'House deactivated successfully' };
  }

  async assignAgent(houseId: string, dto: AssignAgentDto, owner: User) {
    const house = await this.findOne(houseId);
    this.assertOwnership(house, owner);

    const agent = await this.agentProfileRepository.findOne({
      where: { id: dto.agentId },
    });

    if (!agent) throw new NotFoundException('Agent not found');

    if (agent.verificationStatus !== AgentVerificationStatus.VERIFIED) {
      throw new BadRequestException('Agent is not verified');
    }

    // Check existing assignment
    const existing = await this.houseAgentRepository.findOne({
      where: { houseId, agentId: dto.agentId, status: HouseAgentStatus.ACTIVE },
    });

    if (existing)
      throw new ConflictException('Agent already assigned to this house');

    // If setting as primary, unset others
    if (dto.isPrimary) {
      await this.houseAgentRepository.update(
        { houseId, status: HouseAgentStatus.ACTIVE },
        { isPrimary: false },
      );
    }

    const assignment = this.houseAgentRepository.create({
      houseId,
      agentId: dto.agentId,
      customCommissionRate: dto.customCommissionRate,
      isPrimary: dto.isPrimary ?? false,
      notes: dto.notes,
    });

    return this.houseAgentRepository.save(assignment);
  }

  async removeAgent(houseId: string, agentId: string, owner: User) {
    const house = await this.findOne(houseId);
    this.assertOwnership(house, owner);

    const assignment = await this.houseAgentRepository.findOne({
      where: { houseId, agentId, status: HouseAgentStatus.ACTIVE },
    });

    if (!assignment) throw new NotFoundException('Agent assignment not found');

    assignment.status = HouseAgentStatus.REMOVED;
    return this.houseAgentRepository.save(assignment);
  }

  async verifyHouse(id: string, dto: VerifyHouseDto, admin: User) {
    if (admin.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin access required');

    const house = await this.findOne(id);

    if (house.status !== HouseStatus.PENDING_VERIFICATION) {
      throw new BadRequestException('House is not pending verification');
    }

    if (dto.approved) {
      house.status = HouseStatus.ACTIVE;
      house.verifiedAt = new Date();
      house.verifiedBy = admin.id;
      house.verificationNotes = dto.notes ?? '';
    } else {
      if (!dto.rejectionReason) {
        throw new BadRequestException('Rejection reason is required');
      }
      house.status = HouseStatus.REJECTED;
      house.rejectionReason = dto.rejectionReason;
    }

    const updated = await this.houseRepository.save(house);
    await this.invalidateListingsCache();
    return updated;
  }

  async getOwnerHouses(ownerId: string) {
    return this.houseRepository.find({
      where: { ownerId },
      relations: [
        'agentAssignments',
        'agentAssignments.agent',
        'agentAssignments.agent.user',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async getPendingVerification(admin: User) {
    if (admin.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin access required');
    return this.houseRepository.find({
      where: { status: HouseStatus.PENDING_VERIFICATION },
      relations: ['owner'],
      order: { createdAt: 'ASC' },
    });
  }

  // Private helpers
  private assertOwnership(house: House, user: User) {
    if (house.ownerId !== user.id && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not own this house');
    }
  }

  private applyFilters(qb: SelectQueryBuilder<House>, filters: HouseFilterDto) {
    if (filters.city) {
      qb.andWhere('LOWER(house.city) = LOWER(:city)', { city: filters.city });
    }
    if (filters.area) {
      qb.andWhere('LOWER(house.area) LIKE LOWER(:area)', {
        area: `%${filters.area}%`,
      });
    }
    if (filters.houseType) {
      qb.andWhere('house.houseType = :type', { type: filters.houseType });
    }
    if (filters.minRent !== undefined) {
      qb.andWhere('house.rentAmount >= :minRent', { minRent: filters.minRent });
    }
    if (filters.maxRent !== undefined) {
      qb.andWhere('house.rentAmount <= :maxRent', { maxRent: filters.maxRent });
    }
    if (filters.bedrooms !== undefined) {
      qb.andWhere('house.bedrooms = :bedrooms', { bedrooms: filters.bedrooms });
    }
    if (filters.bathrooms !== undefined) {
      qb.andWhere('house.bathrooms = :bathrooms', {
        bathrooms: filters.bathrooms,
      });
    }
    if (filters.hasWater !== undefined) {
      qb.andWhere('house.hasWater = :hasWater', { hasWater: filters.hasWater });
    }
    if (filters.hasElectricity !== undefined) {
      qb.andWhere('house.hasElectricity = :hasElectricity', {
        hasElectricity: filters.hasElectricity,
      });
    }

    // GPS proximity search using Haversine formula in PostgreSQL
    if (filters.lat && filters.lng) {
      const radius = filters.radius || 5;
      qb.andWhere(
        `(6371 * acos(cos(radians(:lat)) * cos(radians(house.latitude)) * cos(radians(house.longitude) - radians(:lng)) + sin(radians(:lat)) * sin(radians(house.latitude)))) <= :radius`,
        { lat: filters.lat, lng: filters.lng, radius },
      );
    }
  }

  private async checkForDuplicateByGPS(
    lat: number,
    lng: number,
    ownerId: string,
  ) {
    // Check within ~20 meters radius
    const result = await this.houseRepository
      .createQueryBuilder('house')
      .where('house.ownerId = :ownerId', { ownerId })
      .andWhere('house.status != :inactive', { inactive: HouseStatus.INACTIVE })
      .andWhere(
        `(6371000 * acos(cos(radians(:lat)) * cos(radians(house.latitude)) * cos(radians(house.longitude) - radians(:lng)) + sin(radians(:lat)) * sin(radians(house.latitude)))) <= 20`,
        { lat, lng },
      )
      .getOne();

    return result;
  }

  private async invalidateHouseCache(id: string) {
    await this.cacheManager.del(`house:${id}`);
    await this.invalidateListingsCache();
  }

  private async invalidateListingsCache() {
    // In production, use Redis scan to delete pattern
    // For now, delete common cache keys
    const keys = ['houses:list:{}'];
    await Promise.all(keys.map((k) => this.cacheManager.del(k)));
  }
}
