import React from 'react';
import { Building2 } from 'lucide-react';

export default React.memo(function ProviderCard({ provider }) {
  if (!provider || !Object.values(provider).some(Boolean)) return null;
  const rows = [
    provider.doctor   && ['Doctor',      provider.doctor],
    provider.lab_name && ['Laboratory',  provider.lab_name],
    provider.hospital && ['Hospital',    provider.hospital],
    provider.address  && ['Address',     provider.address],
    provider.contact  && ['Contact',     provider.contact],
  ].filter(Boolean);
  if (!rows.length) return null;

  return (
    <div style={{
      padding: '14px 16px', borderRadius: '12px',
      background: '#f0fdf4', border: '1px solid #bbf7d0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <Building2 size={15} color="#15803d" />
        <span style={{ fontWeight: 700, fontSize: '13px', color: '#15803d' }}>Provider</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{label}: </span>
            <span style={{ fontSize: '12px', color: '#0f172a' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
