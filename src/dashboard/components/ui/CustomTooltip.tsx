import React from 'react';
import { fmtBRL } from '../../../shared/lib/formatters';

export const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-card border border-white/10 rounded-xl p-3 shadow-xl text-xs space-y-1">
      <p className="font-bold text-white mb-2">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{typeof p.value === 'number' && p.value > 1000 ? fmtBRL(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
};
