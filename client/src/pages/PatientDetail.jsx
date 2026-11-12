import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { apiError } from '../api/client';
import ScanUpload from '../components/ScanUpload';

const fmtDateTime = (d) =>
  new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const GRADE_COLOR = ['#4caf50', '#8bc34a', '#ff9800', '#f44336'];

function StatusPill({ status }) {
  const cls = status === 'complete' ? 'ok' : status === 'failed' ? 'bad' : 'pending';
  return <span className={`pill ${cls}`}>{status}</span>;
}

// A2 — lesion-count progression over time, drawn as a dependency-free SVG.
function Progression({ scans }) {
  const series = scans
    .filter((s) => s.status === 'complete')
    .map((s) => ({ t: new Date(s.createdAt), n: s.lesionCount || 0, grade: s.grade }))
    .sort((a, b) => a.t - b.t);

  if (series.length < 2) {
    return (
      <div className="empty">Two or more completed scans are needed to show progression.</div>
    );
  }

  const W = 520, H = 140, P = 28;
  const max = Math.max(...series.map((d) => d.n), 1);
  const x = (i) => P + (i * (W - 2 * P)) / (series.length - 1);
  const y = (n) => H - P - (n * (H - 2 * P)) / max;
  const path = series.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.n)}`).join(' ');
  const first = series[0].n, last = series[series.length - 1].n;
  const delta = last - first;

  return (
    <div>
      <p className="small" style={{ margin: '0 0 8px' }}>
        Lesion count: {first} → {last}{' '}
        <span style={{ color: delta > 0 ? '#f44336' : delta < 0 ? '#4caf50' : '#888', fontWeight: 600 }}>
          ({delta > 0 ? '+' : ''}{delta})
        </span>
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        <polyline points={`${P},${H - P} ${W - P},${H - P}`} stroke="#ccc" fill="none" />
        <path d={path} fill="none" stroke="#4f8cff" strokeWidth="2" />
        {series.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.n)} r="4" fill={GRADE_COLOR[d.grade?.level] || '#4f8cff'} />
            <text x={x(i)} y={y(d.n) - 8} fontSize="10" textAnchor="middle" fill="currentColor">{d.n}</text>
          </g>
        ))}
      </svg>
      <div className="small muted" style={{ marginTop: 6 }}>
        Point colour = DR grade (green→red). Earliest on the left, latest on the right.
      </div>
    </div>
  );
}

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [scans, setScans] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/patients/${id}`)
      .then(({ data }) => {
        setPatient(data.patient);
        setScans(data.scans);
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  async function removePatient() {
    if (!confirm(`Delete ${patient.name} and all their scans? This cannot be undone.`)) return;
    try {
      await api.delete(`/patients/${id}`);
      navigate('/');
    } catch (err) {
      setError(apiError(err));
    }
  }

  if (loading) return <main className="page"><div className="empty">Loading record…</div></main>;
  if (!patient) return <main className="page"><div className="alert">{error || 'Patient not found.'}</div></main>;

  const totalLesions = scans.reduce((sum, s) => sum + (s.lesionCount || 0), 0);

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <Link to="/" className="small">← All patients</Link>
          <h1 style={{ marginTop: 6 }}>{patient.name}</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {patient.age ? `${patient.age} yrs` : 'Age unknown'} · {patient.sex}
            {patient.contact ? ` · ${patient.contact}` : ''}
          </p>
        </div>
        <button className="btn danger small" onClick={removePatient}>Delete patient</button>
      </div>

      <div className="stack">
        {error && <div className="alert">{error}</div>}

        <div className="stat-grid">
          <div className="stat">
            <div className="value">{scans.length}</div>
            <div className="label">Scans</div>
          </div>
          <div className="stat">
            <div className="value">{totalLesions}</div>
            <div className="label">Lesions detected</div>
          </div>
          <div className="stat">
            <div className="value">{scans[0] ? fmtDateTime(scans[0].createdAt).split(',')[0] : '—'}</div>
            <div className="label">Most recent</div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>DR progression</h2></div>
          <Progression scans={scans} />
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-head"><h2>Scan history</h2></div>
            {scans.length === 0 ? (
              <div className="empty">No scans yet. Upload the first lesion image.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Grade</th>
                    <th>Lesions</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {scans.map((s) => (
                    <tr key={s._id} className="clickable" onClick={() => navigate(`/scans/${s._id}`)}>
                      <td>{fmtDateTime(s.createdAt)}</td>
                      <td><StatusPill status={s.status} /></td>
                      <td>
                        {s.status === 'complete' && s.grade && s.grade.label ? (
                          <span style={{ color: GRADE_COLOR[s.grade.level] || 'inherit', fontWeight: 600 }}>
                            G{s.grade.level}
                          </span>
                        ) : '—'}
                      </td>
                      <td>{s.status === 'complete' ? s.lesionCount : '—'}</td>
                      <td className="small">View report →</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="stack">
            <div className="card">
              <div className="card-head"><h2>New scan</h2></div>
              <ScanUpload patientId={id} onUploaded={(scan) => navigate(`/scans/${scan._id}`)} />
            </div>

            {patient.notes && (
              <div className="card">
                <div className="card-head"><h2>Clinical notes</h2></div>
                <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{patient.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
