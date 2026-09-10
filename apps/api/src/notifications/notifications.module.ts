import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import {
  ConsoleEmailProvider,
  EmailProviderService,
  SesEmailProvider,
} from './email-provider';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: 'notifications' })],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    ConsoleEmailProvider,
    SesEmailProvider,
    EmailProviderService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
