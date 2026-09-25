import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiError } from '../api/client';
import NewPatientForm from '../components/NewPatientForm';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—');

export default function Dashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async (term) => {
    try {
      const { data } = await api.get('/patients', { params: { search: term } });
      setPatients(data);
      setError('');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce so typing a name does not fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => load(search), 250);
    return () => clearTimeout(id);
  }, [search, load]);

  const totalScans = patients.reduce((sum, p) => sum + p.scanCount, 0);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Patients</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            Every patient record you have created, newest activity first.
          </p>
        </div>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Close' : 'New patient'}
        </button>
      </div>

      <div className="stack">
        {error && <div className="alert">{error}</div>}

        {showForm && (
          <NewPatientForm
            onCreated={(p) => {
              setShowForm(false);
              navigate(`/patients/${p._id}`);
            }}
          />
        )}

        <div className="stat-grid">
          <div className="stat">
            <div className="value">{patients.length}</div>
            <div className="label">Patients</div>
          </div>
          <div className="stat">
            <div className="value">{totalScans}</div>
            <div className="label">Scans on record</div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Records</h2>
            <input
              style={{ maxWidth: 280 }}
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="empty">Loading patients…</div>
          ) : patients.length === 0 ? (
            <div className="empty">
              {search ? `No patient matches “${search}”.` : 'No patients yet. Create the first record.'}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Sex</th>
                  <th>Scans</th>
                  <th>Last scan</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p._id} className="clickable" onClick={() => navigate(`/patients/${p._id}`)}>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td>{p.age ?? '—'}</td>
                    <td className="muted">{p.sex}</td>
                    <td>{p.scanCount}</td>
                    <td className="muted">{fmtDate(p.lastScan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
