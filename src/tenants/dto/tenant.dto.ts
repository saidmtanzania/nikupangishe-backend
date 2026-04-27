import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTenantProfileDto {
  @ApiPropertyOptional({ example: 'Tanzania Breweries' })
  @IsOptional()
  @IsString()
  employerName?: string;

  @ApiPropertyOptional({ example: '+255712345678' })
  @IsOptional()
  @IsString()
  employerPhone?: string;

  @ApiPropertyOptional({ example: 'Additional notes about the tenant' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'URL to uploaded national ID' })
  @IsOptional()
  @IsString()
  nationalIdUrl?: string;
}
