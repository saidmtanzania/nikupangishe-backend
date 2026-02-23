import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangesController } from './exchanges.controller';
import { ExchangesService } from './exchanges.service';
import { ExchangeRequest } from './entities/exchange-request.entity';
import { Tenancy } from '../houses/entities/tenancy.entity';
import { House } from '../houses/entities/house.entity';
import { TenantProfile } from '../tenants/entities/tenant-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExchangeRequest, Tenancy, House, TenantProfile]),
  ],
  controllers: [ExchangesController],
  providers: [ExchangesService],
  exports: [ExchangesService],
})
export class ExchangesModule {}
