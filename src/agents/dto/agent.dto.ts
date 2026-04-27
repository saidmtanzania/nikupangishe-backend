import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AgentVerificationStatus } from '../entities/agent-profile.entity';

export class UpdateAgentProfileDto {
  @ApiPropertyOptional({ example: 'Masaki Realty' })
  @IsOptional()
  @IsString()
  agencyName?: string;

  @ApiPropertyOptional({ example: 'LIC-2024-001' })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'Experienced agent in Dar es Salaam' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ description: 'URL to uploaded national ID document' })
  @IsOptional()
  @IsString()
  nationalIdUrl?: string;

  @ApiPropertyOptional({ description: 'URL to uploaded license document' })
  @IsOptional()
  @IsString()
  licenseDocUrl?: string;

  @ApiPropertyOptional({ example: 5.0, description: 'Commission rate (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(40)
  commissionRate?: number;
}

export class VerifyAgentDto {
  @ApiPropertyOptional({ description: 'true to approve, false to reject' })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({ description: 'Required when approved=false' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class AgentFilterDto {
  @ApiPropertyOptional({ enum: AgentVerificationStatus })
  @IsOptional()
  @IsEnum(AgentVerificationStatus)
  verificationStatus?: AgentVerificationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
