import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HousesController } from './houses.controller';
import { HousesService } from './houses.service';
import { House } from './entities/house.entity';
import { HouseAgent } from './entities/house-agent.entity';
import { Tenancy } from './entities/tenancy.entity';
import { AgentProfile } from '../agents/entities/agent-profile.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([House, HouseAgent, Tenancy, AgentProfile]),
    NotificationsModule,
  ],
  controllers: [HousesController],
  providers: [HousesService],
  exports: [HousesService],
})
export class HousesModule {}
