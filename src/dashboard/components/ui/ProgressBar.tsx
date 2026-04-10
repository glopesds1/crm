import React from 'react';
import { fmt } from '../../../shared/lib/formatters';

export const ProgressBar = ({ value, max, label, realizado }: { value: number; max: number; label: string; realizado: string }) => {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 100 ? '#00FF88' : pct >= 70 ? '#F59E0B' : '#EF4444';
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-gray-300">{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{realizado} / {fmt(max)} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};
