import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { apiError } from '../api/client';
import LesionViewer from '../components/LesionViewer';

const PALETTE = ['#ffb454', '#4f8cff', '#ff6b9d', '#38d6c4', '#c792ea', '#8bd450', '#ff8a5c'];

// Grade level → colour, and referral urgency → colour.
const GRADE_COLOR = ['#4caf50', '#8bc34a', '#ff9800', '#f44336'];
const URGENCY_COLOR = { routine: '#4caf50', soon: '#ff9800', urgent: '#f44336' };

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

        {scan.grade && scan.grade.label && (
          <div className="grid-2">
            <div className="card" style={{ borderLeft: `4px solid ${GRADE_COLOR[scan.grade.level] || '#888'}` }}>
              <div className="card-head"><h2>DR severity grade</h2></div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span
                  style={{
                    fontSize: '1.6rem', fontWeight: 700,
                    color: GRADE_COLOR[scan.grade.level] || '#888',
                  }}
                >
                  Grade {scan.grade.level}
                </span>
                <span style={{ fontSize: '1.1rem' }}>{scan.grade.label}</span>
              </div>
              <p className="muted small" style={{ margin: '6px 0 0' }}>{scan.grade.criteria}</p>
              {scan.grade.dmeSuspected && (
                <p className="small" style={{ margin: '6px 0 0', color: '#ff9800' }}>
                  ⚠ Hard exudates present — possible macular edema (DME).
                </p>
              )}
              <p className="muted small" style={{ margin: '6px 0 0', fontStyle: 'italic' }}>
                NV not modelled — grade capped at severe NPDR; PDR not assessed.
              </p>
            </div>

            <div className="card" style={{ borderLeft: `4px solid ${URGENCY_COLOR[scan.referral?.urgency] || '#888'}` }}>
              <div className="card-head">
                <h2>Referral recommendation</h2>
                {scan.referral?.urgency && (
                  <span
                    className="pill"
                    style={{ background: URGENCY_COLOR[scan.referral.urgency], color: '#fff', textTransform: 'uppercase' }}
                  >
                    {scan.referral.urgency}
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontWeight: 600 }}>{scan.referral?.action}</p>
              {scan.referral?.timeframe && (
                <p className="muted small" style={{ margin: '4px 0 0' }}>Timeframe: {scan.referral.timeframe}</p>
              )}
              {scan.referral?.note && (
                <p className="small" style={{ margin: '6px 0 0', color: '#ff9800' }}>{scan.referral.note}</p>
              )}
            </div>
          </div>
        )}

        {scan.summary && (
          <div className="card">
            <div className="card-head"><h2>Model summary</h2></div>
            <p style={{ margin: 0 }}>{scan.summary}</p>
          </div>
        )}

        {scan.classStats && Object.keys(scan.classStats).length > 0 && (
          <div className="card">
            <div className="card-head"><h2>Lesion coverage</h2></div>
            <table>
              <thead>
                <tr><th>Lesion type</th><th>Count</th><th>Area (px)</th><th>Coverage</th></tr>
              </thead>
              <tbody>
                {Object.entries(scan.classStats).map(([label, s]) => (
                  <tr key={label}>
                    <td><span className="legend-dot" style={{ background: colorFor(label) }} />{label}</td>
                    <td className="mono">{s.count}</td>
                    <td className="mono small">{s.area_px?.toLocaleString?.() ?? s.area_px}</td>
                    <td className="mono small">{(s.area_pct ?? 0).toFixed(3)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted small" style={{ margin: '8px 0 0' }}>
              Coverage = share of the 1024×1024 processed frame occupied by each lesion class.
            </p>
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
            {scan.maskImage && (
              <div style={{ marginTop: 16 }}>
                <div className="card-head" style={{ marginBottom: 8 }}>
                  <h2>Generated GT mask</h2>
                </div>
                <img
                  src={`/uploads/${scan.maskImage}`}
                  alt="Generated ground-truth segmentation mask"
                  style={{ width: '100%', borderRadius: 8, display: 'block', background: '#000' }}
                />
                <p className="muted small" style={{ margin: '8px 0 0' }}>
                  Lesion segmentation rendered as a mask — each class in its colour on black.
                </p>
              </div>
            )}
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
