import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../lib/api';
import { useAuth } from '../App';

type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    organizationId: string;
  };
};

export default function Login() {
  const [email, setEmail] = useState('employee@demo.com');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  async function submit(e: FormEvent) {
    e.preventDefault();

    setError('');
    setIsSubmitting(true);

    try {
      const response = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
        }),
      });

      login(response.accessToken);

      navigate('/', {
        replace: true,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to sign in';

      setError(message);
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

        <label>
          Email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error && <div className="error">{error}</div>}

        <button
          className="primary"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>

        <small>
          Demo: employee@demo.com / Password123!
        </small>
      </form>
    </div>
  );
}