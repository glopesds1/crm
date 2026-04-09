import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '../../shared/lib/supabase';
import { fmt, fmtBRL } from '../../shared/lib/formatters';
import { BRAND } from '../../shared/constants';
import { Empty } from './ui/Empty';
import { DashTable } from './ui/DashTable';
import { CustomTooltip } from './ui/CustomTooltip';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface SemanalTabProps {
  data: any;
  userSession: any;
}

export function SemanalTab({ data, userSession }: SemanalTabProps) {
  const rows: any[] = Array.isArray(data?.semanal) ? data.semanal : data?.semanal ? [data.semanal] : [];

  // Metas semanais editáveis (Supabase)
  const [metas, setMetas] = useState({
    meta_rm: 0, meta_rr: 0, meta_vendas: 0, meta_contrato: 0, meta_cc: 0
  });
  const [editMeta, setEditMeta] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const isAdmin = (userSession?.role ?? '').toLowerCase() === 'admin';

  useEffect(() => {
    Promise.resolve(supabase.from('dashboard_metas_semanal').select('*').eq('id', 1).single())
      .then(({ data: d }) => { if (d) setMetas(d); })
      .catch(() => {});
  }, []);

  const saveMeta = async (key: string, val: string) => {
    const n = parseFloat(val) || 0;
    const updated = { ...metas, [key]: n };
    setMetas(updated);
    await supabase.from('dashboard_metas_semanal').upsert({ id: 1, ...updated, updated_at: new Date().toISOString() });
    setEditMeta(null);
  };

  if (!rows.length) return <Empty />;

  // Semana atual = semana cujo intervalo contém a data de hoje
  const hoje = new Date();
  const semanaAtual = rows.find(r => {
    if (!r.semana_inicio) return false;
    const inicio = new Date(r.semana_inicio);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 6);
    return inicio <= hoje && hoje <= fim;
  }) ?? rows[0];
  const rm_atual       = semanaAtual.reunioes_marcadas ?? 0;
  const rr_atual       = semanaAtual.reunioes_realizadas ?? 0;
  const vendas_atual   = semanaAtual.vendas ?? 0;
  const contrato_atual = parseFloat(semanaAtual.total_contrato ?? 0);
  const cc_atual       = parseFloat(semanaAtual.total_cc ?? 0);

  const metaFields = [
    { key: 'meta_rm',       label: 'RM',          realizado: rm_atual,       meta: metas.meta_rm,       fmt_fn: (v: number) => String(v),    isMoney: false },
    { key: 'meta_rr',       label: 'RR',          realizado: rr_atual,       meta: metas.meta_rr,       fmt_fn: (v: number) => String(v),    isMoney: false },
    { key: 'meta_vendas',   label: 'Vendas',      realizado: vendas_atual,   meta: metas.meta_vendas,   fmt_fn: (v: number) => String(v),    isMoney: false },
    { key: 'meta_contrato', label: 'Contrato',    realizado: contrato_atual, meta: metas.meta_contrato, fmt_fn: (v: number) => fmtBRL(v),    isMoney: true  },
    { key: 'meta_cc',       label: 'Cash Collect',realizado: cc_atual,       meta: metas.meta_cc,       fmt_fn: (v: number) => fmtBRL(v),    isMoney: true  },
  ];

  const chart = [...rows].reverse().slice(-12).map(r => ({
    name: format(new Date(r.semana_inicio), 'dd/MM'),
    RM: r.reunioes_marcadas,
    RR: r.reunioes_realizadas,
    Vendas: r.vendas,
    Contrato: parseFloat(r.total_contrato ?? 0),
    CC: parseFloat(r.total_cc ?? 0),
  }));

  return (
    <div className="space-y-6">

      {/* Metas com progresso */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary">Metas da Semana</h3>
          {isAdmin && <span className="text-[10px] text-gray-600">Clique no valor para editar</span>}
        </div>

        <div className="grid grid-cols-5 gap-4">
          {metaFields.map(f => {
            const pct = f.meta > 0 ? Math.min((f.realizado / f.meta) * 100, 100) : 0;
            const color = pct >= 100 ? '#00FF88' : pct >= 70 ? '#F59E0B' : pct >= 40 ? '#00B4D8' : '#EF4444';
            return (
              <div key={f.key} className="space-y-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{f.label}</p>
                {/* Valor meta editável */}
                {editMeta === f.key ? (
                  <div className="flex items-center justify-center">
                    <input
                      autoFocus
                      type="number"
                      value={editVal}
                      onChange={ev => setEditVal(ev.target.value)}
                      onBlur={() => saveMeta(f.key, editVal)}
                      onKeyDown={ev => ev.key === 'Enter' && saveMeta(f.key, editVal)}
                      className="w-24 bg-white/10 border border-brand-primary rounded-xl px-2 py-1 text-sm text-white text-center focus:outline-none"
                    />
                  </div>
                ) : (
                  <div
                    onClick={() => isAdmin ? (setEditMeta(f.key), setEditVal(String(f.meta || ''))) : null}
                    className={`mx-auto bg-white/10 border border-white/10 rounded-2xl px-4 py-2 inline-block ${isAdmin ? 'cursor-pointer hover:border-brand-primary/40 transition-colors' : ''}`}
                  >
                    <span className="text-xl font-black text-white">{f.isMoney ? fmt(f.meta) : f.meta}</span>
                  </div>
                )}
                {/* Barra de progresso */}
                <div className="space-y-1">
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-600">
                    <span>0%</span>
                    <span style={{ color }} className="font-bold">{pct.toFixed(0)}%</span>
                    <span>100%</span>
                  </div>
                  <p className="text-[10px] text-center" style={{ color: "#aaa" }}>
                    {f.isMoney ? fmtBRL(f.realizado) : f.realizado} realizado
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary">Métricas por Semana</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chart} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="name" stroke="#444" tick={{ fill: "#aaa", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" stroke="#666" tick={{ fill: "#aaa", fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="right" orientation="right" stroke="#666" tick={{ fill: "#aaa", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `R$${v / 1000}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 16 }} />
            <Bar yAxisId="left" dataKey="RM" fill={BRAND} fillOpacity={0.9} radius={[3, 3, 0, 0]} />
            <Bar yAxisId="left" dataKey="RR" fill="#38BDF8" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
            <Bar yAxisId="left" dataKey="Vendas" fill="#A78BFA" fillOpacity={0.9} radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="Contrato" stroke="#FBBF24" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="CC" stroke="#F87171" strokeWidth={2} dot={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card p-6">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-4">Histórico Semanal</h3>
        <DashTable
          cols={['Semana', 'RM', 'RR', 'Vendas', 'Contrato', 'Cash Collect']}
          rows={rows.slice(0, 15).map(r => [
            format(new Date(r.semana_inicio), 'dd/MM/yyyy'),
            r.reunioes_marcadas, r.reunioes_realizadas, r.vendas,
            fmtBRL(r.total_contrato), fmtBRL(r.total_cc)
          ])}
        />
      </div>
    </div>
  );
}
