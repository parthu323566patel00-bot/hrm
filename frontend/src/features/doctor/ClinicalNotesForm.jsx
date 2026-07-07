import React, { useState } from 'react';
import { FileText, Plus, Edit2, Save } from 'lucide-react';
import { addNote, updateNote } from '../../services/visitService';
import Alert from '../../components/ui/Alert';

export default function ClinicalNotesForm({ visit, token, onSaved, readOnly }) {
  const [content, setContent]     = useState('');
  const [editId, setEditId]       = useState(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving]       = useState(false);
  const [errorMsg, setErrorMsg]   = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const notes = visit.notes || [];

  const handleAdd = async () => {
    if (!content.trim()) return setErrorMsg('Note cannot be empty.');
    setSaving(true); setErrorMsg(''); setSuccessMsg('');
    try {
      await addNote(token, visit.id, content.trim());
      setContent(''); setSuccessMsg('Note added.'); onSaved?.();
    } catch (err) { setErrorMsg(err.message); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (id) => {
    if (!editContent.trim()) return;
    setSaving(true); setErrorMsg(''); setSuccessMsg('');
    try {
      await updateNote(token, visit.id, id, editContent.trim());
      setEditId(null); setSuccessMsg('Note updated.'); onSaved?.();
    } catch (err) { setErrorMsg(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <Alert type="error" message={errorMsg} />
      <Alert type="success" message={successMsg} />

      {/* Existing notes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        {notes.length === 0 && <p style={{ color: '#94a3b8', fontSize: '13px' }}>No notes yet.</p>}
        {notes.map(n => (
          <div key={n.id} style={{
            padding: '12px 14px', background: '#f8fafc',
            border: '1px solid #e2e8f0', borderRadius: '10px',
          }}>
            {editId === n.id ? (
              <div>
                <textarea
                  className="form-input"
                  style={{ padding: '8px 10px', resize: 'vertical', minHeight: '80px', marginBottom: '8px' }}
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleUpdate(n.id)} disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px',
                      borderRadius: '7px', background: 'var(--color-primary)', border: 'none',
                      color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    <Save size={12} /> Save
                  </button>
                  <button onClick={() => setEditId(null)}
                    style={{ padding: '6px 12px', borderRadius: '7px', background: '#f1f5f9',
                      border: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <p style={{ fontSize: '13px', color: '#0f172a', whiteSpace: 'pre-wrap', flex: 1 }}>{n.content}</p>
                {!readOnly && (
                  <button onClick={() => { setEditId(n.id); setEditContent(n.content); }}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', flexShrink: 0 }}>
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
            )}
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
              {new Date(n.written_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* New note */}
      {!readOnly && (
        <>
          <textarea
            className="form-input"
            style={{ padding: '10px 12px', resize: 'vertical', minHeight: '100px', marginBottom: '10px' }}
            placeholder="Enter clinical notes…"
            value={content}
            onChange={e => { setContent(e.target.value); setErrorMsg(''); }}
          />
          <button onClick={handleAdd} disabled={saving}
            className="submit-btn" style={{ padding: '9px', width: 'auto', paddingLeft: 20, paddingRight: 20 }}>
            <Plus size={14} /> {saving ? 'Saving…' : 'Add Note'}
          </button>
        </>
      )}
    </div>
  );
}
