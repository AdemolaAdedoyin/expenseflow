import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { PoliciesModule } from '../policies/policies.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ReceiptStorageService } from './receipt-storage.service';

@Module({
  imports: [PoliciesModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, ReceiptStorageService, RolesGuard],
  exports: [ExpensesService],
})
export class ExpensesModule {}
