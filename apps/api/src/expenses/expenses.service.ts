import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalLevel,
  ApprovalStatus,
  ExpenseStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { PoliciesService } from '../policies/policies.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CompleteReceiptUploadDto,
  CreateExpenseDto,
  ListExpensesQuery,
  PrepareReceiptUploadDto,
} from './dto';
import { ReceiptStorageService } from './receipt-storage.service';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: PoliciesService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly receiptStorage: ReceiptStorageService,
  ) {}

  async create(user: AuthUser, dto: CreateExpenseDto) {
    const expense = await this.prisma.expense.create({
      data: {
        organizationId: user.organizationId,
        userId: user.sub,
        ...dto,
        incurredAt: new Date(dto.incurredAt),
        currency: dto.currency ?? 'USD',
      },
    });

    await this.audit.write({
      organizationId: user.organizationId,
      actorId: user.sub,
      entityType: 'Expense',
      entityId: expense.id,
      action: 'expense.created',
    });

    return expense;
  }

  async list(user: AuthUser, query: ListExpensesQuery) {
    const limit = Math.min(query.limit ?? 20, 100);
    const page = query.page ?? 1;
    const where: Prisma.ExpenseWhereInput = {
      organizationId: user.organizationId,
    };

    if (user.role === Role.EMPLOYEE) {
      where.userId = user.sub;
    }

    if (query.status) {
      where.status = query.status as ExpenseStatus;
    }

    if (query.category) {
      where.category = {
        equals: query.category,
        mode: 'insensitive',
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          approvals: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async get(user: AuthUser, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
          },
        },
        approvals: {
          include: {
            approver: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    if (user.role === Role.EMPLOYEE && expense.userId !== user.sub) {
      throw new ForbiddenException('You can only view your own expenses');
    }

    return expense;
  }

  async prepareReceiptUpload(user: AuthUser, id: string, dto: PrepareReceiptUploadDto) {
    await this.getOwnedDraftExpense(user, id);

    return this.receiptStorage.createUploadTarget(
      user.organizationId,
      id,
      dto.contentType,
    );
  }

  async completeReceiptUpload(user: AuthUser, id: string, dto: CompleteReceiptUploadDto) {
    await this.getOwnedDraftExpense(user, id);
    this.receiptStorage.assertObjectBelongsToExpense(
      user.organizationId,
      id,
      dto.objectKey,
    );

    const expense = await this.prisma.expense.update({
      where: { id },
      data: {
        receiptUrl: this.receiptStorage.toStorageUri(dto.objectKey),
      },
    });

    await this.audit.write({
      organizationId: user.organizationId,
      actorId: user.sub,
      entityType: 'Expense',
      entityId: id,
      action: 'expense.receipt_attached',
      metadata: { objectKey: dto.objectKey },
    });

    return expense;
  }

  async getReceiptDownload(user: AuthUser, id: string) {
    const expense = await this.get(user, id);

    if (!expense.receiptUrl) {
      throw new NotFoundException('This expense does not have a receipt');
    }

    const objectKey = this.receiptStorage.objectKeyFromStorageUri(expense.receiptUrl);
    return this.receiptStorage.createDownloadUrl(objectKey);
  }

  async submit(user: AuthUser, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        userId: user.sub,
      },
      include: { user: true },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    if (expense.status !== ExpenseStatus.DRAFT) {
      throw new BadRequestException('Only draft expenses can be submitted');
    }

    const evaluation = await this.policies.evaluate(
      user.organizationId,
      expense.amountCents,
      expense.category,
    );

    const manager = evaluation.requireManager
      ? await this.findManagerApprover(user.organizationId, expense.user.managerId)
      : null;
    const finance = evaluation.requireFinance
      ? await this.findFinanceApprover(user.organizationId)
      : null;

    if (evaluation.requireManager && !manager) {
      throw new BadRequestException('No manager is configured for this employee');
    }

    if (evaluation.requireFinance && !finance) {
      throw new BadRequestException('No finance approver is configured');
    }

    const status = this.resolveSubmissionStatus(evaluation);

    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.expense.update({
        where: { id },
        data: {
          status,
          submittedAt: new Date(),
          ...(status === ExpenseStatus.APPROVED || status === ExpenseStatus.REJECTED
            ? { decidedAt: new Date() }
            : {}),
          ...(evaluation.autoReject
            ? { rejectionReason: 'Rejected by expense policy' }
            : {}),
        },
      });

      if (!evaluation.autoReject && evaluation.requireManager && manager) {
        await transaction.approval.create({
          data: {
            expenseId: id,
            approverId: manager.id,
            level: ApprovalLevel.MANAGER,
            status: ApprovalStatus.PENDING,
          },
        });
      }

      if (!evaluation.autoReject && evaluation.requireFinance && finance) {
        await transaction.approval.create({
          data: {
            expenseId: id,
            approverId: finance.id,
            level: ApprovalLevel.FINANCE,
            status: evaluation.requireManager
              ? ApprovalStatus.SKIPPED
              : ApprovalStatus.PENDING,
          },
        });
      }

      return result;
    });

    await this.audit.write({
      organizationId: user.organizationId,
      actorId: user.sub,
      entityType: 'Expense',
      entityId: id,
      action: 'expense.submitted',
      metadata: {
        status,
        matchedPolicyIds: evaluation.matchedPolicyIds,
      },
    });

    if (manager && status === ExpenseStatus.PENDING_MANAGER) {
      await this.notifications.enqueue({
        type: 'approval.requested',
        recipientEmail: manager.email,
        subject: 'Expense approval requested',
        message: `${expense.user.firstName} submitted ${expense.currency} ${(
          expense.amountCents / 100
        ).toFixed(2)} at ${expense.merchant}`,
      });
    } else if (finance && status === ExpenseStatus.PENDING_FINANCE) {
      await this.notifications.enqueue({
        type: 'approval.requested',
        recipientEmail: finance.email,
        subject: 'Finance approval requested',
        message: `${expense.user.firstName} submitted ${expense.currency} ${(
          expense.amountCents / 100
        ).toFixed(2)} at ${expense.merchant}`,
      });
    }

    return updated;
  }

  private async getOwnedDraftExpense(user: AuthUser, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        userId: user.sub,
      },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    if (expense.status !== ExpenseStatus.DRAFT) {
      throw new BadRequestException('Receipts can only be changed while an expense is a draft');
    }

    return expense;
  }

  private async findManagerApprover(organizationId: string, managerId: string | null) {
    if (!managerId) {
      return null;
    }

    return this.prisma.user.findFirst({
      where: {
        id: managerId,
        organizationId,
        role: { in: [Role.MANAGER, Role.ADMIN] },
      },
    });
  }

  private async findFinanceApprover(organizationId: string) {
    const finance = await this.prisma.user.findFirst({
      where: {
        organizationId,
        role: Role.FINANCE,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (finance) {
      return finance;
    }

    return this.prisma.user.findFirst({
      where: {
        organizationId,
        role: Role.ADMIN,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private resolveSubmissionStatus(evaluation: {
    autoReject: boolean;
    requireManager: boolean;
    requireFinance: boolean;
  }) {
    if (evaluation.autoReject) {
      return ExpenseStatus.REJECTED;
    }

    if (evaluation.requireManager) {
      return ExpenseStatus.PENDING_MANAGER;
    }

    if (evaluation.requireFinance) {
      return ExpenseStatus.PENDING_FINANCE;
    }

    return ExpenseStatus.APPROVED;
  }
}
