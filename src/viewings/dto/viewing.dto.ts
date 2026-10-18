import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ViewingStatus } from '../entities/viewing-request.entity';

export class CreateViewingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  houseId: string;

  @ApiProperty({ example: '2026-11-01T10:00:00.000Z' })
  @IsDateString()
  preferredDate: string;

  @ApiPropertyOptional({ example: 'Can I come on Saturday morning?' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  tenantMessage?: string;
}

export class UpdateViewingDto {
  @ApiPropertyOptional({ enum: ViewingStatus })
  @IsOptional()
  @IsEnum(ViewingStatus)
  status?: ViewingStatus;

  @ApiPropertyOptional({ example: '2026-11-01T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  confirmedDate?: string;

  @ApiPropertyOptional({ description: "Agent's report after the viewing" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  agentNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  tenantInterestedAfterViewing?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cancellationReason?: string;
}

export class ApproveTenantDto {
  @ApiProperty({
    example: 'Pay to M-Pesa 0712 000 000 (Juma Owner). Reference: Plot 12.',
    description:
      'Official payment details shared with the approved tenant. Rent is always paid directly to the owner.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  paymentInstructions: string;

  @ApiPropertyOptional({ example: '2026-11-15' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: 450000,
    description:
      'Monthly rent agreed with the tenant. Defaults to the listing rent.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  agreedRent?: number;
}
