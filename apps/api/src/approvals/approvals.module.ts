import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';

@Module({
  controllers: [ApprovalsController],
  providers: [ApprovalsService, RolesGuard],
})
export class ApprovalsModule {}
