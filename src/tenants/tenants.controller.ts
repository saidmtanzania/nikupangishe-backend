import { Controller, Get, Put, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { UpdateTenantProfileDto } from './dto/tenant.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('Tenants')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  @Roles(UserRole.TENANT)
  @ApiOperation({
    summary: 'Get my tenant profile and active tenancy [TENANT]',
  })
  async getMyProfile(@CurrentUser() user: User) {
    return this.tenantsService.getMyProfile(user.id);
  }

  @Put('me')
  @Roles(UserRole.TENANT)
  @ApiOperation({ summary: 'Update my tenant profile [TENANT]' })
  async updateProfile(
    @Body() dto: UpdateTenantProfileDto,
    @CurrentUser() user: User,
  ) {
    return this.tenantsService.updateProfile(user.id, dto, user);
  }

  @Get('me/history')
  @Roles(UserRole.TENANT)
  @ApiOperation({ summary: 'Get my full tenancy history [TENANT]' })
  async getTenancyHistory(@CurrentUser() user: User) {
    return this.tenantsService.getTenancyHistory(user.id);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all tenants [ADMIN]' })
  async adminListTenants(
    @CurrentUser() user: User,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.tenantsService.adminListTenants(user, +page, +limit);
  }
}
