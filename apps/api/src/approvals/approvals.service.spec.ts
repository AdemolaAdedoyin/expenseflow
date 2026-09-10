import { ConflictException } from '@nestjs/common';
import { ApprovalLevel, ApprovalStatus, ExpenseStatus, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalsService } from './approvals.service';

const user: AuthUser = {
  sub: 'manager-1',
  email: 'manager@example.com',
  organizationId: 'org-1',
  role: Role.MANAGER,
};

function approvalFixture() {
  return {
    id: 'approval-1',
    expenseId: 'expense-1',
    approverId: user.sub,
    level: ApprovalLevel.MANAGER,
    status: ApprovalStatus.PENDING,
    version: 2,
    comment: null,
    decidedAt: null,
    createdAt: new Date(),
    expense: {
      id: 'expense-1',
      organizationId: user.organizationId,
      userId: 'employee-1',
      merchant: 'Example Travel',
      amountCents: 25000,
      currency: 'USD',
      category: 'Travel',
      description: null,
      receiptUrl: null,
      incurredAt: new Date(),
      status: ExpenseStatus.PENDING_MANAGER,
      rejectionReason: null,
      submittedAt: new Date(),
      decidedAt: null,
      version: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'employee-1',
        organizationId: user.organizationId,
        email: 'employee@example.com',
        passwordHash: 'hash',
        firstName: 'Employee',
        lastName: 'One',
        role: Role.EMPLOYEE,
        department: null,
        managerId: user.sub,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      approvals: [],
    },
  };
}

describe('ApprovalsService optimistic locking', () => {
  it('rejects a decision made from a stale approval version', async () => {
    const prisma = {
      approval: {
        findFirst: jest.fn().mockResolvedValue(approvalFixture()),
      },
    } as unknown as PrismaService;

    const service = new ApprovalsService(
      prisma,
      {} as AuditService,
      {} as NotificationsService,
    );

    await expect(
      service.decide(user, 'approval-1', {
        decision: 'APPROVE',
        expectedVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a competing decision when the compare-and-swap update loses', async () => {
    const transaction = {
      approval: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const prisma = {
      approval: {
        findFirst: jest.fn().mockResolvedValue(approvalFixture()),
      },
      $transaction: jest.fn(
        async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
      ),
    } as unknown as PrismaService;

    const service = new ApprovalsService(
      prisma,
      {} as AuditService,
      {} as NotificationsService,
    );

    await expect(
      service.decide(user, 'approval-1', {
        decision: 'APPROVE',
        expectedVersion: 2,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
