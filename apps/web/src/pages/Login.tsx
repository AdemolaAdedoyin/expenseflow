import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, ssoStartUrl } from '../lib/api';
import { LoginResponse } from '../types/auth';

type LocationState = {
  from?: {
    pathname?: string;
  };
};

type SsoConfig = {
  enabled: boolean;
};

export default function Login() {
  const [email, setEmail] = useState('employee@demo.com');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  useEffect(() => {
    api<SsoConfig>('/auth/sso/config')
      .then((config) => setSsoEnabled(config.enabled))
      .catch(() => setSsoEnabled(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      login(response.accessToken);

      const state = location.state as LocationState | null;
      navigate(state?.from?.pathname ?? '/', { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to sign in');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand big">
          Expense<span>Flow</span>
        </div>

        <p>Expense operations without the spreadsheet chaos.</p>

        {ssoEnabled && (
          <>
            <button
              className="secondary"
              type="button"
              onClick={() => window.location.assign(ssoStartUrl())}
            >
              Continue with SSO
            </button>
            <div className="auth-divider" aria-hidden="true">
              <span>or</span>
            </div>
          </>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <div className="error">{error}</div>}

        <button className="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>

        <small>Demo: employee@demo.com / Password123!</small>
      </form>
    </div>
  );
}
