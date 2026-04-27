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
import { UsersService } from './users.service';
import {
  UpdateUserDto,
  AdminUpdateUserDto,
  UserFilterDto,
} from './dto/user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User, UserRole } from './entities/user.entity';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile (any authenticated role)',
  })
  async getMyProfile(@CurrentUser() user: User) {
    return this.usersService.getMyProfile(user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile (name, avatar)' })
  async updateMyProfile(@Body() dto: UpdateUserDto, @CurrentUser() user: User) {
    return this.usersService.updateMyProfile(user.id, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all users with filters [ADMIN]' })
  async adminListUsers(
    @CurrentUser() user: User,
    @Query() filters: UserFilterDto,
  ) {
    return this.usersService.adminListUsers(user, filters);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update user account status (suspend/ban/activate) [ADMIN]',
  })
  async adminUpdateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() user: User,
  ) {
    return this.usersService.adminUpdateUserStatus(user, id, dto);
  }
}
