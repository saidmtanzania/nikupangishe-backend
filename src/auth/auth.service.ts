/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User, UserStatus, UserRole } from '../users/entities/user.entity';
import { AgentProfile } from '../agents/entities/agent-profile.entity';
import { TenantProfile } from '../tenants/entities/tenant-profile.entity';
import { RegisterDto, LoginDto, ChangePasswordDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AgentProfile)
    private agentProfileRepository: Repository<AgentProfile>,
    @InjectRepository(TenantProfile)
    private tenantProfileRepository: Repository<TenantProfile>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, phone, role, password, firstName, lastName } = registerDto;

    // Check duplicate email/phone
    const existingUser = await this.userRepository.findOne({
      where: [{ email }, { phone }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('Email already registered');
      }
      throw new ConflictException('Phone number already registered');
    }

    // Prevent registering as admin directly
    if (role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot register as admin');
    }

    const user = this.userRepository.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      role,
      status: UserStatus.PENDING,
    });

    await this.userRepository.save(user);

    // Create role-specific profile
    if (role === UserRole.AGENT) {
      const agentProfile = this.agentProfileRepository.create({
        userId: user.id,
      });
      await this.agentProfileRepository.save(agentProfile);
    } else if (role === UserRole.TENANT) {
      const tenantProfile = this.tenantProfileRepository.create({
        userId: user.id,
      });
      await this.tenantProfileRepository.save(tenantProfile);
    }

    // Generate OTP for phone verification (in real app, send via SMS)
    const otp = this.generateOtp();
    user.phoneOtp = otp;
    user.phoneOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await this.userRepository.save(user);

    // TODO: Send OTP via SMS (integrate with Africa's Talking or similar)
    console.log(`OTP for ${phone}: ${otp}`); // Remove in production

    return {
      message: 'Registration successful. Please verify your phone number.',
      userId: user.id,
      // In dev mode, return OTP; remove in production
      ...(this.configService.get('app.nodeEnv') === 'development' && { otp }),
    };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) return null;

    const isValid = await user.comparePassword(password);
    if (!isValid) return null;

    return user;
  }

  async login(user: User) {
    if (!user.isPhoneVerified) {
      throw new UnauthorizedException('Please verify your phone number first');
    }

    if (
      user.status === UserStatus.SUSPENDED ||
      user.status === UserStatus.BANNED
    ) {
      throw new UnauthorizedException('Your account has been suspended');
    }

    const tokens = await this.generateTokens(user);

    // Save refresh token hash
    user.refreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async verifyPhone(phone: string, otp: string) {
    const user = await this.userRepository.findOne({ where: { phone } });

    if (!user) throw new NotFoundException('User not found');
    if (user.phoneOtp !== otp) throw new BadRequestException('Invalid OTP');
    if (new Date() > (user.phoneOtpExpiresAt as Date))
      throw new BadRequestException('OTP has expired');

    user.isPhoneVerified = true;
    user.status = UserStatus.ACTIVE;
    user.phoneOtp = null as any;
    user.phoneOtpExpiresAt = null as any;
    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);
    user.refreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await this.userRepository.save(user);

    return {
      message: 'Phone verified successfully',
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async resendOtp(phone: string) {
    const user = await this.userRepository.findOne({ where: { phone } });
    if (!user) throw new NotFoundException('User not found');
    if (user.isPhoneVerified)
      throw new BadRequestException('Phone already verified');

    const otp = this.generateOtp();
    user.phoneOtp = otp;
    user.phoneOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.userRepository.save(user);

    // TODO: Send via SMS
    console.log(`New OTP for ${phone}: ${otp}`);

    return {
      message: 'OTP sent successfully',
      ...(this.configService.get('app.nodeEnv') === 'development' && { otp }),
    };
  }

  async refreshToken(userId: string, refreshToken: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.refreshToken)
      throw new UnauthorizedException('Access denied');

    const isValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isValid) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.generateTokens(user);
    user.refreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await this.userRepository.save(user);

    return tokens;
  }

  async logout(userId: string) {
    await this.userRepository.update(userId, { refreshToken: null as any });
    return { message: 'Logged out successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await user.comparePassword(dto.currentPassword);
    if (!isValid)
      throw new BadRequestException('Current password is incorrect');

    user.password = dto.password;
    await this.userRepository.save(user);

    return { message: 'Password changed successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['agentProfile', 'tenantProfile'],
    });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitizeUser(user);
  }

  // Helpers
  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.secret'),
        expiresIn: this.configService.get('jwt.expiresIn'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('jwt.refreshSecret'),
        expiresIn: this.configService.get('jwt.refreshExpiresIn'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private sanitizeUser(user: User) {
    const {
      password,
      phoneOtp,
      phoneOtpExpiresAt,
      refreshToken,
      ...sanitized
    } = user;
    return sanitized;
  }
}
