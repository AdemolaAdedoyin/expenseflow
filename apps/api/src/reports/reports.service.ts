import { Injectable } from '@nestjs/common';
import { ExpenseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  dashboard(organizationId: string) {
    return this.prisma.withTenant(organizationId, async (transaction) => {
      const [all, pending, approved, rejected, byCategory] = await Promise.all([
        transaction.expense.aggregate({
          where: { organizationId },
          _count: true,
          _sum: { amountCents: true },
        }),
        transaction.expense.aggregate({
          where: {
            organizationId,
            status: {
              in: [ExpenseStatus.PENDING_MANAGER, ExpenseStatus.PENDING_FINANCE],
            },
          },
          _count: true,
          _sum: { amountCents: true },
        }),
        transaction.expense.aggregate({
          where: { organizationId, status: ExpenseStatus.APPROVED },
          _count: true,
          _sum: { amountCents: true },
        }),
        transaction.expense.aggregate({
          where: { organizationId, status: ExpenseStatus.REJECTED },
          _count: true,
          _sum: { amountCents: true },
        }),
        transaction.expense.groupBy({
          by: ['category'],
          where: { organizationId },
          _sum: { amountCents: true },
          _count: true,
          orderBy: { _sum: { amountCents: 'desc' } },
          take: 8,
        }),
      ]);

      return {
        totals: {
          expenses: all._count,
          amountCents: all._sum.amountCents ?? 0,
          pending: {
            count: pending._count,
            amountCents: pending._sum.amountCents ?? 0,
          },
          approved: {
            count: approved._count,
            amountCents: approved._sum.amountCents ?? 0,
          },
          rejected: {
            count: rejected._count,
            amountCents: rejected._sum.amountCents ?? 0,
          },
        },
        byCategory: byCategory.map((item) => ({
          category: item.category,
          count: item._count,
          amountCents: item._sum.amountCents ?? 0,
        })),
      };
    });
  }
}
