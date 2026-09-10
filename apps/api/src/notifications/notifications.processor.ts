import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);
  async process(job: Job<{ type: string; recipientEmail: string; subject: string; message: string }>) {
    // Adapter boundary: replace with SES/SendGrid in production. Console output keeps local setup zero-cost.
    this.logger.log(`[${job.data.type}] ${job.data.recipientEmail} :: ${job.data.subject} :: ${job.data.message}`);
    return { delivered: true, provider: 'console' };
  }
}
