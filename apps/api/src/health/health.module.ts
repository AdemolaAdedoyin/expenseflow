import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: 'notifications' })],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
