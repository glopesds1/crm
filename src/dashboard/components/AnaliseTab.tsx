import React, { useState, useEffect } from 'react';
import { supabase } from '../../shared/lib/supabase';
import { fmt, fmtBRL, fmtPct } from '../../shared/lib/formatters';
import { BRAND, CHART_COLORS } from '../../shared/constants';
import { Empty } from './ui/Empty';
import { DashTable } from './ui/DashTable';
import { CustomTooltip } from './ui/CustomTooltip';
import type { DateRange } from '../../shared/types';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface AnaliseTabProps {
  data: any;
  range: DateRange;
}

export function AnaliseTab({ data, range }: AnaliseTabProps) {
  const toArr = (d: any) => Array.isArray(d) ? d : d ? [d] : [];
  const etapas     = toArr(data?.etapa).map((x: any) => ({ ...x, vendas: +x.vendas, ticket_medio: +x.ticket_medio, cc_medio: +x.cc_medio }));
  const etapaPizza = toArr(data?.etapa_pizza).map((x: any) => ({ ...x, vendas: +x.vendas, pct_total: +x.pct_total }));
  const programas  = toArr(data?.programa).map((x: any) => ({ ...x, vendas: +x.vendas, pct_total: +x.pct_total }));
  const motivos    = toArr(data?.motivos).map((x: any) => ({ ...x, quantidade: +x.quantidade, pct_total: +x.pct_total }));
  const closers    = toArr(data?.closers).map((x: any) => ({ ...x, vendas: +x.vendas }));

  // Fetch dados de metas (por_tp + closers por TP)
  const [metasData, setMetasData] = useState<any>(null);
  useEffect(() => {
    (async () => {
      try {
        const [realizado, closers] = await Promise.all([
          supabase.rpc('dashboard_metas_realizado', { di: range.inicio, df: range.fim }),
          supabase.rpc('dashboard_metas_closer', { di: range.inicio, df: range.fim }),
        ]);
        setMetasData({ realizado: realizado.data, closers: closers.data });
      } catch { /* silently fail */ }
    })();
  }, [range.inicio, range.fim]);

  const metasM = metasData?.realizado;
  const porTp: { tp: string; marcadas: number; realizadas: number; show_rate: number; vendas: number; tx_conversao: number }[] =
    metasM ? (typeof metasM.por_tp === 'string' ? JSON.parse(metasM.por_tp) : (metasM.por_tp || [])) : [];
  const metasClosers: any[] = Array.isArray(metasData?.closers) ? metasData.closers : metasData?.closers ? [metasData.closers] : [];

  const tpColors: Record<string, string> = { R1: '#fff', R2: '#d4af37', R3: '#ef9f27', 'R4+': '#ef4444' };

  const PizzaLegend = ({ items, nameKey, valueKey }: { items: any[]; nameKey: string; valueKey: string }) => (
    <div className="space-y-1 mt-2">
      {items.map((item: any, i: number) => (
        <div key={i} className="flex justify-between text-xs">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="truncate max-w-[120px]">{item[nameKey]}</span>
          </span>
          <span className="text-gray-400">{item[valueKey]}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Linha 1: Performance por Closer | Ticket e CC Médios por Closer */}
      <div className="grid grid-cols-2 gap-4">
        {metasClosers.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-3">Performance por Closer</h3>
            {(() => {
              const closerMap: Record<string, any[]> = {};
              metasClosers.forEach(row => {
                const name = row.closer ?? 'Sem nome';
                if (!closerMap[name]) closerMap[name] = [];
                closerMap[name].push(row);
              });
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        {['Closer', 'TP', 'Marcadas', 'Show', 'Realizadas', 'Conv.', 'Vendas'].map(h => (
                          <th key={h} className="py-2 px-2 text-[9px] font-bold uppercase tracking-widest text-center" style={{ color: '#aaa' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(closerMap).map(([name, rows], ci) => {
                        const totM = rows.reduce((s, r) => s + (Number(r.marcadas ?? r.rm) || 0), 0);
                        const totR = rows.reduce((s, r) => s + (Number(r.realizadas ?? r.rr) || 0), 0);
                        const totV = rows.reduce((s, r) => s + (Number(r.vendas) || 0), 0);
                        const totShow = totM > 0 ? (totR / totM * 100).toFixed(1) + '%' : '—';
                        const totConv = totR > 0 ? (totV / totR * 100).toFixed(1) + '%' : '—';
                        return (
                          <React.Fragment key={name}>
                            <tr className="bg-white/5 border-b border-white/10">
                              <td className="py-2 px-2 text-[13px] font-bold text-white">{ci + 1}. {name}</td>
                              <td className="py-2 px-2 text-center text-[10px] text-gray-500">Total</td>
                              <td className="py-2 px-2 text-center font-bold text-white">{fmt(totM)}</td>
                              <td className="py-2 px-2 text-center text-white">{totShow}</td>
                              <td className="py-2 px-2 text-center font-bold text-white">{fmt(totR)}</td>
                              <td className="py-2 px-2 text-center text-white">{totConv}</td>
                              <td className="py-2 px-2 text-center font-bold text-white">{fmt(totV)}</td>
                            </tr>
                            {rows.map(r => {
                              const tp = r.tp_group ?? 'R1';
                              const marc = Number(r.marcadas ?? r.rm) || 0;
                              const real = Number(r.realizadas ?? r.rr) || 0;
                              const vend = Number(r.vendas) || 0;
                              const show = marc > 0 ? (real / marc * 100).toFixed(1) + '%' : '—';
                              const conv = real > 0 ? (vend / real * 100).toFixed(1) + '%' : '—';
                              return (
                                <tr key={`${name}-${tp}`} className="border-b border-white/5">
                                  <td className="py-1.5 px-2 pl-8 text-[11px] text-gray-500" />
                                  <td className="py-1.5 px-2 text-center text-[11px] font-semibold" style={{ color: tpColors[tp] ?? '#fff' }}>{tp}</td>
                                  <td className="py-1.5 px-2 text-center text-[11px] text-gray-300">{fmt(marc)}</td>
                                  <td className="py-1.5 px-2 text-center text-[11px] text-gray-300">{show}</td>
                                  <td className="py-1.5 px-2 text-center text-[11px] text-gray-300">{fmt(real)}</td>
                                  <td className="py-1.5 px-2 text-center text-[11px] text-gray-300">{conv}</td>
                                  <td className="py-1.5 px-2 text-center text-[11px] text-gray-300">{fmt(vend)}</td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary">Ticket e CC Médios por Closer</h3>
          {closers.length === 0 ? <Empty /> : (
            <DashTable
              cols={['Closer', 'Ticket Médio', 'CC Médio']}
              rows={closers.filter((c: any) => c.vendas > 0).map((c: any, i: number) => [
                `${i + 1}. ${c.closer}`,
                fmtBRL(c.ticket_medio),
                fmtBRL(c.cc_medio),
              ])}
            />
          )}
        </div>
      </div>

      {/* Linha 2: Performance por Etapa de Reunião (largura total) */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-3">Performance por Etapa de Reunião</h3>
        {porTp.length === 0 ? <Empty /> : (() => {
          const totM = porTp.reduce((s, r) => s + (Number(r.marcadas) || 0), 0);
          const totR = porTp.reduce((s, r) => s + (Number(r.realizadas) || 0), 0);
          const totV = porTp.reduce((s, r) => s + (Number(r.vendas) || 0), 0);
          const totShow = totM > 0 ? (totR / totM * 100).toFixed(1) : '0.0';
          const totConv = totR > 0 ? (totV / totR * 100).toFixed(1) : '0.0';
          const rows = [...porTp, { tp: 'TOTAL', marcadas: totM, realizadas: totR, show_rate: parseFloat(totShow), vendas: totV, tx_conversao: parseFloat(totConv) }];
          return (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['TP', 'Marcadas', 'Realizadas', 'Show Rate', 'Vendas', 'Conversão'].map(h => (
                    <th key={h} className="py-2 px-3 text-xs font-bold uppercase tracking-widest text-center" style={{ color: '#aaa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const isTotal = r.tp === 'TOTAL';
                  const color = isTotal ? '#00FF88' : (tpColors[r.tp] ?? '#fff');
                  return (
                    <tr key={r.tp} className={`border-b border-white/5 ${isTotal ? 'bg-white/5' : ''}`}>
                      <td className="py-2.5 px-3 text-center font-bold" style={{ color }}>{r.tp}</td>
                      <td className="py-2.5 px-3 text-center text-white">{fmt(r.marcadas)}</td>
                      <td className="py-2.5 px-3 text-center text-white">{fmt(r.realizadas)}</td>
                      <td className="py-2.5 px-3 text-center text-white">{r.show_rate?.toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-center text-white">{fmt(r.vendas)}</td>
                      <td className="py-2.5 px-3 text-center text-white">{r.tx_conversao?.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })()}
      </div>

      {/* Linha 3: Ticket/CC por Etapa | Vendas por Etapa | Vendas por Programa */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary">Ticket e CC por Etapa de Fechamento</h3>
          {etapas.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={etapas} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="etapa" tick={{ fill: '#aaa', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#aaa', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `R$${v / 1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                <Bar dataKey="ticket_medio" name="Ticket Médio" fill={BRAND} fillOpacity={0.85} radius={[3,3,0,0]} />
                <Bar dataKey="cc_medio" name="CC Médio" fill="#38BDF8" fillOpacity={0.7} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass-card p-6 space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary">Vendas por Etapa de Fechamento</h3>
          {etapaPizza.length === 0 ? <Empty /> : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart margin={{ top: 30, right: 50, bottom: 30, left: 50 }}>
                  <Pie
                    data={etapaPizza} dataKey="vendas" nameKey="etapa"
                    cx="50%" cy="50%" outerRadius={70} innerRadius={0}
                    label={({ cx, cy, midAngle, outerRadius, pct_total, etapa }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = outerRadius + 30;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return <text x={x} y={y} fill="#aaa" textAnchor="middle" dominantBaseline="central" fontSize={10}>{`${etapa} ${pct_total}%`}</text>;
                    }}
                    labelLine={{ stroke: '#555', strokeWidth: 1 }}
                  >
                    {etapaPizza.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <PizzaLegend items={etapaPizza} nameKey="etapa" valueKey="pct_total" />
            </>
          )}
        </div>

        <div className="glass-card p-6 space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary">Vendas por Programa</h3>
          {programas.length === 0 ? <Empty /> : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart margin={{ top: 30, right: 50, bottom: 30, left: 50 }}>
                  <Pie
                    data={programas} dataKey="vendas" nameKey="programa"
                    cx="50%" cy="50%" outerRadius={70}
                    label={({ cx, cy, midAngle, outerRadius, pct_total, programa }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = outerRadius + 30;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return <text x={x} y={y} fill="#aaa" textAnchor="middle" dominantBaseline="central" fontSize={10}>{`${programa} ${pct_total}%`}</text>;
                    }}
                    labelLine={{ stroke: '#555', strokeWidth: 1 }}
                  >
                    {programas.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <PizzaLegend items={programas} nameKey="programa" valueKey="pct_total" />
            </>
          )}
        </div>
      </div>

    </div>
  );
}
