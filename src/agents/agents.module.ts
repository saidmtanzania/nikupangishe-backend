import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentProfile } from './entities/agent-profile.entity';
import { HouseAgent } from '../houses/entities/house-agent.entity';
import { User } from '../users/entities/user.entity';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AgentProfile, HouseAgent, User])],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [TypeOrmModule, AgentsService],
})
export class AgentsModule {}
