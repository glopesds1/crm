import React, { useState, useEffect } from 'react';
import { supabase } from '../../shared/lib/supabase';
import { fmt, fmtBRL, fmtMes } from '../../shared/lib/formatters';
import { BRAND } from '../../shared/constants';
import { Empty } from './ui/Empty';
import { format } from 'date-fns';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface OverviewTabProps {
  data: any;
  range: { inicio: string; fim: string };
  userSession: any;
}

export function OverviewTab({ data, range, userSession }: OverviewTabProps) {
  const kpis   = data?.kpis;
  const meses  = Array.isArray(data?.vendas_mes) ? data.vendas_mes : [];
  const custos = data?.custos;

  // Metas editáveis (Supabase)
  const [metas, setMetas] = useState<Record<string, number>>({
    meta_leads: 0, meta_mql: 0, meta_rm: 0, meta_rr: 0, meta_vendas: 0
  });
  const [editMeta, setEditMeta] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const isAdmin = (userSession?.role ?? '').toLowerCase() === 'admin';

  // Buscar metas de conversão do Supabase (taxas %)
  useEffect(() => {
    supabase.from('dashboard_metas_etapas').select('meta_leads,meta_mql,meta_rm,meta_rr,meta_vendas').eq('id', 1).single()
      .then(({ data: d, error }) => {
        if (error) console.error('Erro ao carregar metas etapas:', error);
        if (d) setMetas(prev => ({ ...prev, ...Object.fromEntries(Object.entries(d).map(([k,v]) => [k, Number(v)])) }));
      });
  }, []);

  const saveMeta = async (key: string, val: string) => {
    const n = parseFloat(val) || 0;
    const updated = { ...metas, [key]: n };
    setMetas(updated);
    const { error } = await supabase.from('dashboard_metas_etapas').upsert({
      id: 1,
      meta_leads: updated.meta_leads,
      meta_mql:   updated.meta_mql,
      meta_rm:    updated.meta_rm,
      meta_rr:    updated.meta_rr,
      meta_vendas: updated.meta_vendas,
      updated_at: new Date().toISOString()
    });
    if (error) console.error('Erro ao salvar meta etapa:', error);
    setEditMeta(null);
  };

  // Buscar custos do período anterior para comparação
  const [custosAnt, setCustosAnt] = useState<any>(null);
  useEffect(() => {
    if (!range) return;
    const dias = Math.round((new Date(range.fim).getTime() - new Date(range.inicio).getTime()) / 86400000);
    const ant_fim   = format(new Date(new Date(range.inicio).getTime() - 86400000), 'yyyy-MM-dd');
    const ant_ini   = format(new Date(new Date(range.inicio).getTime() - dias * 86400000), 'yyyy-MM-dd');
    Promise.resolve(supabase.rpc('dashboard_overview_custos', { di: ant_ini, df: ant_fim }))
      .then(({ data: c }) => setCustosAnt(c))
      .catch(() => {});
  }, [range]);

  if (!kpis) return <Empty />;

  const taxa_mql = parseFloat(kpis.tx_lead_mql  ?? 0);
  const taxa_rm  = parseFloat(kpis.tx_mql_rm    ?? 0);
  const taxa_rr  = parseFloat(kpis.tx_rm_rr     ?? 0);
  const taxa_v   = parseFloat(kpis.tx_conversao  ?? 0);

  const chartData = meses.map((m: any) => ({
    name: fmtMes(m.mes),
    Contrato: parseFloat(m.total_contrato ?? 0),
    CC: parseFloat(m.total_cc ?? 0),
    Ticket: parseFloat(m.ticket_medio ?? 0),
  }));

  // Funil com larguras decrescentes
  const etapas = [
    { key: 'meta_leads',  label: 'Leads',              value: kpis.leads,               taxa: taxa_mql, meta: metas.meta_leads, w: 100 },
    { key: 'meta_mql',    label: 'MQL',                value: kpis.mqls,                taxa: taxa_rm,  meta: metas.meta_mql,   w: 85  },
    { key: 'meta_rm',     label: 'Reuniões Marcadas',  value: kpis.reunioes_marcadas,   taxa: taxa_rr,  meta: metas.meta_rm,    w: 70  },
    { key: 'meta_rr',     label: 'Reuniões Realizadas',value: kpis.reunioes_realizadas, taxa: taxa_v,   meta: metas.meta_rr,    w: 55  },
    { key: 'meta_vendas', label: 'Vendas',             value: kpis.vendas,              taxa: null,     meta: metas.meta_vendas, w: 40  },
  ];

  const delta = (curr: any, prev: any) => {
    if (!curr || !prev || parseFloat(prev) === 0) return null;
    const pct = ((parseFloat(curr) - parseFloat(prev)) / parseFloat(prev)) * 100;
    return pct;
  };

  const DeltaBadge = ({ pct, inverse = false }: { pct: number | null; inverse?: boolean }) => {
    if (pct === null) return null;
    const good = inverse ? pct < 0 : pct > 0;
    const color = good ? 'text-brand-primary' : 'text-red-400';
    const arrow = pct > 0 ? '▲' : '▼';
    return <span className={`text-[10px] font-bold ${color}`}>{arrow} {Math.abs(pct).toFixed(1)}%</span>;
  };

  const VendasTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const contrato = payload.find((p: any) => p.dataKey === 'Contrato');
    const cc       = payload.find((p: any) => p.dataKey === 'CC');
    const ticket   = payload.find((p: any) => p.dataKey === 'Ticket');
    return (
      <div className="bg-bg-card border border-white/10 rounded-xl p-4 shadow-xl text-xs space-y-2 min-w-[160px]">
        <p className="font-bold text-white text-sm mb-2">{label}</p>
        {contrato && <div className="flex justify-between gap-4"><span className="text-gray-400">Contrato</span><span className="font-bold text-brand-primary">{fmtBRL(contrato.value)}</span></div>}
        {cc       && <div className="flex justify-between gap-4"><span className="text-gray-400">Cash Collect</span><span className="font-bold text-white">{fmtBRL(cc.value)}</span></div>}
        {ticket   && <div className="flex justify-between gap-4"><span className="text-gray-400">Ticket Médio</span><span className="font-bold text-gray-300">{fmtBRL(ticket.value)}</span></div>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Topo: 3 KPIs grandes */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'MRR Adicionado', value: fmtBRL(kpis.total_mrr) },
          { label: 'Cash Collect',   value: fmtBRL(kpis.total_cc) },
          { label: 'Contrato',       value: fmtBRL(kpis.total_contrato) },
        ].map(k => (
          <div key={k.label} className="glass-card p-6 text-center space-y-2">
            <p className="text-sm font-bold uppercase tracking-widest text-brand-primary">{k.label}</p>
            <p className="text-3xl font-black text-white">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Meio: Etapas | Investimento | Performance Comercial */}
      <div className="grid grid-cols-3 gap-4">

        {/* Etapas — funil */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-5">Etapas</h3>
          <div className="space-y-0">
            {etapas.map((e, i) => (
              <div key={e.key} className="space-y-0">
                {/* Barra do funil — largura decrescente */}
                <div className="flex items-center" style={{ paddingLeft: `${(100 - e.w) / 2}%`, paddingRight: `${(100 - e.w) / 2}%` }}>
                  <div className="flex-1 bg-white/10 rounded-xl px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-300">{e.label}</span>
                    <span className="text-xl font-black text-white">{fmt(e.value)}</span>
                  </div>
                </div>
                {/* Separador: Taxa real | Meta % editável */}
                {e.taxa !== null && i < etapas.length - 1 && (
                  <div className="flex items-center justify-center gap-3 py-1.5">
                    <div className="flex-1 h-px bg-white/5" />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-300">{e.taxa.toFixed(1)}%</span>
                      <span className="text-gray-600">|</span>
                      {editMeta === e.key ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={editVal}
                            onChange={ev => setEditVal(ev.target.value)}
                            onBlur={() => saveMeta(e.key, editVal)}
                            onKeyDown={ev => ev.key === 'Enter' && saveMeta(e.key, editVal)}
                            className="w-14 bg-white/10 border border-brand-primary rounded px-1 py-0.5 text-xs text-white text-center focus:outline-none"
                          />
                          <span className="text-xs text-gray-400">%</span>
                        </div>
                      ) : (
                        <span
                          onClick={() => isAdmin ? (setEditMeta(e.key), setEditVal(String(e.meta || ''))) : null}
                          className={`text-[10px] font-bold text-gray-500 ${isAdmin ? 'cursor-pointer hover:text-brand-primary transition-colors' : ''}`}
                          title={isAdmin ? 'Clique para editar a meta' : ''}
                        >
                          Meta: {e.meta ? `${e.meta}%` : '—'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                )}
              </div>
            ))}
          </div>
          {isAdmin && <p className="text-[9px] text-gray-600 mt-2 text-center">Clique em "Meta" para editar a taxa alvo</p>}
        </div>

        {/* Investimento com comparação */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-5">Investimento</h3>
          {custos ? (
            <div className="space-y-0">
              {[
                { label: 'Mídia',  curr: custos.verba_midia, prev: custosAnt?.verba_midia, inv: false },
                { label: 'MQL',   curr: custos.custo_mql,   prev: custosAnt?.custo_mql,   inv: true  },
                { label: 'CRM',   curr: custos.custo_rm,    prev: custosAnt?.custo_rm,    inv: true  },
                { label: 'CRR',   curr: custos.custo_rr,    prev: custosAnt?.custo_rr,    inv: true  },
                { label: 'CAC',   curr: custos.cac,         prev: custosAnt?.cac,         inv: true  },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm font-bold text-white">{row.label}</span>
                  <div className="flex items-center gap-3">
                    <DeltaBadge pct={delta(row.curr, row.prev)} inverse={row.inv} />
                    <span className="text-2xl font-black text-white">{fmtBRL(row.curr)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty />}
        </div>

        {/* Performance Comercial */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-5">Performance Comercial</h3>
          <div className="space-y-0">
            {[
              { label: 'Ticket Médio', value: fmtBRL(kpis.ticket_medio) },
              { label: 'CC Médio',     value: fmtBRL(kpis.cc_medio) },
              { label: 'MRR Médio',    value: fmtBRL(kpis.mrr_medio) },
              { label: 'TMF',          value: kpis.tmf_dias ? `${Math.round(parseFloat(kpis.tmf_dias))} dias` : '—' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-sm font-bold text-white">{row.label}</span>
                <span className="text-2xl font-black text-white">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gráfico Vendas por Mês */}
      {chartData.length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary">Vendas por Mês</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" stroke="#444" tick={{ fill: "#aaa", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" stroke="#444" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `R$${v/1000}k`} />
              <YAxis yAxisId="right" orientation="right" stroke="#444" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `R$${v/1000}k`} />
              <Tooltip content={<VendasTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 16 }} />
              <Bar yAxisId="left" dataKey="Contrato" fill={BRAND} fillOpacity={0.75} radius={[4,4,0,0]} />
              <Bar yAxisId="left" dataKey="CC" fill="#0f2a44" fillOpacity={1} radius={[4,4,0,0]} />
              <Line yAxisId="right" type="monotone" dataKey="Ticket" name="Ticket Médio" stroke="#888" strokeWidth={2} dot={{ fill: '#888', r: 3 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
