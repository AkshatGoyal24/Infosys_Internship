import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'admin123', role: 'Admin' },
  { username: 'advisor1', password: 'advisor123', role: 'Advisor' },
  { username: 'advisor2', password: 'advisor123', role: 'Advisor' },
];

export default function Login() {
  const { user, loading, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setUsername(account.username);
    setPassword(account.password);
    setError('');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <span className="brand-name">Infosys Wealth Management</span>
            <span className="brand-sub">Portfolio Oversight Console</span>
          </div>
        </div>

        <h1>Sign in</h1>
        <p className="login-subtitle">Access the portfolio monitoring dashboard.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="control-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div className="control-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error ? <p className="login-error">{error}</p> : null}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="demo-accounts">
          <p>Demo accounts</p>
          <ul>
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.username}>
                <button type="button" className="demo-account-btn" onClick={() => fillDemo(account)}>
                  <strong>{account.role}</strong>
                  <span>
                    {account.username} / {account.password}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
