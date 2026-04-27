/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
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
import { S3Service } from '../s3/s3.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly s3Service: S3Service,
  ) {}

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

  // ─── Avatar upload ──────────────────────────────────────────────────────────
  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload / replace your profile avatar via S3' })
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp|gif)$/)) {
          cb(new Error('Only image files are allowed'), false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    const url = await this.s3Service.uploadFile(
      file.buffer,
      file.mimetype,
      'avatars',
      file.originalname,
    );
    const updated = await this.usersService.updateMyProfile(user.id, {
      avatar: url,
    });
    return { message: 'Avatar updated', avatarUrl: url, user: updated };
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
