/* eslint-disable @typescript-eslint/require-await */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import {
  appConfig,
  databaseConfig,
  redisConfig,
  jwtConfig,
  uploadConfig,
  throttleConfig,
  awsConfig,
} from './config';
import { S3Module } from './s3/s3.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AgentsModule } from './agents/agents.module';
import { TenantsModule } from './tenants/tenants.module';
import { HousesModule } from './houses/houses.module';
import { ViewingsModule } from './viewings/viewings.module';
import { ExchangesModule } from './exchanges/exchanges.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        uploadConfig,
        throttleConfig,
        awsConfig,
      ],
      envFilePath: '.env',
    }),

    // Cache with Redis
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        // In production, configure with Redis
        // import { createClient } from 'redis';
        // import { redisInsStore } from 'cache-manager-redis-yet';
        // const redisClient = createClient({ socket: { host, port }, password });
        // await redisClient.connect();
        // return { store: redisInsStore(redisClient), ttl: 3600 };
        return {
          ttl: 3600,
          max: 1000,
        };
      },
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            ttl: parseInt(process.env.THROTTLE_TTL || '60000'),
            limit: parseInt(process.env.THROTTLE_LIMIT || '100'),
          },
        ],
      }),
    }),

    // Schedule for recurring jobs
    ScheduleModule.forRoot(),

    // Database
    DatabaseModule,

    // S3
    S3Module,

    // Feature modules
    AuthModule,
    UsersModule,
    AgentsModule,
    TenantsModule,
    HousesModule,
    ViewingsModule,
    ExchangesModule,
    ChatModule,
    NotificationsModule,
  ],
})
export class AppModule {}
