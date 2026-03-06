/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

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
    let { email, phone, role, password, firstName, lastName } = registerDto;

    // Frontend sends 'name' as single field — split into firstName/lastName
    if (!firstName && !lastName && (registerDto as any).name) {
      const parts = ((registerDto as any).name as string).trim().split(/\s+/);
      firstName = parts[0] || 'User';
      lastName = parts.slice(1).join(' ') || '';
    }

    if (!firstName) {
      firstName = 'User';
    }
    if (!lastName) {
      lastName = '';
    }

    // Normalize phone: frontend may send 9 digits without +255 prefix or with spaces
    phone = phone.replace(/\s+/g, '');
    if (/^\d{9}$/.test(phone)) {
      phone = `+255${phone}`;
    } else if (/^0\d{9}$/.test(phone)) {
      phone = `+255${phone.slice(1)}`;
    } else if (/^255\d{9}$/.test(phone)) {
      phone = `+${phone}`;
    }

    // Default password if not provided (frontend first-step registration may not include it)
    if (!password) {
      password = 'Temp@' + Math.random().toString(36).slice(2, 10);
    }

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

    const otp = await this.issuePhoneOtp(user);

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
      const otp = await this.issuePhoneOtp(user);
      throw new UnauthorizedException({
        message:
          'Phone number not verified. We sent a new verification code to your phone.',
        errors: {
          code: 'PHONE_NOT_VERIFIED',
          requiresPhoneVerification: true,
          phone: user.phone,
          ...(this.configService.get('app.nodeEnv') === 'development' && {
            otp,
          }),
        },
      });
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
    // Normalize phone
    phone = phone.replace(/\s+/g, '');
    if (/^\d{9}$/.test(phone)) {
      phone = `+255${phone}`;
    } else if (/^0\d{9}$/.test(phone)) {
      phone = `+255${phone.slice(1)}`;
    } else if (/^255\d{9}$/.test(phone)) {
      phone = `+${phone}`;
    }

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
    // Normalize phone
    phone = phone.replace(/\s+/g, '');
    if (/^\d{9}$/.test(phone)) {
      phone = `+255${phone}`;
    } else if (/^0\d{9}$/.test(phone)) {
      phone = `+255${phone.slice(1)}`;
    } else if (/^255\d{9}$/.test(phone)) {
      phone = `+${phone}`;
    }

    const user = await this.userRepository.findOne({ where: { phone } });
    if (!user) throw new NotFoundException('User not found');
    if (user.isPhoneVerified)
      throw new BadRequestException('Phone already verified');

    const otp = await this.issuePhoneOtp(user);

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

  async forgotPassword(dto: ForgotPasswordDto) {
    // Determine the identifier: email, phone, or generic identifier field
    let email: string | undefined = dto.email;
    let phone: string | undefined = dto.phone;

    if (dto.identifier) {
      // Detect if identifier is email or phone
      if (dto.identifier.includes('@')) {
        email = dto.identifier;
      } else {
        phone = dto.identifier;
      }
    }

    if (!email && !phone) {
      throw new BadRequestException(
        'Please provide an email address or phone number',
      );
    }

    // Look up user by email or phone
    let user: User | null = null;
    if (email) {
      user = await this.userRepository.findOne({
        where: { email: email.toLowerCase() },
      });
    }
    if (!user && phone) {
      // Normalize phone
      let normalized = phone.replace(/\s/g, '');
      if (/^\d{9}$/.test(normalized)) {
        normalized = '+255' + normalized;
      } else if (/^0\d{9}$/.test(normalized)) {
        normalized = '+255' + normalized.slice(1);
      }
      user = await this.userRepository.findOne({
        where: { phone: normalized },
      });
    }

    // Always return success to prevent user enumeration
    if (!user) {
      return {
        message:
          'If an account with that email/phone exists, you will receive reset instructions.',
      };
    }

    // Generate a reset token (random hex string)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Store hashed token and expiry (1 hour)
    user.passwordResetToken = hashedToken;
    user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.userRepository.save(user);

    // TODO: Send the resetToken via email/SMS in production
    // For development, include the token in the response
    const isDev = this.configService.get('NODE_ENV') !== 'production';

    return {
      message:
        'If an account with that email/phone exists, you will receive reset instructions.',
      ...(isDev && {
        resetToken,
        resetUrl: `/auth/reset-password?token=${resetToken}`,
      }),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    // Hash the incoming token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(dto.token)
      .digest('hex');

    const user = await this.userRepository.findOne({
      where: { passwordResetToken: hashedToken },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt < new Date()
    ) {
      // Clear expired token
      user.passwordResetToken = null;
      user.passwordResetExpiresAt = null;
      await this.userRepository.save(user);
      throw new BadRequestException('Reset token has expired');
    }

    // Validate confirmPassword if provided
    if (dto.confirmPassword && dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Set new password and clear reset fields
    user.password = dto.newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    await this.userRepository.save(user);

    return { message: 'Password has been reset successfully' };
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
    // 4-digit OTP to match frontend verification UI
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private async issuePhoneOtp(user: User): Promise<string> {
    const otp = this.generateOtp();
    user.phoneOtp = otp;
    user.phoneOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.userRepository.save(user);
    // TODO: Send OTP via SMS provider
    console.log(`OTP for ${user.phone}: ${otp}`);
    return otp;
  }

  private sanitizeUser(user: User) {
    const { password, phoneOtp, phoneOtpExpiresAt, refreshToken, ...rest } =
      user;
    return {
      ...rest,
      // Frontend-compatible fields
      name: `${user.firstName} ${user.lastName}`.trim(),
      avatar: user.avatar || null,
      isVerified: user.isPhoneVerified,
    };
  }
}
