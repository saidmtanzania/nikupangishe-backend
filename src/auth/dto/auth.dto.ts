import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity';

export class RegisterDto {
  @ApiPropertyOptional({
    example: 'John',
    description: 'First name (used if name is not provided)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    example: 'Doe',
    description: 'Last name (used if name is not provided)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    example: 'John Doe',
    description: 'Full name (will be split into firstName/lastName)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '+255712345678',
    description: 'Accepts +255XXXXXXXXX or 9-digit format',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({
    example: 'Password@123',
    minLength: 6,
    description: 'Optional for frontend first-step registration',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.TENANT })
  @IsEnum(UserRole)
  role: UserRole;
}

export class LoginDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Password@123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class VerifyPhoneDto {
  @ApiProperty({ example: '+255712345678' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({
    example: '1234',
    description: '4-digit verification code (preferred field)',
  })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(4)
  code?: string;

  @ApiPropertyOptional({
    example: '1234',
    description: 'Legacy OTP field for backward compatibility',
  })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(4)
  otp?: string;
}

export class ResendCodeDto {
  @ApiProperty({ example: '+255712345678' })
  @IsString()
  @IsNotEmpty()
  phone: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiPropertyOptional({
    example: 'john@example.com',
    description: 'Email address (provide email or phone)',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '+255712345678',
    description: 'Phone number (provide email or phone)',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Can send email or phone in a single identifier field',
  })
  @IsOptional()
  @IsString()
  identifier?: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  confirmPassword?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
