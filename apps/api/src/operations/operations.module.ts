import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'notifications' })],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
