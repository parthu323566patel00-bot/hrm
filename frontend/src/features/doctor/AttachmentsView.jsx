import React, { useState } from 'react';
import { Paperclip, Upload, X } from 'lucide-react';
import { uploadAttachments } from '../../services/visitService';
import Alert from '../../components/ui/Alert';

const MAX = 10 * 1024 * 1024;
const ALLOWED = ['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png', '.dcm'];

export default function AttachmentsView({ visit, token, onSaved, readOnly }) {
  const [files, setFiles]     = useState([]);
  const [saving, setSaving]   = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const attachments = visit.attachments || [];

  const handlePick = (e) => {
    setFileError('');
    const chosen = Array.from(e.target.files);
    const bad = chosen.find(f => !ALLOWED.includes('.' + f.name.split('.').pop().toLowerCase()));
    if (bad) return setErrorMsg(`"${bad.name}" is not allowed.`);
    const big = chosen.find(f => f.size > MAX);
    if (big) return setErrorMsg(`"${big.name}" exceeds 10 MB.`);
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...chosen.filter(f => !names.has(f.name))];
    });
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setSaving(true); setErrorMsg(''); setSuccessMsg('');
    try {
      await uploadAttachments(token, visit.id, files);
      setFiles([]); setSuccessMsg(`${files.length} file(s) uploaded.`); onSaved?.();
    } catch (err) { setErrorMsg(err.message); }
    finally { setSaving(false); }
  };

  function setFileError(msg) { setErrorMsg(msg); }

  const fmtSize = (b) => b > 1024*1024 ? `${(b/1024/1024).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`;

  return (
    <div>
      <Alert type="error" message={errorMsg} />
      <Alert type="success" message={successMsg} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {attachments.length === 0 && <p style={{ color: '#94a3b8', fontSize: '13px' }}>No attachments yet.</p>}
        {attachments.map(a => (
          <div key={a.id} style={{
            padding: '10px 14px', background: '#f8fafc',
            border: '1px solid #e2e8f0', borderRadius: '10px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <Paperclip size={14} color="#64748b" />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{a.original_filename}</span>
              <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>{fmtSize(a.file_size)}</span>
            </div>
          </div>
        ))}
      </div>

      {!readOnly && (
        <>
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '20px', border: '2px dashed #cbd5e1', borderRadius: '12px',
            cursor: 'pointer', background: '#f8fafc', marginBottom: '12px',
          }}>
            <Upload size={22} color="#94a3b8" />
            <span style={{ fontSize: '13px', color: '#64748b', marginTop: '6px', fontWeight: 600 }}>Click to select files</span>
            <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>PDF, DOCX, JPG, PNG, DICOM · max 10 MB</span>
            <input type="file" multiple accept={ALLOWED.join(',')} style={{ display: 'none' }} onChange={handlePick} />
          </label>
          {files.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
              {files.map(f => (
                <div key={f.name} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '12px',
                }}>
                  <span style={{ flex: 1, color: '#334155' }}>{f.name} <span style={{ color: '#94a3b8' }}>({fmtSize(f.size)})</span></span>
                  <button onClick={() => setFiles(p => p.filter(x => x.name !== f.name))}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button onClick={handleUpload} disabled={saving || !files.length}
            className="submit-btn" style={{ padding: '9px', width: 'auto', paddingLeft: 20, paddingRight: 20 }}>
            <Upload size={14} /> {saving ? 'Uploading…' : `Upload ${files.length || ''} File(s)`}
          </button>
        </>
      )}
    </div>
  );
}
