import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangesController } from './exchanges.controller';
import { ExchangesService } from './exchanges.service';
import { ExchangeRequest } from './entities/exchange-request.entity';
import { CommissionRecord } from './entities/commission-record.entity';
import { Tenancy } from '../houses/entities/tenancy.entity';
import { House } from '../houses/entities/house.entity';
import { TenantProfile } from '../tenants/entities/tenant-profile.entity';
import { AgentProfile } from '../agents/entities/agent-profile.entity';
import { HouseAgent } from '../houses/entities/house-agent.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExchangeRequest,
      CommissionRecord,
      Tenancy,
      House,
      TenantProfile,
      AgentProfile,
      HouseAgent,
    ]),
    NotificationsModule,
  ],
  controllers: [ExchangesController],
  providers: [ExchangesService],
  exports: [ExchangesService],
})
export class ExchangesModule {}
