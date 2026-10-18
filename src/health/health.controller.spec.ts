import { ServiceUnavailableException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { Cache } from 'cache-manager';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports live and ready when dependencies respond', async () => {
    const dataSource = {
      isInitialized: true,
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as DataSource;
    const cache = {
      set: jest.fn().mockResolvedValue('ok'),
      get: jest.fn().mockResolvedValue('ok'),
    } as unknown as Cache;
    const controller = new HealthController(dataSource, cache);

    expect(controller.live()).toEqual(
      expect.objectContaining({ status: 'ok', service: 'nikupangishe-api' }),
    );
    await expect(controller.ready()).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        checks: { database: 'ok', redis: 'ok' },
      }),
    );
  });

  it('reports unavailable when the database is down', async () => {
    const dataSource = {
      isInitialized: true,
      query: jest.fn().mockRejectedValue(new Error('database unavailable')),
    } as unknown as DataSource;
    const cache = {
      set: jest.fn().mockResolvedValue('ok'),
      get: jest.fn().mockResolvedValue('ok'),
    } as unknown as Cache;
    const controller = new HealthController(dataSource, cache);

    await expect(controller.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
