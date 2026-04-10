import React from 'react';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { fmtPct } from '../../shared/lib/formatters';
import { BRAND } from '../../shared/constants';
import { DashTable } from './ui/DashTable';
import { CustomTooltip } from './ui/CustomTooltip';

interface SDRTabProps {
  data: any;
}

export function SDRTab({ data }: SDRTabProps) {
  const producao: any[] = Array.isArray(data?.producao) ? data.producao : [];
  const leads: any[] = Array.isArray(data?.leads_semanal) ? data.leads_semanal : [];
  console.log('[perf prevendas sdr]', producao);

  const chart = [...leads].reverse().slice(-12).map(r => ({
    name: r.semana_label?.slice(0, 5) ?? '',
    'Leads/dia': parseFloat(r.leads_por_dia ?? 0),
    'MQL/dia': parseFloat(r.mql_por_dia ?? 0),
  }));

  return (
    <div className="space-y-6">
      {/* Performance SDRs */}
      {producao.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-4">Performance por SDR</h3>
          <DashTable
            cols={['SDR', 'RM', 'RR', 'Vendas', 'Show-rate']}
            rows={producao.map((s: any) => [s.sdr, s.rm, s.rr, s.vendas, fmtPct(s.show_rate)])}
          />
        </div>
      )}

      {/* Leads/dia semanal */}
      {chart.length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Leads e MQL por Semana</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chart} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" stroke="#444" tick={{ fill: "#aaa", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 12 }} />
              <Bar dataKey="Leads/dia" fill={BRAND} fillOpacity={0.7} radius={[3, 3, 0, 0]} />
              <Bar dataKey="MQL/dia" fill="#00B4D8" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela leads semanal */}
      {leads.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-4">Leads por Semana</h3>
          <DashTable
            cols={['Semana', 'Total Leads', 'Leads/dia', 'Total MQL', 'MQL/dia']}
            rows={leads.slice(0, 15).map((r: any) => [
              r.semana_label, r.leads_total,
              parseFloat(r.leads_por_dia).toFixed(1),
              r.mqls_total,
              parseFloat(r.mql_por_dia).toFixed(1)
            ])}
          />
        </div>
      )}
    </div>
  );
}
