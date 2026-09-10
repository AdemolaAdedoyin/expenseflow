import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  CheckSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  ShieldCheck,
  X,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { hasPermission } from '../auth/permissions';
import { useCurrentUser } from '../auth/useCurrentUser';

export default function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const { data: user, isError, isLoading } = useCurrentUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (isError) {
      queryClient.clear();
      void logout();
    }
  }, [isError, logout, queryClient]);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  async function handleLogout() {
    closeSidebar();
    queryClient.clear();
    await logout();
    navigate('/login', { replace: true });
  }

  const canReviewApprovals = user ? hasPermission(user.role, 'approval:review') : false;
  const canViewOperations = user ? hasPermission(user.role, 'operations:read') : false;

  return (
    <div className="shell">
      <aside className={sidebarOpen ? 'sidebar-open' : ''}>
        <button className="sidebar-close" type="button" onClick={closeSidebar} aria-label="Close navigation">
          <X />
        </button>

        <div className="brand">Expense<span>Flow</span></div>
        <div className="org">{user?.organization?.name ?? 'Workspace'}</div>

        <nav aria-label="Primary navigation">
          <NavLink to="/" end onClick={closeSidebar}><LayoutDashboard />Overview</NavLink>
          <NavLink to="/expenses" onClick={closeSidebar}><ReceiptText />Expenses</NavLink>

          {canReviewApprovals && (
            <NavLink to="/approvals" onClick={closeSidebar}><CheckSquare />Approvals</NavLink>
          )}

          <NavLink to="/policies" onClick={closeSidebar}><ShieldCheck />Policies</NavLink>

          {canViewOperations && (
            <NavLink to="/operations" onClick={closeSidebar}><Activity />Operations</NavLink>
          )}
        </nav>

        <button className="logout" type="button" onClick={() => void handleLogout()}>
          <LogOut />Sign out
        </button>
      </aside>

      {sidebarOpen && (
        <button className="sidebar-overlay" type="button" onClick={closeSidebar} aria-label="Close navigation" />
      )}

      <main>
        <header>
          <button className="menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
            <Menu />
          </button>

          <div className="user-info" aria-live="polite">
            {isLoading ? (
              <small>Loading account...</small>
            ) : (
              <>
                <b>{user?.firstName} {user?.lastName}</b>
                <small>{user?.role}</small>
              </>
            )}
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
