import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import PermissionRoute from './auth/PermissionRoute';
import RequireAuth from './auth/RequireAuth';
import AppShell from './components/AppShell';
import Approvals from './pages/Approvals';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Login from './pages/Login';
import Operations from './pages/Operations';
import Policies from './pages/Policies';
import SsoCallback from './pages/SsoCallback';

function LoginRoute() {
  const { accessToken } = useAuth();

  return accessToken ? <Navigate to="/" replace /> : <Login />;
}

function AppRoutes() {
  const { isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="brand big">
            Expense<span>Flow</span>
          </div>
          <p>Restoring your session...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/sso/callback" element={<SsoCallback />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="policies" element={<Policies />} />

          <Route element={<PermissionRoute permission="approval:review" />}>
            <Route path="approvals" element={<Approvals />} />
          </Route>

          <Route element={<PermissionRoute permission="operations:read" />}>
            <Route path="operations" element={<Operations />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
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
