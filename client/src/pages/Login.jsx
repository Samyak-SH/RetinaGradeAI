import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiError } from '../api/client';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card stack" onSubmit={submit}>
        <div>
          <h1>Sign in</h1>
          <p className="muted small">Access your patient scan records.</p>
        </div>

        {error && <div className="alert">{error}</div>}

        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" value={form.email} onChange={change} required />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={change}
            required
          />
        </div>

        <button className="btn" disabled={busy}>
          {busy && <span className="spinner" />}
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>
          No account yet? <Link to="/signup">Create one</Link>
        </p>
      </form>
    </div>
  );
}
