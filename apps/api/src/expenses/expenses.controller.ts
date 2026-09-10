import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import {
  CompleteReceiptUploadDto,
  CreateExpenseDto,
  ListExpensesQuery,
  PrepareReceiptUploadDto,
  SubmitExpenseDto,
} from './dto';
import { ExpensesService } from './expenses.service';

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Post()
  @Roles(Role.EMPLOYEE)
  @Idempotent()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.expenses.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListExpensesQuery) {
    return this.expenses.list(user, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.expenses.get(user, id);
  }

  @Post(':id/receipt-upload')
  @Roles(Role.EMPLOYEE)
  @Idempotent()
  prepareReceiptUpload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PrepareReceiptUploadDto,
  ) {
    return this.expenses.prepareReceiptUpload(user, id, dto);
  }

  @Post(':id/receipt-upload/complete')
  @Roles(Role.EMPLOYEE)
  @Idempotent()
  completeReceiptUpload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CompleteReceiptUploadDto,
  ) {
    return this.expenses.completeReceiptUpload(user, id, dto);
  }

  @Get(':id/receipt')
  receipt(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.expenses.getReceiptDownload(user, id);
  }

  @Post(':id/submit')
  @Roles(Role.EMPLOYEE)
  @Idempotent()
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SubmitExpenseDto,
  ) {
    return this.expenses.submit(user, id, dto);
  }
}
