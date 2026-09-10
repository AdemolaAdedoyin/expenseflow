import { Role } from '@prisma/client';
import { hasPermission, Permission } from './permissions';

describe('permission model', () => {
  it('lets employees create and submit expenses without approval privileges', () => {
    expect(hasPermission(Role.EMPLOYEE, Permission.EXPENSE_CREATE)).toBe(true);
    expect(hasPermission(Role.EMPLOYEE, Permission.EXPENSE_SUBMIT)).toBe(true);
    expect(hasPermission(Role.EMPLOYEE, Permission.APPROVAL_REVIEW)).toBe(false);
  });

  it('lets finance manage policy and approval capabilities without employee mutation rights', () => {
    expect(hasPermission(Role.FINANCE, Permission.APPROVAL_REVIEW)).toBe(true);
    expect(hasPermission(Role.FINANCE, Permission.POLICY_MANAGE)).toBe(true);
    expect(hasPermission(Role.FINANCE, Permission.EXPENSE_CREATE)).toBe(false);
  });

  it('keeps employee-only mutations out of the admin role', () => {
    expect(hasPermission(Role.ADMIN, Permission.AUDIT_READ)).toBe(true);
    expect(hasPermission(Role.ADMIN, Permission.POLICY_MANAGE)).toBe(true);
    expect(hasPermission(Role.ADMIN, Permission.EXPENSE_CREATE)).toBe(false);
    expect(hasPermission(Role.ADMIN, Permission.EXPENSE_SUBMIT)).toBe(false);
  });
});
