import { Module } from '@nestjs/common';
import { PoliciesModule } from '../policies/policies.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
@Module({ imports: [PoliciesModule], controllers: [ExpensesController], providers: [ExpensesService] })
export class ExpensesModule {}
