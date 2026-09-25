import { useRef, useState } from 'react';
import api, { apiError } from '../api/client';

export default function ScanUpload({ patientId, onUploaded }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!file) return;

    setBusy(true);
    setError('');
    const body = new FormData();
    body.append('image', file);

    try {
      const { data } = await api.post(`/patients/${patientId}/scans`, body);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onUploaded(data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      {error && <div className="alert">{error}</div>}
      <div>
        <label htmlFor="scan-file">Lesion image</label>
        <input
          id="scan-file"
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>
      <button className="btn" disabled={!file || busy}>
        {busy && <span className="spinner" />}
        {busy ? 'Running model…' : 'Upload and analyse'}
      </button>
      {busy && <p className="small muted" style={{ margin: 0 }}>Inference can take a few seconds.</p>}
    </form>
  );
}
