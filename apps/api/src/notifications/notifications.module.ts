import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';
@Global()
@Module({ imports: [BullModule.registerQueue({ name: 'notifications' })], providers: [NotificationsService, NotificationsProcessor], exports: [NotificationsService] })
export class NotificationsModule {}
