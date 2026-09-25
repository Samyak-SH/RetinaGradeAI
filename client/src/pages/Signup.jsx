import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiError } from '../api/client';

export default function Signup() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', hospital: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signup(form);
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
          <h1>Create account</h1>
          <p className="muted small">For clinicians reviewing lesion scans.</p>
        </div>

        {error && <div className="alert">{error}</div>}

        <div>
          <label htmlFor="name">Full name</label>
          <input id="name" name="name" value={form.name} onChange={change} required />
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" value={form.email} onChange={change} required />
        </div>
        <div>
          <label htmlFor="hospital">Hospital or clinic</label>
          <input id="hospital" name="hospital" value={form.hospital} onChange={change} />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={change}
            minLength={8}
            required
          />
          <p className="small muted" style={{ margin: '6px 0 0' }}>At least 8 characters.</p>
        </div>

        <button className="btn" disabled={busy}>
          {busy && <span className="spinner" />}
          {busy ? 'Creating…' : 'Create account'}
        </button>

        <p className="small muted" style={{ textAlign: 'center', margin: 0 }}>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
