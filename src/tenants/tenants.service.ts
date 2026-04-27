import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantProfile } from './entities/tenant-profile.entity';
import { Tenancy } from '../houses/entities/tenancy.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { UpdateTenantProfileDto } from './dto/tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(TenantProfile)
    private tenantProfileRepository: Repository<TenantProfile>,
    @InjectRepository(Tenancy)
    private tenancyRepository: Repository<Tenancy>,
  ) {}

  async getMyProfile(userId: string) {
    const profile = await this.tenantProfileRepository.findOne({
      where: { userId },
      relations: ['user', 'tenancies', 'tenancies.house'],
    });
    if (!profile) throw new NotFoundException('Tenant profile not found');

    const activeTenancy =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      profile.tenancies?.find((t) => t.status === 'active') ?? null;

    return {
      ...profile,
      activeTenancy,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateTenantProfileDto,
    requestingUser: User,
  ) {
    const profile = await this.tenantProfileRepository.findOne({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Tenant profile not found');

    if (profile.userId !== requestingUser.id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    Object.assign(profile, dto);
    return this.tenantProfileRepository.save(profile);
  }

  async getTenancyHistory(userId: string) {
    const profile = await this.tenantProfileRepository.findOne({
      where: { userId },
      select: ['id'],
    });
    if (!profile) throw new NotFoundException('Tenant profile not found');

    return this.tenancyRepository.find({
      where: { tenantId: profile.id },
      relations: ['house', 'house.owner'],
      order: { startDate: 'DESC' },
    });
  }

  async adminListTenants(admin: User, page = 1, limit = 20) {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    const [profiles, total] = await this.tenantProfileRepository.findAndCount({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: profiles,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
