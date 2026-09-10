import { Role } from '@prisma/client';

/**
 * Permissions describe business capabilities instead of HTTP routes or UI elements.
 * Keeping them stable lets roles evolve without changing authorization checks across
 * controllers and makes it possible to introduce per-user grants later.
 */
export enum Permission {
  EXPENSE_READ = 'expense:read',
  EXPENSE_CREATE = 'expense:create',
  EXPENSE_SUBMIT = 'expense:submit',
  RECEIPT_MANAGE = 'receipt:manage',
  APPROVAL_REVIEW = 'approval:review',
  POLICY_READ = 'policy:read',
  POLICY_MANAGE = 'policy:manage',
  AUDIT_READ = 'audit:read',
  REPORT_READ = 'report:read',
  USER_READ = 'user:read',
}

const employeePermissions = [
  Permission.EXPENSE_READ,
  Permission.EXPENSE_CREATE,
  Permission.EXPENSE_SUBMIT,
  Permission.RECEIPT_MANAGE,
  Permission.POLICY_READ,
  Permission.REPORT_READ,
] as const;

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.EMPLOYEE]: employeePermissions,
  [Role.MANAGER]: [
    Permission.EXPENSE_READ,
    Permission.APPROVAL_REVIEW,
    Permission.POLICY_READ,
    Permission.REPORT_READ,
    Permission.USER_READ,
  ],
  [Role.FINANCE]: [
    Permission.EXPENSE_READ,
    Permission.APPROVAL_REVIEW,
    Permission.POLICY_READ,
    Permission.POLICY_MANAGE,
    Permission.AUDIT_READ,
    Permission.REPORT_READ,
    Permission.USER_READ,
  ],
  [Role.ADMIN]: Object.values(Permission),
};

export function hasPermission(role: Role, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}
