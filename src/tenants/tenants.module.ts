import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantProfile } from './entities/tenant-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TenantProfile])],
  exports: [TypeOrmModule],
})
export class TenantsModule {}
