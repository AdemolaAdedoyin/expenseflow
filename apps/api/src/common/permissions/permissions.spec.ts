import { Role } from '@prisma/client';
import { hasPermission, Permission, ROLE_PERMISSIONS } from './permissions';

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

  it('grants administrators every defined capability', () => {
    expect(new Set(ROLE_PERMISSIONS[Role.ADMIN])).toEqual(new Set(Object.values(Permission)));
  });
});
