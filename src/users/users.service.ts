/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import {
  UpdateUserDto,
  AdminUpdateUserDto,
  AdminChangeRoleDto,
  UserFilterDto,
} from './dto/user.dto';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
  ) {}

  async getMyProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['agentProfile', 'tenantProfile'],
    });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitize(user);
  }

  async updateMyProfile(userId: string, dto: UpdateUserDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.avatar !== undefined) user.avatar = dto.avatar;

    const saved = await this.userRepository.save(user);
    return this.sanitize(saved);
  }

  async adminListUsers(admin: User, filters: UserFilterDto) {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    const { role, status, page = 1, limit = 20 } = filters;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.email',
        'user.phone',
        'user.role',
        'user.status',
        'user.isPhoneVerified',
        'user.createdAt',
        'user.lastLoginAt',
      ])
      .orderBy('user.createdAt', 'DESC');

    if (role) qb.andWhere('user.role = :role', { role });
    if (status) qb.andWhere('user.status = :status', { status });

    const [users, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async adminUpdateUserStatus(
    admin: User,
    targetUserId: string,
    dto: AdminUpdateUserDto,
  ) {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }

    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot modify another admin account');
    }

    if (dto.status !== undefined) user.status = dto.status;

    const saved = await this.userRepository.save(user);
    return this.sanitize(saved);
  }

  async adminChangeRole(
    admin: User,
    targetUserId: string,
    dto: AdminChangeRoleDto,
  ) {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot modify another admin account');
    }
    user.role = dto.role;
    const saved = await this.userRepository.save(user);
    return this.sanitize(saved);
  }

  async adminSendPasswordReset(admin: User, targetUserId: string) {
    if (admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot reset another admin account');
    }
    return this.authService.forgotPassword({ email: user.email });
  }

  private sanitize(user: User): Partial<User> {
    const {
      password,
      refreshToken,
      phoneOtp,
      phoneOtpExpiresAt,
      passwordResetToken,
      passwordResetExpiresAt,
      ...safe
    } = user as any;
    return safe;
  }
}
