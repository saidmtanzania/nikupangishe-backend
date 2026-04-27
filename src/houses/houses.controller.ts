/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { HousesService } from './houses.service';
import {
  CreateHouseDto,
  UpdateHouseDto,
  HouseFilterDto,
  AssignAgentDto,
  VerifyHouseDto,
} from './dto/house.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { S3Service } from '../s3/s3.service';

@ApiTags('Houses')
@Controller('houses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HousesController {
  constructor(
    private readonly housesService: HousesService,
    private readonly s3Service: S3Service,
  ) {}

  // PUBLIC: Browse houses without authentication
  @Get()
  @Public()
  @ApiOperation({
    summary: 'Browse all available houses (public, no auth required)',
  })
  async findAll(@Query() filters: HouseFilterDto) {
    return this.housesService.findAll(filters);
  }

  @Get('pending-verification')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get houses pending admin verification [ADMIN]' })
  async getPending(@CurrentUser() user: User) {
    return this.housesService.getPendingVerification(user);
  }

  @Get('my-houses')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get houses owned by the current user [OWNER]' })
  async getMyHouses(@CurrentUser() user: User) {
    return this.housesService.getOwnerHouses(user.id);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get house details by ID (public)' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.housesService.findOne(id, true);
  }

  @Post()
  @Roles(UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new house listing [OWNER]' })
  async create(
    @Body() createHouseDto: CreateHouseDto,
    @CurrentUser() user: User,
  ) {
    return this.housesService.create(createHouseDto, user);
  }

  @Put(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update house details [OWNER]' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateHouseDto,
    @CurrentUser() user: User,
  ) {
    return this.housesService.update(id, updateDto, user);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate a house listing [OWNER]' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.housesService.remove(id, user);
  }

  @Patch(':id/publish')
  @Roles(UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish (activate) a house listing [OWNER]' })
  async publishHouse(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.housesService.publishHouse(id, user);
  }

  @Patch(':id/unpublish')
  @Roles(UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unpublish (draft) a house listing [OWNER]' })
  async unpublishHouse(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.housesService.unpublishHouse(id, user);
  }

  // Agent assignment
  @Post(':id/agents')
  @Roles(UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign an agent to a house [OWNER]' })
  async assignAgent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignAgentDto,
    @CurrentUser() user: User,
  ) {
    return this.housesService.assignAgent(id, dto, user);
  }

  @Delete(':id/agents/:agentId')
  @Roles(UserRole.OWNER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove an agent from a house [OWNER]' })
  async removeAgent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @CurrentUser() user: User,
  ) {
    return this.housesService.removeAgent(id, agentId, user);
  }

  // Admin: Verify/reject house
  @Patch(':id/verify')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify or reject a house listing [ADMIN]' })
  async verifyHouse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyHouseDto,
    @CurrentUser() user: User,
  ) {
    return this.housesService.verifyHouse(id, dto, user);
  }

  // ─── Photo upload (field: 'photos') ────────────────────────────────────────
  @Post(':id/photos')
  @Roles(UserRole.OWNER)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload house photos to S3 [OWNER]' })
  @UseInterceptors(
    FilesInterceptor('photos', 20, {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          cb(new Error('Only image files are allowed'), false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async uploadPhotos(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() _user: User,
  ) {
    const urls = await Promise.all(
      files.map((f) =>
        this.s3Service.uploadFile(f.buffer, f.mimetype, 'houses', f.originalname),
      ),
    );
    await this.housesService.addPhotos(id, urls);
    return { message: 'Photos uploaded', images: urls, urls };
  }

  // ─── Photo upload alias (field: 'images') ──────────────────────────────────
  @Post(':id/images')
  @Roles(UserRole.OWNER)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload house images (alias for photos) [OWNER]' })
  @UseInterceptors(
    FilesInterceptor('images', 20, {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          cb(new Error('Only image files are allowed'), false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async uploadImages(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() _user: User,
  ) {
    const urls = await Promise.all(
      files.map((f) =>
        this.s3Service.uploadFile(f.buffer, f.mimetype, 'houses', f.originalname),
      ),
    );
    await this.housesService.addPhotos(id, urls);
    return { message: 'Images uploaded', images: urls, urls };
  }
}
