import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { apiError } from '../api/client';
import LesionViewer from '../components/LesionViewer';

const PALETTE = ['#ffb454', '#4f8cff', '#ff6b9d', '#38d6c4', '#c792ea', '#8bd450', '#ff8a5c'];

const fmtDateTime = (d) =>
  new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function ScanReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [focused, setFocused] = useState(null);
  const [view, setView] = useState('processed');

  useEffect(() => {
    api
      .get(`/scans/${id}`)
      .then(({ data }) => setScan(data))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  // Stable colour per label so the table legend matches the boxes.
  const colorFor = useMemo(() => {
    const labels = [...new Set((scan?.lesions || []).map((l) => l.label))];
    return (label) => PALETTE[Math.max(0, labels.indexOf(label)) % PALETTE.length];
  }, [scan]);

  const counts = useMemo(() => {
    const map = new Map();
    for (const l of scan?.lesions || []) map.set(l.label, (map.get(l.label) || 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [scan]);

  async function removeScan() {
    if (!confirm('Delete this scan and its report?')) return;
    const patientId = scan.patient._id || scan.patient;
    try {
      await api.delete(`/scans/${id}`);
      navigate(`/patients/${patientId}`);
    } catch (err) {
      setError(apiError(err));
    }
  }

  if (loading) return <main className="page"><div className="empty">Loading report…</div></main>;
  if (!scan) return <main className="page"><div className="alert">{error || 'Scan not found.'}</div></main>;

  const patientId = scan.patient?._id || scan.patient;
  // Lesion boxes are normalised against the preprocessed 1024px frame, so the
  // original upload is offered as a separate view rather than an overlay target.
  const views = {
    processed: { src: `/uploads/${scan.displayImage || scan.inputImage}`, boxes: true },
    overlay: { src: `/uploads/${scan.overlayImage}`, boxes: false },
    original: { src: `/uploads/${scan.inputImage}`, boxes: false },
  };
  const active = views[view] || views.processed;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <Link to={`/patients/${patientId}`} className="small">← {scan.patient?.name || 'Patient'}</Link>
          <h1 style={{ marginTop: 6 }}>Scan report</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            {fmtDateTime(scan.createdAt)}
            {scan.modelName ? ` · ${scan.modelName}` : ''}
            {scan.device ? ` · ${scan.device}` : ''}
            {scan.inferenceMs ? ` · ${Math.round(scan.inferenceMs)} ms` : ''}
          </p>
        </div>
        <button className="btn danger small" onClick={removeScan}>Delete scan</button>
      </div>

      <div className="stack">
        {error && <div className="alert">{error}</div>}
        {scan.status === 'failed' && (
          <div className="alert">Model inference failed: {scan.error || 'unknown error'}</div>
        )}

        <div className="stat-grid">
          <div className="stat">
            <div className="value">{scan.lesionCount}</div>
            <div className="label">Total lesions</div>
          </div>
          {counts.slice(0, 4).map(([label, n]) => (
            <div className="stat" key={label}>
              <div className="value">{n}</div>
              <div className="label">
                <span className="legend-dot" style={{ background: colorFor(label) }} />
                {label}
              </div>
            </div>
          ))}
        </div>

        {scan.summary && (
          <div className="card">
            <div className="card-head"><h2>Model summary</h2></div>
            <p style={{ margin: 0 }}>{scan.summary}</p>
          </div>
        )}

        <div className="grid-2">
          <div className="card">
            <div className="card-head">
              <h2>Input image</h2>
              <select
                style={{ width: 'auto' }}
                value={view}
                onChange={(e) => setView(e.target.value)}
              >
                <option value="processed">Preprocessed</option>
                {scan.overlayImage && <option value="overlay">Model overlay</option>}
                <option value="original">Original upload</option>
              </select>
            </div>
            <LesionViewer
              key={view}
              src={active.src}
              lesions={active.boxes ? scan.lesions : []}
              colorFor={colorFor}
              focusedIndex={focused}
              onFocusChange={active.boxes ? setFocused : undefined}
            />
          </div>

          <div className="card fill">
            <div className="card-head">
              <h2>Detected lesions</h2>
              <span className="pill">{scan.lesionCount}</span>
            </div>

            {scan.lesions.length === 0 ? (
              <div className="empty">
                {scan.status === 'complete' ? 'No lesions detected in this image.' : 'No results.'}
              </div>
            ) : (
              <div className="lesion-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Type</th>
                      <th>Location</th>
                      <th>Conf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scan.lesions.map((l, i) => (
                      <tr
                        key={i}
                        className={`clickable${focused === i ? ' active' : ''}`}
                        onMouseEnter={() => setFocused(i)}
                        onMouseLeave={() => setFocused(null)}
                      >
                        <td className="muted">{i + 1}</td>
                        <td>
                          <span className="legend-dot" style={{ background: colorFor(l.label) }} />
                          {l.label}
                        </td>
                        <td className="small">
                          {l.region && <div>{l.region}</div>}
                          <div className="muted mono" style={{ fontSize: '0.75rem' }}>
                            x {(l.bbox.x * 100).toFixed(1)}% · y {(l.bbox.y * 100).toFixed(1)}%
                          </div>
                        </td>
                        <td className="mono small">{(l.confidence * 100).toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
