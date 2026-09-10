import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsService {
  constructor(@InjectQueue('notifications') private queue: Queue) {}

  async enqueue(input: { type: string; recipientEmail: string; subject: string; message: string }) {
    return this.queue.add('email', input, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    });
  }
}
