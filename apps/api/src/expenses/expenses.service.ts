import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalLevel, ApprovalStatus, ExpenseStatus, Role } from '@prisma/client';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PoliciesService } from '../policies/policies.service';
import { CreateExpenseDto, ListExpensesQuery } from './dto';

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private policies: PoliciesService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async create(user: AuthUser, dto: CreateExpenseDto) {
    const expense = await this.prisma.expense.create({
      data: { organizationId: user.organizationId, userId: user.sub, ...dto, incurredAt: new Date(dto.incurredAt), currency: dto.currency ?? 'USD' },
    });
    await this.audit.write({ organizationId: user.organizationId, actorId: user.sub, entityType: 'Expense', entityId: expense.id, action: 'expense.created' });
    return expense;
  }

  async list(user: AuthUser, query: ListExpensesQuery) {
    const limit = Math.min(query.limit ?? 20, 100);
    const page = query.page ?? 1;
    const where: any = {
      organizationId: user.organizationId,
      ...(user.role === Role.EMPLOYEE ? { userId: user.sub } : {}),
      ...(query.status ? { status: query.status as ExpenseStatus } : {}),
      ...(query.category ? { category: { equals: query.category, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({ where, include: { user: { select: { firstName: true, lastName: true, email: true } }, approvals: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.expense.count({ where }),
    ]);
    return { items, page, limit, total, pages: Math.ceil(total / limit) };
  }

  async get(user: AuthUser, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, department: true } }, approvals: { include: { approver: { select: { firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: 'asc' } } },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    if (user.role === Role.EMPLOYEE && expense.userId !== user.sub) throw new ForbiddenException();
    return expense;
  }

  async submit(user: AuthUser, id: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, organizationId: user.organizationId, userId: user.sub }, include: { user: true } });
    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.status !== ExpenseStatus.DRAFT) throw new BadRequestException('Only draft expenses can be submitted');

    const evaluation = await this.policies.evaluate(user.organizationId, expense.amountCents, expense.category);
    const manager = expense.user.managerId ? await this.prisma.user.findFirst({ where: { id: expense.user.managerId, organizationId: user.organizationId } }) : null;
const finance =
  (await this.prisma.user.findFirst({
    where: {
      organizationId: user.organizationId,
      role: Role.FINANCE,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })) ??
  (await this.prisma.user.findFirst({
    where: {
      organizationId: user.organizationId,
      role: Role.ADMIN,
    },
    orderBy: {
      createdAt: 'asc',
    },
  }));

    if (evaluation.requireManager && !manager) throw new BadRequestException('No manager is configured for this employee');
    if (evaluation.requireFinance && !finance) throw new BadRequestException('No finance approver is configured');

    const status = evaluation.autoReject
      ? ExpenseStatus.REJECTED
      : evaluation.requireManager
        ? ExpenseStatus.PENDING_MANAGER
        : evaluation.requireFinance
          ? ExpenseStatus.PENDING_FINANCE
          : ExpenseStatus.APPROVED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.expense.update({
        where: { id },
        data: { status, submittedAt: new Date(), ...(status === ExpenseStatus.APPROVED || status === ExpenseStatus.REJECTED ? { decidedAt: new Date() } : {}), ...(evaluation.autoReject ? { rejectionReason: 'Rejected by expense policy' } : {}) },
      });
      if (!evaluation.autoReject && evaluation.requireManager && manager) {
        await tx.approval.create({ data: { expenseId: id, approverId: manager.id, level: ApprovalLevel.MANAGER, status: ApprovalStatus.PENDING } });
      }
      if (!evaluation.autoReject && evaluation.requireFinance && finance) {
        await tx.approval.create({ data: { expenseId: id, approverId: finance.id, level: ApprovalLevel.FINANCE, status: evaluation.requireManager ? ApprovalStatus.SKIPPED : ApprovalStatus.PENDING } });
      }
      return result;
    });

    await this.audit.write({ organizationId: user.organizationId, actorId: user.sub, entityType: 'Expense', entityId: id, action: 'expense.submitted', metadata: { status, matchedPolicyIds: evaluation.matchedPolicyIds } });
    if (manager && status === ExpenseStatus.PENDING_MANAGER) {
      await this.notifications.enqueue({ type: 'approval.requested', recipientEmail: manager.email, subject: 'Expense approval requested', message: `${expense.user.firstName} submitted ${expense.currency} ${(expense.amountCents / 100).toFixed(2)} at ${expense.merchant}` });
    } else if (finance && status === ExpenseStatus.PENDING_FINANCE) {
      await this.notifications.enqueue({ type: 'approval.requested', recipientEmail: finance.email, subject: 'Finance approval requested', message: `${expense.user.firstName} submitted ${expense.currency} ${(expense.amountCents / 100).toFixed(2)} at ${expense.merchant}` });
    }
    return updated;
  }
}
