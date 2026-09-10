import { Navigate, Outlet } from 'react-router-dom';
import { UserRole } from '../types/auth';
import { useCurrentUser } from './useCurrentUser';

type RoleRouteProps = {
  allowedRoles: UserRole[];
};

export default function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return <div className="route-loading">Loading...</div>;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
