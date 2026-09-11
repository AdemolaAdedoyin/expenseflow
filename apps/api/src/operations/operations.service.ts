import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { HttpMetricsService } from '../common/observability/http-metrics.service';

@Injectable()
export class OperationsService {
  constructor(
    @InjectQueue('notifications') private readonly notifications: Queue,
    private readonly httpMetrics: HttpMetricsService,
  ) {}

  async overview() {
    const queue = await this.notifications.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'completed',
      'failed',
    );

    return {
      generatedAt: new Date().toISOString(),
      http: this.httpMetrics.snapshot(),
      notifications: queue,
    };
  }
}
