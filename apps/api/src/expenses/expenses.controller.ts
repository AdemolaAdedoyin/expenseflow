import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { CreateExpenseDto, ListExpensesQuery } from './dto';
import { ExpensesService } from './expenses.service';

@ApiTags('expenses') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('expenses')
export class ExpensesController {
  constructor(private expenses: ExpensesService) {}
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateExpenseDto) { return this.expenses.create(u, dto); }
  @Get() list(@CurrentUser() u: AuthUser, @Query() q: ListExpensesQuery) { return this.expenses.list(u, q); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.expenses.get(u, id); }
  @Post(':id/submit') submit(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.expenses.submit(u, id); }
}
