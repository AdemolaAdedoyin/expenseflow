import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { RequirePermissions } from '../common/permissions/permissions.decorator';
import { PermissionsGuard } from '../common/permissions/permissions.guard';
import { Permission } from '../common/permissions/permissions';
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
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Post()
  @RequirePermissions(Permission.EXPENSE_CREATE)
  @Idempotent()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.expenses.create(user, dto);
  }

  @Get()
  @RequirePermissions(Permission.EXPENSE_READ)
  list(@CurrentUser() user: AuthUser, @Query() query: ListExpensesQuery) {
    return this.expenses.list(user, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.EXPENSE_READ)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.expenses.get(user, id);
  }

  @Post(':id/receipt-upload')
  @RequirePermissions(Permission.RECEIPT_MANAGE)
  @Idempotent()
  prepareReceiptUpload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PrepareReceiptUploadDto,
  ) {
    return this.expenses.prepareReceiptUpload(user, id, dto);
  }

  @Post(':id/receipt-upload/complete')
  @RequirePermissions(Permission.RECEIPT_MANAGE)
  @Idempotent()
  completeReceiptUpload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CompleteReceiptUploadDto,
  ) {
    return this.expenses.completeReceiptUpload(user, id, dto);
  }

  @Get(':id/receipt')
  @RequirePermissions(Permission.EXPENSE_READ)
  receipt(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.expenses.getReceiptDownload(user, id);
  }

  @Post(':id/submit')
  @RequirePermissions(Permission.EXPENSE_SUBMIT)
  @Idempotent()
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SubmitExpenseDto,
  ) {
    return this.expenses.submit(user, id, dto);
  }
}
