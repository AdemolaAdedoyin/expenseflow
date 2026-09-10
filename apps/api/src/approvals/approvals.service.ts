import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalLevel, ApprovalStatus, ExpenseStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { DecideApprovalDto } from './dto';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  inbox(user: AuthUser) {
    return this.prisma.withTenant(user.organizationId, (transaction) =>
      transaction.approval.findMany({
        where: {
          approverId: user.sub,
          status: ApprovalStatus.PENDING,
          expense: { organizationId: user.organizationId },
        },
        include: {
          expense: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  department: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  async decide(user: AuthUser, id: string, dto: DecideApprovalDto) {
    const approval = await this.prisma.withTenant(user.organizationId, (transaction) =>
      transaction.approval.findFirst({
        where: {
          id,
          approverId: user.sub,
          expense: { organizationId: user.organizationId },
        },
        include: {
          expense: {
            include: {
              user: true,
              approvals: true,
            },
          },
        },
      }),
    );

    if (!approval) {
      throw new NotFoundException('Approval not found');
    }

    if (approval.status !== ApprovalStatus.PENDING) {
      throw this.staleApprovalConflict();
    }

    if (approval.version !== dto.expectedVersion) {
      throw this.staleApprovalConflict();
    }

    const expectedExpenseStatus =
      approval.level === ApprovalLevel.MANAGER
        ? ExpenseStatus.PENDING_MANAGER
        : ExpenseStatus.PENDING_FINANCE;

    if (approval.expense.status !== expectedExpenseStatus) {
      throw this.staleApprovalConflict();
    }

    const approved = dto.decision === 'APPROVE';

    const result = await this.prisma.withTenant(user.organizationId, async (transaction) => {
      const approvalUpdate = await transaction.approval.updateMany({
        where: {
          id,
          approverId: user.sub,
          status: ApprovalStatus.PENDING,
          version: dto.expectedVersion,
        },
        data: {
          status: approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
          comment: dto.comment,
          decidedAt: new Date(),
          version: { increment: 1 },
        },
      });

      if (approvalUpdate.count !== 1) {
        throw this.staleApprovalConflict();
      }

      let nextStatus: ExpenseStatus;
      let rejectionReason: string | undefined;
      let decidedAt: Date | undefined;

      if (!approved) {
        nextStatus = ExpenseStatus.REJECTED;
        rejectionReason =
          dto.comment || `Rejected by ${approval.level.toLowerCase()} approver`;
        decidedAt = new Date();
      } else if (approval.level === ApprovalLevel.MANAGER) {
        const financeApproval = approval.expense.approvals.find(
          (candidate) => candidate.level === ApprovalLevel.FINANCE,
        );

        if (financeApproval) {
          const financeUpdate = await transaction.approval.updateMany({
            where: {
              id: financeApproval.id,
              status: ApprovalStatus.SKIPPED,
              version: financeApproval.version,
            },
            data: {
              status: ApprovalStatus.PENDING,
              version: { increment: 1 },
            },
          });

          if (financeUpdate.count !== 1) {
            throw this.staleApprovalConflict();
          }

          nextStatus = ExpenseStatus.PENDING_FINANCE;
        } else {
          nextStatus = ExpenseStatus.APPROVED;
          decidedAt = new Date();
        }
      } else {
        nextStatus = ExpenseStatus.APPROVED;
        decidedAt = new Date();
      }

      const expenseUpdate = await transaction.expense.updateMany({
        where: {
          id: approval.expenseId,
          status: expectedExpenseStatus,
          version: approval.expense.version,
        },
        data: {
          status: nextStatus,
          version: { increment: 1 },
          ...(rejectionReason ? { rejectionReason } : {}),
          ...(decidedAt ? { decidedAt } : {}),
        },
      });

      if (expenseUpdate.count !== 1) {
        throw this.staleApprovalConflict();
      }

      return transaction.expense.findUniqueOrThrow({
        where: { id: approval.expenseId },
      });
    });

    await this.audit.write({
      organizationId: user.organizationId,
      actorId: user.sub,
      entityType: 'Expense',
      entityId: approval.expenseId,
      action: approved ? 'approval.approved' : 'approval.rejected',
      metadata: {
        level: approval.level,
        comment: dto.comment,
        approvalVersion: dto.expectedVersion + 1,
        expenseVersion: result.version,
      },
    });

    await this.notifications.enqueue({
      type: 'expense.decision',
      recipientEmail: approval.expense.user.email,
      subject: `Expense ${result.status.toLowerCase()}`,
      message: `Your ${approval.expense.currency} ${(
        approval.expense.amountCents / 100
      ).toFixed(2)} expense at ${approval.expense.merchant} is now ${result.status}.`,
    });

    if (result.status === ExpenseStatus.PENDING_FINANCE) {
      await this.notifyNextFinanceApprover(user.organizationId, approval.expenseId);
    }

    return result;
  }

  private staleApprovalConflict() {
    return new ConflictException(
      'This approval changed after you loaded it. Refresh the page and try again.',
    );
  }

  private async notifyNextFinanceApprover(organizationId: string, expenseId: string) {
    const nextApproval = await this.prisma.withTenant(organizationId, (transaction) =>
      transaction.approval.findFirst({
        where: {
          expenseId,
          level: ApprovalLevel.FINANCE,
          status: ApprovalStatus.PENDING,
        },
        include: { approver: true },
      }),
    );

    if (!nextApproval) {
      throw new BadRequestException('Finance approval route is missing');
    }

    await this.notifications.enqueue({
      type: 'approval.requested',
      recipientEmail: nextApproval.approver.email,
      subject: 'Finance approval requested',
      message: `Expense ${expenseId} is ready for finance review.`,
    });
  }
}
