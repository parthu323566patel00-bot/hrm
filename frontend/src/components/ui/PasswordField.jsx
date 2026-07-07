/**
 * components/ui/PasswordField.jsx
 * --------------------------------
 * Password input with show/hide toggle button.
 *
 * Props:
 *   label    - Field label text
 *   id       - HTML id
 *   value    - Controlled value
 *   onChange - Change handler
 *   ...rest  - Any extra props forwarded to <input>
 */

import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

export default function PasswordField({ label, id, value, onChange, ...rest }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="input-wrapper">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="form-input"
          value={value}
          onChange={onChange}
          {...rest}
        />
        <Lock className="input-icon" size={18} />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          style={{
            position: 'absolute',
            right: '14px',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
          }}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}
