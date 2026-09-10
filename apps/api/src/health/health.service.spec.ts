import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  function createService(options?: { databaseFails?: boolean; redisFails?: boolean }) {
    const prisma = {
      $queryRaw: jest.fn().mockImplementation(() =>
        options?.databaseFails ? Promise.reject(new Error('db down')) : Promise.resolve([1]),
      ),
    } as unknown as PrismaService;

    const client = {
      ping: jest.fn().mockImplementation(() =>
        options?.redisFails ? Promise.reject(new Error('redis down')) : Promise.resolve('PONG'),
      ),
    };

    const queue = {
      client: Promise.resolve(client),
    } as unknown as Queue;

    return new HealthService(prisma, queue);
  }

  it('reports live while the process is running', () => {
    const result = createService().live();

    expect(result.status).toBe('ok');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeTruthy();
  });

  it('reports ready when database and Redis are available', async () => {
    await expect(createService().ready()).resolves.toEqual({
      status: 'ready',
      checks: {
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    });
  });

  it('reports not ready without leaking dependency errors', async () => {
    await expect(createService({ redisFails: true }).ready()).resolves.toEqual({
      status: 'not_ready',
      checks: {
        database: { status: 'up' },
        redis: { status: 'down' },
      },
    });
  });
});
