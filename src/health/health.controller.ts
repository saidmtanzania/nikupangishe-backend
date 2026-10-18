import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { DataSource } from 'typeorm';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  @Get('live')
  @Public()
  live() {
    return {
      status: 'ok',
      service: 'nikupangishe-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @Public()
  async ready() {
    let database: 'ok' | 'failed' = 'ok';
    let redis: 'ok' | 'failed' = 'ok';

    try {
      if (!this.dataSource.isInitialized) {
        throw new Error('Database connection is not initialized');
      }

      await this.dataSource.query('SELECT 1');
    } catch {
      database = 'failed';
    }

    try {
      await this.cache.set('health:redis', 'ok', 1000);
      if ((await this.cache.get<string>('health:redis')) !== 'ok') {
        throw new Error('Redis health check returned an unexpected value');
      }
    } catch {
      redis = 'failed';
    }

    if (database === 'failed' || redis === 'failed') {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        checks: { database, redis },
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ok',
      checks: { database, redis },
      timestamp: new Date().toISOString(),
    };
  }
}
