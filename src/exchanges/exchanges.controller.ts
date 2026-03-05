/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  ExchangesService,
  CreateExchangeDto,
  ConfirmTenancyDto,
} from './exchanges.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('Exchanges & Moves')
@Controller('exchanges')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ExchangesController {
  constructor(private exchangesService: ExchangesService) {}

  @Post()
  @Roles(UserRole.TENANT)
  @ApiOperation({ summary: 'Request a move or house exchange [TENANT]' })
  async createExchange(
    @Body() dto: CreateExchangeDto,
    @CurrentUser() user: User,
  ) {
    return this.exchangesService.createExchangeRequest(dto, user);
  }

  @Get('my-exchanges')
  @ApiOperation({
    summary: 'Get exchanges related to current user (role-based)',
  })
  async getMyExchanges(@CurrentUser() user: User) {
    if (user.role === UserRole.OWNER) {
      return this.exchangesService.getExchangesForOwner(user.id);
    }
    if (user.role === UserRole.TENANT) {
      return this.exchangesService.getExchangesForTenantUser(user.id);
    }
    return [];
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get exchange request details' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.exchangesService.findOneFormatted(id);
  }

  @Patch(':id/approve')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Owner approves an exchange request [OWNER]' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.exchangesService.ownerApprove(id, user);
  }

  @Patch(':id/reject')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Owner rejects an exchange request [OWNER]' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body('reason') reason: string,
  ) {
    return this.exchangesService.ownerReject(id, user, reason);
  }

  // Confirm tenancy - owner confirms a tenant lives in the house
  @Post('confirm-tenancy')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary:
      'Owner confirms tenant occupancy - creates official tenancy record [OWNER]',
  })
  async confirmTenancy(
    @Body() dto: ConfirmTenancyDto,
    @CurrentUser() user: User,
  ) {
    return this.exchangesService.confirmTenancy(dto, user);
  }
}
