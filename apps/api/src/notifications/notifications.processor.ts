import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailProviderService } from './email-provider';

type NotificationJob = {
  type: string;
  recipientEmail: string;
  subject: string;
  message: string;
};

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly emailProvider: EmailProviderService) {
    super();
  }

  async process(job: Job<NotificationJob>) {
    const result = await this.emailProvider.send({
      to: job.data.recipientEmail,
      subject: job.data.subject,
      text: job.data.message,
    });

    this.logger.log(
      `[${job.data.type}] delivered via ${result.provider} to ${job.data.recipientEmail}`,
    );

    return result;
  }
}
