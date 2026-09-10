import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  ReceiptText,
  CheckSquare,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

import { api } from './lib/api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Approvals from './pages/Approvals';
import Policies from './pages/Policies';

type AuthContextValue = {
  accessToken: string | null;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem('token'),
  );

  function login(token: string) {
    localStorage.setItem('token', token);
    setAccessToken(token);
  }

  function logout() {
    localStorage.removeItem('token');
    setAccessToken(null);
  }

  const value = useMemo(
    () => ({
      accessToken,
      login,
      logout,
    }),
    [accessToken],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

function Shell() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<any>('/auth/me'),
  });

  function handleLogout() {
    setSidebarOpen(false);
    logout();
    navigate('/login', { replace: true });
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

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

        <div className="org">
          {user?.organization?.name || 'Workspace'}
        </div>

        <nav>
          <a href="/" onClick={closeSidebar}>
            <LayoutDashboard />
            Overview
          </a>

          <a href="/expenses" onClick={closeSidebar}>
            <ReceiptText />
            Expenses
          </a>

          <a href="/approvals" onClick={closeSidebar}>
            <CheckSquare />
            Approvals
          </a>

          <a href="/policies" onClick={closeSidebar}>
            <ShieldCheck />
            Policies
          </a>
        </nav>

        <button
          className="logout"
          type="button"
          onClick={handleLogout}
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

          <div className="user-info">
            <b>
              {user?.firstName} {user?.lastName}
            </b>

            <small>{user?.role}</small>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/policies" element={<Policies />} />
        </Routes>
      </main>
    </div>
  );
}

function AppRoutes() {
  const { accessToken } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          accessToken ? (
            <Navigate to="/" replace />
          ) : (
            <Login />
          )
        }
      />

      <Route
        path="/*"
        element={
          accessToken ? (
            <Shell />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}