/* eslint-disable @typescript-eslint/require-await */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { ScheduleModule } from '@nestjs/schedule';
import {
  appConfig,
  databaseConfig,
  redisConfig,
  jwtConfig,
  uploadConfig,
  throttleConfig,
  awsConfig,
  smsConfig,
  emailConfig,
  validateEnvironment,
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
import { HealthModule } from './health/health.module';

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
        smsConfig,
        emailConfig,
      ],
      validate: validateEnvironment,
      envFilePath: '.env',
    }),

    // Cache with Redis
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.getOrThrow<string>('redis.host');
        const port = configService.getOrThrow<number>('redis.port');
        const password = configService.get<string>('redis.password');
        const credentials = password ? `:${encodeURIComponent(password)}@` : '';

        return {
          stores: [
            createKeyv(`redis://${credentials}${host}:${port}`, {
              namespace: 'nikupangishe',
              throwOnConnectError: true,
              throwOnErrors: true,
            }),
          ],
          ttl: configService.getOrThrow<number>('redis.ttl') * 1000,
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
    HealthModule,
  ],
})
export class AppModule {}
