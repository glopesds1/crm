import React from 'react';

export const DashTable = ({ cols, rows }: { cols: string[]; rows: (string | number | null)[][] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-white/5">
          {cols.map(c => (
            <th key={c} className="text-left py-3 px-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
            {row.map((cell, j) => (
              <td key={j} className="py-3 px-4 text-gray-300">{cell ?? '—'}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
