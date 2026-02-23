import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ViewingsController } from './viewings.controller';
import { ViewingsService } from './viewings.service';
import { ViewingRequest } from './entities/viewing-request.entity';
import { House } from '../houses/entities/house.entity';
import { HouseAgent } from '../houses/entities/house-agent.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ViewingRequest, House, HouseAgent])],
  controllers: [ViewingsController],
  providers: [ViewingsService],
  exports: [ViewingsService],
})
export class ViewingsModule {}
