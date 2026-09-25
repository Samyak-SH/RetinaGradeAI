import { useState } from 'react';
import api, { apiError } from '../api/client';

const blank = { name: '', age: '', sex: 'unknown', contact: '', notes: '' };

export default function NewPatientForm({ onCreated }) {
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/patients', form);
      setForm(blank);
      onCreated(data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>New patient</h2>
      {error && <div className="alert">{error}</div>}

      <div className="field-row">
        <div>
          <label htmlFor="p-name">Name</label>
          <input id="p-name" name="name" value={form.name} onChange={change} required />
        </div>
        <div>
          <label htmlFor="p-age">Age</label>
          <input id="p-age" name="age" type="number" min="0" max="130" value={form.age} onChange={change} />
        </div>
        <div>
          <label htmlFor="p-sex">Sex</label>
          <select id="p-sex" name="sex" value={form.sex} onChange={change}>
            <option value="unknown">Unknown</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="p-contact">Contact</label>
          <input id="p-contact" name="contact" value={form.contact} onChange={change} />
        </div>
      </div>

      <div>
        <label htmlFor="p-notes">Clinical notes</label>
        <textarea id="p-notes" name="notes" value={form.notes} onChange={change} />
      </div>

      <div className="row">
        <button className="btn" disabled={busy}>
          {busy && <span className="spinner" />}
          {busy ? 'Saving…' : 'Create patient'}
        </button>
      </div>
    </form>
  );
}
