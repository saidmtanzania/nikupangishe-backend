import {
  Controller,
  Get,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import {
  UpdateAgentProfileDto,
  VerifyAgentDto,
  AgentFilterDto,
} from './dto/agent.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('Agents')
@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List verified agents (public) — owners use this to find agents',
  })
  async findAll(@Query() filters: AgentFilterDto) {
    return this.agentsService.findAll(filters);
  }

  @Get('pending')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get agents pending verification [ADMIN]' })
  async getPending(@CurrentUser() user: User) {
    return this.agentsService.getPendingVerification(user);
  }
  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List ALL agents regardless of status [ADMIN]' })
  async adminFindAll(
    @CurrentUser() user: User,
    @Query('verificationStatus') verificationStatus?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.agentsService.adminFindAll(user, {
      verificationStatus,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('me')
  @Roles(UserRole.AGENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my agent profile [AGENT]' })
  async getMyProfile(@CurrentUser() user: User) {
    return this.agentsService.getMyProfile(user.id);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get agent profile by ID (public)' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.agentsService.findOne(id);
  }

  @Put('me')
  @Roles(UserRole.AGENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my agent profile [AGENT]' })
  async updateProfile(
    @Body() dto: UpdateAgentProfileDto,
    @CurrentUser() user: User,
  ) {
    return this.agentsService.updateProfile(user.id, dto, user);
  }

  @Patch(':id/verify')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify or reject an agent [ADMIN]' })
  async verifyAgent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyAgentDto,
    @CurrentUser() user: User,
  ) {
    return this.agentsService.verifyAgent(id, dto, user);
  }
}
