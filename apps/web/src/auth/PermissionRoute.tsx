import { Navigate, Outlet } from 'react-router-dom';
import { useCurrentUser } from './useCurrentUser';
import { hasPermission, Permission } from './permissions';

export default function PermissionRoute({ permission }: { permission: Permission }) {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return null;
  }

  if (!user || !hasPermission(user.role, permission)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
