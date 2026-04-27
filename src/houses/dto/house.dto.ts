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

  @ApiPropertyOptional({
    enum: HouseType,
    description: 'House type (also accepts frontend propertyType values)',
  })
  @IsOptional()
  @IsString()
  houseType?: string;

  @ApiPropertyOptional({
    description: 'Frontend-compatible property type alias',
  })
  @IsOptional()
  @IsString()
  propertyType?: string;

  @ApiPropertyOptional({ enum: FurnishingStatus })
  @IsOptional()
  @IsEnum(FurnishingStatus)
  furnishingStatus?: FurnishingStatus;

  @ApiPropertyOptional({ example: 'Plot 45, Haile Selassie Road' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    example: 'Masaki',
    description: 'Neighborhood/ward name',
  })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional({ example: 'Dar es Salaam' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: -6.7734 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 39.2687 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    example: 800000,
    description: 'Monthly rent (backend: rentAmount, frontend: price)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rentAmount?: number;

  @ApiPropertyOptional({
    example: 800000,
    description: 'Frontend price field (alias for rentAmount)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'TZS' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  depositMonths?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bedrooms?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bathrooms?: number;

  @ApiPropertyOptional({
    description: 'Square meters (frontend sends as area)',
  })
  @IsOptional()
  @IsNumber()
  squareMeters?: number;

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

  @ApiPropertyOptional({
    type: [String],
    description: 'Image URLs (frontend sends as images)',
  })
  @IsOptional()
  @IsArray()
  images?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isUnique?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOpenToExchange?: boolean;

  // Frontend may send location as nested object
  @ApiPropertyOptional({
    description: 'Location object { lat, lng, neighborhood, city }',
  })
  @IsOptional()
  location?: { lat: number; lng: number; neighborhood: string; city: string };

  // Verification evidence — owner submits these for admin review
  @ApiPropertyOptional({ description: 'Video URL uploaded by owner for admin verification' })
  @IsOptional()
  @IsString()
  verificationVideoUrl?: string;

  @ApiPropertyOptional({ description: 'Written note from owner to admin to support verification' })
  @IsOptional()
  @IsString()
  ownerVerificationNote?: string;
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

  @ApiPropertyOptional({
    description: 'House type or comma-separated property types',
  })
  @IsOptional()
  @IsString()
  houseType?: string;

  @ApiPropertyOptional({
    description: 'Frontend-compatible type filter (comma-separated)',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minRent?: number;

  @ApiPropertyOptional({ description: 'Frontend alias for minRent' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxRent?: number;

  @ApiPropertyOptional({ description: 'Frontend alias for maxRent' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

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

  @ApiPropertyOptional({ description: 'Only verified houses' })
  @IsOptional()
  @IsString()
  verified?: string;

  @ApiPropertyOptional({ description: 'Only houses open to exchange' })
  @IsOptional()
  @IsString()
  swapOnly?: string;

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

  // Text search
  @ApiPropertyOptional({
    description: 'Search query (matches title, neighborhood, city)',
  })
  @IsOptional()
  @IsString()
  q?: string;
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
