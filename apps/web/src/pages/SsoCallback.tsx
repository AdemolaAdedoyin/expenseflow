import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function SsoCallback() {
  const { accessToken } = useAuth();

  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand big">
          Expense<span>Flow</span>
        </div>
        <h2>Unable to finish SSO sign in</h2>
        <p>
          The identity-provider redirect completed, but ExpenseFlow could not restore a
          session. Try signing in again or use the demo credentials.
        </p>
        <Link className="primary auth-link-button" to="/login">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
