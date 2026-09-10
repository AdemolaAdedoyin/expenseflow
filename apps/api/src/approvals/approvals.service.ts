import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalLevel, ApprovalStatus, ExpenseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { DecideApprovalDto } from './dto';

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private notifications: NotificationsService) {}

  inbox(user: AuthUser) {
    return this.prisma.approval.findMany({
      where: { approverId: user.sub, status: ApprovalStatus.PENDING, expense: { organizationId: user.organizationId } },
      include: { expense: { include: { user: { select: { firstName: true, lastName: true, email: true, department: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async decide(user: AuthUser, id: string, dto: DecideApprovalDto) {
    const approval = await this.prisma.approval.findFirst({
      where: { id, approverId: user.sub, status: ApprovalStatus.PENDING, expense: { organizationId: user.organizationId } },
      include: { expense: { include: { user: true, approvals: true } } },
    });
    if (!approval) throw new NotFoundException('Pending approval not found');
    const approve = dto.decision === 'APPROVE';

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.approval.update({ where: { id }, data: { status: approve ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED, comment: dto.comment, decidedAt: new Date() } });
      if (!approve) {
        return tx.expense.update({ where: { id: approval.expenseId }, data: { status: ExpenseStatus.REJECTED, rejectionReason: dto.comment || `Rejected by ${approval.level.toLowerCase()} approver`, decidedAt: new Date() } });
      }
      if (approval.level === ApprovalLevel.MANAGER) {
        const financeApproval = approval.expense.approvals.find((a) => a.level === ApprovalLevel.FINANCE);
        if (financeApproval) {
          await tx.approval.update({ where: { id: financeApproval.id }, data: { status: ApprovalStatus.PENDING } });
          return tx.expense.update({ where: { id: approval.expenseId }, data: { status: ExpenseStatus.PENDING_FINANCE } });
        }
      }
      return tx.expense.update({ where: { id: approval.expenseId }, data: { status: ExpenseStatus.APPROVED, decidedAt: new Date() } });
    });

    await this.audit.write({ organizationId: user.organizationId, actorId: user.sub, entityType: 'Expense', entityId: approval.expenseId, action: approve ? 'approval.approved' : 'approval.rejected', metadata: { level: approval.level, comment: dto.comment } });
    await this.notifications.enqueue({ type: 'expense.decision', recipientEmail: approval.expense.user.email, subject: `Expense ${result.status.toLowerCase()}`, message: `Your ${approval.expense.currency} ${(approval.expense.amountCents / 100).toFixed(2)} expense at ${approval.expense.merchant} is now ${result.status}.` });

    if (result.status === ExpenseStatus.PENDING_FINANCE) {
      const next = await this.prisma.approval.findFirst({ where: { expenseId: approval.expenseId, level: ApprovalLevel.FINANCE }, include: { approver: true } });
      if (!next) throw new BadRequestException('Finance approval route is missing');
      await this.notifications.enqueue({ type: 'approval.requested', recipientEmail: next.approver.email, subject: 'Finance approval requested', message: `Expense ${approval.expenseId} is ready for finance review.` });
    }
    return result;
  }
}
