import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RequestContextService, TraceContext } from '../common/observability/request-context';

type NotificationInput = {
  type: string;
  recipientEmail: string;
  subject: string;
  message: string;
};

export type NotificationJob = NotificationInput & {
  trace?: TraceContext;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue('notifications') private readonly queue: Queue,
    private readonly requestContext: RequestContextService,
  ) {}

  async enqueue(input: NotificationInput) {
    const currentTrace = this.requestContext.get();
    const trace = currentTrace ? this.requestContext.child(currentTrace) : undefined;

    // Carry the W3C-style trace identity into BullMQ so async work can be
    // correlated with the HTTP request that originally scheduled it.
    return this.queue.add(
      'email',
      { ...input, ...(trace ? { trace } : {}) } satisfies NotificationJob,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );
  }
}
