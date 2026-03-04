/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
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
import { House, HouseStatus, HouseType } from './entities/house.entity';
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

    // Normalize frontend fields
    this.normalizeHouseDto(createHouseDto);

    const latitude = createHouseDto.latitude;
    const longitude = createHouseDto.longitude;

    if (latitude && longitude) {
      // Check for duplicate listing by proximity (within 20m radius)
      const nearby = await this.checkForDuplicateByGPS(
        latitude,
        longitude,
        owner.id,
      );

      if (nearby) {
        throw new ConflictException(
          'A house already exists at this location. Duplicate listings are not allowed.',
        );
      }
    }

    const house = this.houseRepository.create({
      title: createHouseDto.title,
      description: createHouseDto.description,
      houseType: (createHouseDto.houseType ||
        createHouseDto.propertyType) as HouseType,
      furnishingStatus: createHouseDto.furnishingStatus,
      address: createHouseDto.address,
      area: createHouseDto.area,
      city: createHouseDto.city,
      latitude: createHouseDto.latitude,
      longitude: createHouseDto.longitude,
      rentAmount: createHouseDto.rentAmount ?? createHouseDto.price,
      currency: createHouseDto.currency,
      depositMonths: createHouseDto.depositMonths,
      bedrooms: createHouseDto.bedrooms,
      bathrooms: createHouseDto.bathrooms,
      parkingSpaces: createHouseDto.parkingSpaces,
      hasWater: createHouseDto.hasWater,
      hasElectricity: createHouseDto.hasElectricity,
      hasInternet: createHouseDto.hasInternet,
      hasGarden: createHouseDto.hasGarden,
      hasSecurityGuard: createHouseDto.hasSecurityGuard,
      hasCCTV: createHouseDto.hasCCTV,
      petFriendly: createHouseDto.petFriendly,
      photos: (createHouseDto as any).photos ?? createHouseDto.images ?? [],
      videos: (createHouseDto as any).videos ?? [],
      availableFrom: createHouseDto.availableFrom,
      minimumLeaseDuration: createHouseDto.minimumLeaseDuration,
      amenities: createHouseDto.amenities,
      rules: createHouseDto.rules,
      isUnique: createHouseDto.isUnique,
      isOpenToExchange: createHouseDto.isOpenToExchange,
      squareMeters: createHouseDto.squareMeters,
      ownerId: owner.id,
      status: HouseStatus.PENDING_VERIFICATION,
    });

    const saved = await this.houseRepository.save(house);
    await this.invalidateListingsCache();
    return this.toFrontendFormat(saved);
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
      data: houses.map((h) => this.toFrontendFormat(h)),
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

  async findOne(id: string, isPublic = false): Promise<any> {
    const cacheKey = `house:${id}`;
    if (isPublic) {
      const cached = await this.cacheManager.get<House>(cacheKey);
      if (cached) return this.toFrontendFormat(cached);
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

    return this.toFrontendFormat(house);
  }

  async update(id: string, updateDto: UpdateHouseDto, user: User) {
    const house = await this.findOneRaw(id);
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
    const house = await this.findOneRaw(id);
    this.assertOwnership(house, user);
    house.status = HouseStatus.INACTIVE;
    await this.houseRepository.save(house);
    await this.invalidateHouseCache(id);
    return { message: 'House deactivated successfully' };
  }

  async assignAgent(houseId: string, dto: AssignAgentDto, owner: User) {
    const house = await this.findOneRaw(houseId);
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
    const house = await this.findOneRaw(houseId);
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

    const house = await this.findOneRaw(id);

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

  /**
   * Add photos/images to a house (used by upload endpoints).
   */
  async addPhotos(id: string, urls: string[]): Promise<void> {
    const house = await this.houseRepository.findOneBy({ id });
    if (!house) throw new NotFoundException('House not found');
    house.photos = [...(house.photos || []), ...urls];
    await this.houseRepository.save(house);
    await this.invalidateHouseCache(id);
  }

  /**
   * Get raw house entity by ID (for internal use, not frontend-formatted).
   */
  async findOneRaw(id: string): Promise<House> {
    const house = await this.houseRepository.findOne({
      where: { id },
      relations: ['owner', 'agentAssignments'],
    });
    if (!house) throw new NotFoundException('House not found');
    return house;
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

    // Text search (frontend sends 'q' param)
    if (filters.q) {
      qb.andWhere(
        '(LOWER(house.title) LIKE LOWER(:q) OR LOWER(house.area) LIKE LOWER(:q) OR LOWER(house.city) LIKE LOWER(:q))',
        { q: `%${filters.q}%` },
      );
    }

    // Support both houseType and type (frontend sends comma-separated types)
    const typeFilter = filters.houseType || filters.type;
    if (typeFilter) {
      const types = typeFilter.split(',').map((t) => t.trim());
      qb.andWhere('house.houseType IN (:...types)', { types });
    }

    // Support both minRent/maxRent and minPrice/maxPrice (frontend aliases)
    const minRent = filters.minRent ?? filters.minPrice;
    const maxRent = filters.maxRent ?? filters.maxPrice;
    if (minRent !== undefined) {
      qb.andWhere('house.rentAmount >= :minRent', { minRent });
    }
    if (maxRent !== undefined) {
      qb.andWhere('house.rentAmount <= :maxRent', { maxRent });
    }
    if (filters.bedrooms !== undefined) {
      qb.andWhere('house.bedrooms >= :bedrooms', {
        bedrooms: filters.bedrooms,
      });
    }
    if (filters.bathrooms !== undefined) {
      qb.andWhere('house.bathrooms >= :bathrooms', {
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

    // Frontend verified filter
    if (filters.verified === 'true') {
      // Already filtered by ACTIVE status which means verified
    }

    // Frontend swap-only filter
    if (filters.swapOnly === 'true') {
      qb.andWhere('house.isOpenToExchange = true');
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

  /**
   * Normalize incoming DTO from frontend field names to backend columns.
   * Frontend sends: price, images, propertyType, location object, area (sqm)
   * Backend expects: rentAmount, photos, houseType, lat/lng/area/city, squareMeters
   */
  private normalizeHouseDto(dto: any): void {
    // price -> rentAmount
    if (dto.price !== undefined && dto.rentAmount === undefined) {
      dto.rentAmount = dto.price;
    }
    // images -> photos
    if (dto.images !== undefined && dto.photos === undefined) {
      dto.photos = dto.images;
    }
    // propertyType -> houseType
    if (dto.propertyType !== undefined && dto.houseType === undefined) {
      dto.houseType = dto.propertyType;
    }
    // location object -> flat fields
    if (dto.location && typeof dto.location === 'object') {
      if (dto.location.lat !== undefined && dto.latitude === undefined) {
        dto.latitude = dto.location.lat;
      }
      if (dto.location.lng !== undefined && dto.longitude === undefined) {
        dto.longitude = dto.location.lng;
      }
      if (dto.location.neighborhood && dto.area === undefined) {
        dto.area = dto.location.neighborhood;
      }
      if (dto.location.city && dto.city === undefined) {
        dto.city = dto.location.city;
      }
      if (dto.location.address && dto.address === undefined) {
        dto.address = dto.location.address;
      }
    }
    // area (number = sqm) -> squareMeters (if area is a number, not a string neighborhood)
    if (typeof dto.area === 'number') {
      dto.squareMeters = dto.area;
      delete dto.area; // remove so it doesn't conflict with area (neighborhood string)
    }
  }

  /**
   * Transform a House entity to the frontend Property interface shape.
   */
  private toFrontendFormat(house: House): any {
    // Map backend status to frontend status
    let frontendStatus: 'available' | 'occupied' | 'pending' = 'pending';
    if (house.status === HouseStatus.ACTIVE) {
      frontendStatus = 'available';
    } else if (house.status === HouseStatus.RENTED) {
      frontendStatus = 'occupied';
    } else if (
      house.status === HouseStatus.DRAFT ||
      house.status === HouseStatus.PENDING_VERIFICATION
    ) {
      frontendStatus = 'pending';
    }

    // Get primary agent ID if available
    let agentId: string | undefined;
    if (house.agentAssignments && house.agentAssignments.length > 0) {
      const primary = house.agentAssignments.find((a) => a.isPrimary);
      agentId = primary ? primary.agentId : house.agentAssignments[0].agentId;
    }

    return {
      id: house.id,
      title: house.title,
      description: house.description,
      // Pricing – expose both names so mobile can use either
      rentAmount: Number(house.rentAmount),
      price: Number(house.rentAmount),
      currency: house.currency,
      depositMonths: house.depositMonths,
      // Location – flat fields for mobile UI + nested for map consumers
      address: house.address || '',
      area: house.area || '',          // neighbourhood string
      city: house.city || '',
      latitude: Number(house.latitude),
      longitude: Number(house.longitude),
      location: {
        lat: Number(house.latitude),
        lng: Number(house.longitude),
        neighborhood: house.area || '',
        city: house.city || '',
      },
      // Media
      images: house.photos || [],
      // Size / features
      bedrooms: house.bedrooms,
      bathrooms: house.bathrooms,
      squareMeters: house.squareMeters ? Number(house.squareMeters) : undefined,
      // Type – expose both names
      houseType: house.houseType,
      propertyType: house.houseType,
      furnishingStatus: house.furnishingStatus,
      amenities: house.amenities || [],
      // Booleans
      hasWater: house.hasWater,
      hasElectricity: house.hasElectricity,
      hasInternet: house.hasInternet,
      hasGarden: house.hasGarden,
      hasSecurityGuard: house.hasSecurityGuard,
      hasCCTV: house.hasCCTV,
      petFriendly: house.petFriendly,
      // Flags
      isVerified: house.status === HouseStatus.ACTIVE && !!house.verifiedAt,
      isUnique: house.isUnique || false,
      isOpenToExchange: house.isOpenToExchange || false,
      // Relations
      ownerId: house.ownerId,
      agentId,
      // Status
      status: frontendStatus,
      createdAt: house.createdAt
        ? house.createdAt.toISOString()
        : new Date().toISOString(),
    };
  }
}
