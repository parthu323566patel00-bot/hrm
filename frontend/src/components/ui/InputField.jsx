/**
 * components/ui/InputField.jsx
 * ----------------------------
 * Labelled text/email/select input with a left-side icon.
 *
 * Props:
 *   label       - Field label text
 *   id          - HTML id (also used for htmlFor)
 *   icon        - Lucide icon component (optional)
 *   type        - input type (default 'text')
 *   children    - If provided, renders children instead of <input> (e.g. <select>)
 *   ...rest     - All other props forwarded to <input>
 */

import React from 'react';

export default function InputField({ label, id, icon: Icon, type = 'text', children, ...rest }) {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="input-wrapper">
        {children ? (
          children
        ) : (
          <input id={id} type={type} className="form-input" {...rest} />
        )}
        {Icon && <Icon className="input-icon" size={18} />}
      </div>
    </div>
  );
}
