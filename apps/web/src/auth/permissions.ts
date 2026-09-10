import { UserRole } from '../types/auth';

export type Permission =
  | 'expense:read'
  | 'expense:create'
  | 'expense:submit'
  | 'receipt:manage'
  | 'approval:review'
  | 'policy:read'
  | 'policy:manage'
  | 'audit:read'
  | 'report:read'
  | 'user:read';

const rolePermissions: Record<UserRole, readonly Permission[]> = {
  EMPLOYEE: [
    'expense:read',
    'expense:create',
    'expense:submit',
    'receipt:manage',
    'policy:read',
    'report:read',
  ],
  MANAGER: ['expense:read', 'approval:review', 'policy:read', 'report:read', 'user:read'],
  FINANCE: [
    'expense:read',
    'approval:review',
    'policy:read',
    'policy:manage',
    'audit:read',
    'report:read',
    'user:read',
  ],
  ADMIN: [
    'expense:read',
    'expense:create',
    'expense:submit',
    'receipt:manage',
    'approval:review',
    'policy:read',
    'policy:manage',
    'audit:read',
    'report:read',
    'user:read',
  ],
};

/**
 * Frontend permission checks only control what the UI exposes. The API guard is
 * still the authorization boundary, so hiding an action here never replaces a
 * server-side capability check.
 */
export function hasPermission(role: UserRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}
