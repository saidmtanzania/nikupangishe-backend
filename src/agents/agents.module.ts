import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentProfile } from './entities/agent-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AgentProfile])],
  exports: [TypeOrmModule],
})
export class AgentsModule {}
