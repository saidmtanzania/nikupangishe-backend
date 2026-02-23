import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  Min,
  Max,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { HouseType, FurnishingStatus } from '../entities/house.entity';

export class CreateHouseDto {
  @ApiProperty({ example: 'Spacious 2BR Apartment in Masaki' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: HouseType })
  @IsEnum(HouseType)
  houseType: HouseType;

  @ApiProperty({ enum: FurnishingStatus })
  @IsEnum(FurnishingStatus)
  furnishingStatus: FurnishingStatus;

  @ApiProperty({ example: 'Plot 45, Haile Selassie Road' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'Masaki' })
  @IsString()
  @IsNotEmpty()
  area: string;

  @ApiProperty({ example: 'Dar es Salaam' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: -6.7734 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: 39.2687 })
  @IsNumber()
  longitude: number;

  @ApiProperty({ example: 800000 })
  @IsNumber()
  @Min(0)
  rentAmount: number;

  @ApiPropertyOptional({ example: 'TZS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  depositMonths?: number;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(1)
  bedrooms: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  bathrooms: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  parkingSpaces?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasWater?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasElectricity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasInternet?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasGarden?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasSecurityGuard?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasCCTV?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  petFriendly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  availableFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minimumLeaseDuration?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  amenities?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  rules?: string[];
}

export class UpdateHouseDto extends PartialType(CreateHouseDto) {}

export class HouseFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional({ enum: HouseType })
  @IsOptional()
  @IsEnum(HouseType)
  houseType?: HouseType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minRent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxRent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bedrooms?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bathrooms?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasWater?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasElectricity?: boolean;

  // Pagination
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(100)
  limit?: number = 20;

  // GPS-based proximity search
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ description: 'Radius in km', default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  radius?: number;
}

export class AssignAgentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  agentId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  customCommissionRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class VerifyHouseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Required if approved is false' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
