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
  ViewingsService,
  CreateViewingDto,
  UpdateViewingDto,
} from './viewings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('Viewings')
@Controller('viewings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ViewingsController {
  constructor(private viewingsService: ViewingsService) {}

  @Post()
  @Roles(UserRole.TENANT)
  @ApiOperation({ summary: 'Request a house viewing [TENANT]' })
  async requestViewing(
    @Body() dto: CreateViewingDto,
    @CurrentUser() user: User,
  ) {
    return this.viewingsService.requestViewing(dto, user);
  }

  @Get('my-viewings')
  @ApiOperation({ summary: 'Get viewings for current user (role-based)' })
  async getMyViewings(@CurrentUser() user: User) {
    if (user.role === UserRole.AGENT) {
      // Need agent profile id - simplified
      return this.viewingsService.getViewingsForTenant(user.id);
    }
    if (user.role === UserRole.OWNER) {
      return this.viewingsService.getViewingsForOwner(user.id);
    }
    return this.viewingsService.getViewingsForTenant(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get viewing request details' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.viewingsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update viewing status (agent confirms, tenant cancels)',
  })
  async updateViewing(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateViewingDto,
    @CurrentUser() user: User,
  ) {
    return this.viewingsService.updateViewing(id, dto, user);
  }
}
