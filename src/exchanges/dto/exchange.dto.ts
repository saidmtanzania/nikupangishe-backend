import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExchangeType } from '../entities/exchange-request.entity';

export class CreateExchangeDto {
  @ApiProperty({ enum: ExchangeType })
  @IsEnum(ExchangeType)
  exchangeType: ExchangeType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetHouseId: string;

  @ApiPropertyOptional({ example: 'I want to move closer to my workplace.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ConfirmTenancyDto {
  @ApiProperty({ format: 'uuid', description: 'User id of the tenant' })
  @IsUUID()
  tenantUserId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  houseId: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: 450000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  agreedRent?: number;

  @ApiPropertyOptional({
    description: 'Payment details to share with the tenant',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  paymentInstructions?: string;
}
