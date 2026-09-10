export type ExpenseStatus =
  | 'DRAFT'
  | 'PENDING_MANAGER'
  | 'PENDING_FINANCE'
  | 'APPROVED'
  | 'REJECTED';

export type ExpenseUser = {
  firstName: string;
  lastName: string;
  email: string;
};

export type Expense = {
  id: string;
  merchant: string;
  amountCents: number;
  currency: string;
  category: string;
  description?: string | null;
  incurredAt: string;
  status: ExpenseStatus;
  user?: ExpenseUser;
};

export type PaginatedExpenses = {
  items: Expense[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type CreateExpensePayload = {
  merchant: string;
  amountCents: number;
  category: string;
  description?: string;
  incurredAt: string;
};

export type Approval = {
  id: string;
  level: 'MANAGER' | 'FINANCE';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
  expense: Expense & {
    user: ExpenseUser;
  };
};

export type ApprovalDecision = 'APPROVE' | 'REJECT';

export type DashboardTotals = {
  amountCents: number;
  expenses: number;
  pending: { amountCents: number; count: number };
  approved: { amountCents: number; count: number };
  rejected: { amountCents: number; count: number };
};

export type DashboardReport = {
  totals: DashboardTotals;
  byCategory: Array<{
    category: string;
    amountCents: number;
  }>;
};

export type ExpensePolicy = {
  id: string;
  name: string;
  category?: string | null;
  minAmountCents?: number | null;
  action: string;
  priority: number;
};
