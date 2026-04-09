import React from 'react';

export const KPI = ({
  label, value, sub, color = 'text-white', icon: Icon
}: { label: string; value: string; sub?: string; color?: string; icon?: any }) => (
  <div className="glass-card p-5 space-y-2">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      {Icon && <Icon size={16} className="text-gray-600" />}
    </div>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
  </div>
);
