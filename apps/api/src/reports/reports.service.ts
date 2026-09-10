import { Injectable } from '@nestjs/common';
import { ExpenseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}
  async dashboard(organizationId: string) {
    const [all, pending, approved, rejected, byCategory] = await Promise.all([
      this.prisma.expense.aggregate({ where: { organizationId }, _count: true, _sum: { amountCents: true } }),
      this.prisma.expense.aggregate({ where: { organizationId, status: { in: [ExpenseStatus.PENDING_MANAGER, ExpenseStatus.PENDING_FINANCE] } }, _count: true, _sum: { amountCents: true } }),
      this.prisma.expense.aggregate({ where: { organizationId, status: ExpenseStatus.APPROVED }, _count: true, _sum: { amountCents: true } }),
      this.prisma.expense.aggregate({ where: { organizationId, status: ExpenseStatus.REJECTED }, _count: true, _sum: { amountCents: true } }),
      this.prisma.expense.groupBy({ by: ['category'], where: { organizationId }, _sum: { amountCents: true }, _count: true, orderBy: { _sum: { amountCents: 'desc' } }, take: 8 }),
    ]);
    return {
      totals: {
        expenses: all._count,
        amountCents: all._sum.amountCents ?? 0,
        pending: { count: pending._count, amountCents: pending._sum.amountCents ?? 0 },
        approved: { count: approved._count, amountCents: approved._sum.amountCents ?? 0 },
        rejected: { count: rejected._count, amountCents: rejected._sum.amountCents ?? 0 },
      },
      byCategory: byCategory.map((x) => ({ category: x.category, count: x._count, amountCents: x._sum.amountCents ?? 0 })),
    };
  }
}
