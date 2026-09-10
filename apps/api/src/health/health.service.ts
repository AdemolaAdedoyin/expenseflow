import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

type DependencyStatus = {
  status: 'up' | 'down';
};

export type ReadinessResult = {
  status: 'ready' | 'not_ready';
  checks: {
    database: DependencyStatus;
    redis: DependencyStatus;
  };
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  live() {
    return {
      status: 'ok' as const,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async ready(): Promise<ReadinessResult> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const ready = database.status === 'up' && redis.status === 'up';

    return {
      status: ready ? 'ready' : 'not_ready',
      checks: { database, redis },
    };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up' };
    } catch {
      return { status: 'down' };
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    try {
      const client = await this.notificationsQueue.client;
      const response = await client.ping();
      return { status: response === 'PONG' ? 'up' : 'down' };
    } catch {
      return { status: 'down' };
    }
  }
}
