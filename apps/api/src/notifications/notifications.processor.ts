import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RequestContextService } from '../common/observability/request-context';
import { StructuredLogger } from '../common/observability/structured-logger';
import { EmailProviderService } from './email-provider';
import { NotificationJob } from './notifications.service';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  constructor(
    private readonly emailProvider: EmailProviderService,
    private readonly requestContext: RequestContextService,
    private readonly logger: StructuredLogger,
  ) {
    super();
  }

  async process(job: Job<NotificationJob>) {
    const run = async () => {
      const result = await this.emailProvider.send({
        to: job.data.recipientEmail,
        subject: job.data.subject,
        text: job.data.message,
      });

      this.logger.log(
        {
          event: 'notification.delivered',
          notificationType: job.data.type,
          provider: result.provider,
          recipientEmail: job.data.recipientEmail,
          jobId: job.id,
          attempt: job.attemptsMade + 1,
        },
        NotificationsProcessor.name,
      );

      return result;
    };

    if (!job.data.trace) {
      return run();
    }

    // AsyncLocalStorage restores the originating trace for every log emitted
    // while the worker handles this job, even though it runs after the HTTP call.
    return this.requestContext.run(job.data.trace, run);
  }
}
