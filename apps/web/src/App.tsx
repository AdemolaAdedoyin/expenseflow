import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import RequireAuth from './auth/RequireAuth';
import RoleRoute from './auth/RoleRoute';
import AppShell from './components/AppShell';
import Approvals from './pages/Approvals';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Login from './pages/Login';
import Policies from './pages/Policies';

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

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="policies" element={<Policies />} />

          <Route
            element={<RoleRoute allowedRoles={['MANAGER', 'FINANCE', 'ADMIN']} />}
          >
            <Route path="approvals" element={<Approvals />} />
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
