import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
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
import { useCurrentUser } from '../auth/useCurrentUser';

const approverRoles = new Set(['MANAGER', 'FINANCE', 'ADMIN']);

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

  const canApprove = user ? approverRoles.has(user.role) : false;

  return (
    <div className="shell">
      <aside className={sidebarOpen ? 'sidebar-open' : ''}>
        <button
          className="sidebar-close"
          type="button"
          onClick={closeSidebar}
          aria-label="Close navigation"
        >
          <X />
        </button>

        <div className="brand">
          Expense<span>Flow</span>
        </div>

        <div className="org">{user?.organization?.name ?? 'Workspace'}</div>

        <nav aria-label="Primary navigation">
          <NavLink to="/" end onClick={closeSidebar}>
            <LayoutDashboard />
            Overview
          </NavLink>

          <NavLink to="/expenses" onClick={closeSidebar}>
            <ReceiptText />
            Expenses
          </NavLink>

          {canApprove && (
            <NavLink to="/approvals" onClick={closeSidebar}>
              <CheckSquare />
              Approvals
            </NavLink>
          )}

          <NavLink to="/policies" onClick={closeSidebar}>
            <ShieldCheck />
            Policies
          </NavLink>
        </nav>

        <button
          className="logout"
          type="button"
          onClick={() => void handleLogout()}
        >
          <LogOut />
          Sign out
        </button>
      </aside>

      {sidebarOpen && (
        <button
          className="sidebar-overlay"
          type="button"
          onClick={closeSidebar}
          aria-label="Close navigation"
        />
      )}

      <main>
        <header>
          <button
            className="menu-button"
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>

          <div className="user-info" aria-live="polite">
            {isLoading ? (
              <small>Loading account...</small>
            ) : (
              <>
                <b>
                  {user?.firstName} {user?.lastName}
                </b>
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
