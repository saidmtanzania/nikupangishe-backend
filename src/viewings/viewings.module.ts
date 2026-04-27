import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ViewingsController } from './viewings.controller';
import { ViewingsService } from './viewings.service';
import { ViewingRequest } from './entities/viewing-request.entity';
import { House } from '../houses/entities/house.entity';
import { HouseAgent } from '../houses/entities/house-agent.entity';
import { AgentProfile } from '../agents/entities/agent-profile.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ViewingRequest,
      House,
      HouseAgent,
      AgentProfile,
      User,
    ]),
    NotificationsModule,
  ],
  controllers: [ViewingsController],
  providers: [ViewingsService],
  exports: [ViewingsService],
})
export class ViewingsModule {}
