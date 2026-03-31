import React, { useState, useEffect, useCallback } from 'react';
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { supabase } from './lib/supabase';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, Users, DollarSign, Target, Calendar,
  RefreshCw, AlertCircle, ChevronDown, BarChart2,
  Briefcase, Award, ShoppingBag, Activity
} from 'lucide-react';

// ── Config ────────────────────────────────────────────────────
const WEBHOOK_BASE = import.meta.env.VITE_WEBHOOK_BASE ?? 'https://webhook.m2black.com/webhook/dashboard';

const BRAND = '#00FF88';
const COLORS = ['#00FF88', '#00B4D8', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

const fmt = (v: number | string | null | undefined, prefix = '') => {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return `${prefix}${n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};
const fmtBRL = (v: number | string | null | undefined) => {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  if (n == null || isNaN(n)) return '—';
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtPct = (v: number | string | null | undefined) => {
  if (v == null) return '—';
  return `${parseFloat(v as string).toFixed(1)}%`;
};
const fmtMes = (iso: string) => {
  const d = new Date(iso);
  return format(d, 'MMM/yy').replace('.', '');
};

// ── Types ─────────────────────────────────────────────────────
type Page = 'overview' | 'metas' | 'semanal' | 'reunioes' | 'analise' | 'anuncios' | 'sdr';

interface DateRange { inicio: string; fim: string; }

// ── Helpers ───────────────────────────────────────────────────
const KPI = ({
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

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-4">
    <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">{title}</h3>
    {children}
  </div>
);

const Table = ({ cols, rows }: { cols: string[]; rows: (string | number | null)[][] }) => (
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

const ProgressBar = ({ value, max, label, realizado }: { value: number; max: number; label: string; realizado: string }) => {
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

const Loading = () => (
  <div className="flex items-center justify-center h-48 gap-3 text-gray-500">
    <RefreshCw size={20} className="animate-spin" />
    <span className="text-sm">Carregando dados...</span>
  </div>
);

const Empty = ({ msg }: { msg?: string }) => (
  <div className="flex items-center justify-center h-32 gap-3 text-gray-600">
    <AlertCircle size={18} />
    <span className="text-sm">{msg ?? 'Nenhum dado disponível.'}</span>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
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

// ── Main Component ────────────────────────────────────────────
export default function DashboardView({ userSession }: { userSession: any }) {
  const [page, setPage] = useState<Page>('overview');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const endOfMonthStr = format(endOfMonth(today), 'yyyy-MM-dd');
  const fimMes = todayStr < endOfMonthStr ? todayStr : endOfMonthStr;
  const [range, setRange] = useState<DateRange>({
    inicio: format(startOfYear(today), 'yyyy-MM-dd'),
    fim: format(endOfYear(today), 'yyyy-MM-dd'),
  });

  const fetchData = useCallback(async (p: Page, r: DateRange) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const di = r.inicio;
      const df = r.fim;
      const isComercial = (userSession?.role ?? '').toLowerCase() === 'comercial';
      const closerParam = isComercial && userSession?.name ? `&closer=${encodeURIComponent(userSession.name)}` : '';
      const url = `${WEBHOOK_BASE}?page=${p}&data_inicio=${di}&data_fim=${df}${closerParam}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text || !text.trim()) { setData({}); return; }
      let json: any;
      try { json = JSON.parse(text); } catch { setData({}); return; }
      setData(json);
    } catch (e: any) {
      setError(e.message === 'Failed to fetch'
        ? 'Requisição bloqueada — desative o bloqueador de anúncios para este site e recarregue.'
        : (e.message ?? 'Erro ao buscar dados'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Período padrão por aba
  const periodoPadraoAba: Record<string, string> = {
    overview: 'ano', metas: 'mes', semanal: 'semanal', reunioes: 'hoje',
    anuncios: 'mes', analise: '90d', sdr: '90d',
  };
  const [periodo, setPeriodo] = useState(periodoPadraoAba[page] || 'mes');

  // Set default range per page on switch
  useEffect(() => {
    const yearStart   = format(startOfYear(today),  'yyyy-MM-dd');
    const yearEnd     = format(endOfYear(today),    'yyyy-MM-dd');
    const monthStart  = format(startOfMonth(today), 'yyyy-MM-dd');
    const days90Start = format(subDays(today, 90),  'yyyy-MM-dd');

    const p = periodoPadraoAba[page] || 'mes';
    setPeriodo(p);
    if      (p === 'ano')     setRange({ inicio: yearStart,   fim: yearEnd });
    else if (p === 'mes')     setRange({ inicio: monthStart,  fim: fimMes });
    else if (p === 'hoje')    setRange({ inicio: todayStr,    fim: todayStr });
    else if (p === '90d')     setRange({ inicio: days90Start, fim: fimMes });
    else if (p === 'semanal') setRange({ inicio: monthStart,  fim: fimMes });
  }, [page]); // eslint-disable-line

  useEffect(() => {
    fetchData(page, range);
  }, [page, range, fetchData]);

  const PAGES: { id: Page; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'metas', label: 'Metas Mensais', icon: Target },
    { id: 'semanal', label: 'Semanal', icon: Calendar },
    { id: 'reunioes', label: 'Reuniões do Dia', icon: Users },
    { id: 'anuncios', label: 'Funis', icon: Activity },
    { id: 'analise', label: "KPI's Vendas", icon: BarChart2 },
    { id: 'sdr', label: "KPI's Pré-vendas", icon: Briefcase },
  ];

  const PRESETS = [
    { id: 'ano', label: 'Este ano', inicio: format(startOfYear(today), 'yyyy-MM-dd'), fim: format(endOfYear(today), 'yyyy-MM-dd') },
    { id: 'mes', label: 'Este mês', inicio: format(startOfMonth(today), 'yyyy-MM-dd'), fim: fimMes },
    { id: '90d', label: '90 dias', inicio: format(subDays(today, 90), 'yyyy-MM-dd'), fim: fimMes },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Comercial</h1>
          <p className="text-gray-400 mt-1">Dados em tempo real do Postgres</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Selector para overview, metas mensais e KPI's vendas — esconde em semanal e reuniões */}
          {(['overview', 'metas', 'analise', 'anuncios', 'sdr'] as Page[]).includes(page) && (<>
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => { setPeriodo(p.id); setRange({ inicio: p.inicio, fim: p.fim }); }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${
                  periodo === p.id
                    ? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
              <Calendar size={12} className="text-gray-300 flex-shrink-0" />
              <input
                type="date"
                value={range.inicio}
                onChange={e => { setPeriodo('custom'); setRange(r => ({ ...r, inicio: e.target.value })); }}
                className="bg-transparent text-xs text-gray-300 focus:outline-none"
              />
              <span className="text-gray-600 text-xs">→</span>
              <input
                type="date"
                value={range.fim}
                onChange={e => { setPeriodo('custom'); setRange(r => ({ ...r, fim: e.target.value })); }}
                className="bg-transparent text-xs text-gray-300 focus:outline-none"
              />
            </div>
          </>)}
          {page === 'reunioes' && (
            <div className="relative flex items-center">
              <Calendar size={14} className="text-gray-500 absolute left-3 pointer-events-none z-10" />
              <input
                type="date"
                value={range.inicio}
                onChange={e => { const d = e.target.value; setRange({ inicio: d, fim: d }); }}
                className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand-primary cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
            </div>
          )}
          <button
            onClick={() => fetchData(page, range)}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-brand-primary hover:border-brand-primary/30 transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        {PAGES.map(p => {
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              onClick={() => setPage(p.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${
                page === p.id
                  ? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
              }`}
            >
              <Icon size={12} /> {p.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading && <Loading />}
      {error && (
        <div className="glass-card p-6 flex items-center gap-3 text-red-400 border-red-500/20">
          <AlertCircle size={18} />
          <div>
            <p className="font-bold text-sm">Erro ao carregar dados</p>
            <p className="text-xs text-gray-500 mt-1">{error} — Verifique se o workflow n8n está ativo.</p>
          </div>
        </div>
      )}
      {!loading && !error && data && (
        <>
          {page === 'overview' && <PageOverview data={data} range={range} userSession={userSession} />}
          {page === 'metas' && <PageMetas data={data} userSession={userSession} range={range} />}
          {page === 'semanal' && <PageSemanal data={data} userSession={userSession} />}
          {page === 'reunioes' && <PageReunioes data={data} />}
          {page === 'analise' && <PageAnalise data={data} range={range} />}
          {page === 'anuncios' && <PageAnuncios data={data} />}
          {page === 'sdr' && <PageSDR data={data} />}
        </>
      )}
    </div>
  );
}

// ── PAGE: Overview ────────────────────────────────────────────
function PageOverview({ data, range, userSession }: { data: any; range: any; userSession: any }) {
  const kpis   = Array.isArray(data?.kpis)      ? data.kpis[0]   : data?.kpis;
  const meses  = Array.isArray(data?.vendas_mes) ? data.vendas_mes : [];
  const custos = Array.isArray(data?.custos)     ? data.custos[0] : data?.custos;

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
    fetch(`${import.meta.env.VITE_WEBHOOK_BASE ?? 'https://webhook.m2black.com/webhook/dashboard'}?page=overview&data_inicio=${ant_ini}&data_fim=${ant_fim}`)
      .then(r => r.json())
      .then(d => {
        // custos vem no array do merge — encontra pelo campo verba_midia
        const all = Array.isArray(d?.custos) ? d.custos : [d?.custos];
        const c = all.find((x: any) => x?.verba_midia !== undefined) ?? all[0];
        setCustosAnt(c);
      })
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


// ── PAGE: Metas ───────────────────────────────────────────────
function PageMetas({ data, userSession, range }: { data: any; userSession: any; range: DateRange }) {
  const m       = Array.isArray(data?.metas)   ? data.metas[0]   : data?.metas;
  const closers: any[] = Array.isArray(data?.closers) ? data.closers : data?.closers ? [data.closers] : [];
  const sdrs:    any[] = Array.isArray(data?.sdrs)    ? data.sdrs    : data?.sdrs    ? [data.sdrs]    : [];
  const vendasLista: any[] = Array.isArray(data?.vendas_lista) ? data.vendas_lista : data?.vendas_lista ? [data.vendas_lista] : [];

  const [metasEdit, setMetasEdit] = useState({ meta_contrato: 0, meta_cc: 0, meta_rm: 0, meta_rr: 0, meta_vendas: 0 });
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const isAdmin = (userSession?.role ?? '').toLowerCase() === 'admin';

  // Negociando — leads em negociação no período selecionado (Supabase)
  const [negociando, setNegociando] = useState<{ contrato: number; cc: number; mrr: number }>({ contrato: 0, cc: 0, mrr: 0 });
  useEffect(() => {
    supabase.from('crm_leads')
      .select('valor_contrato,valor_cc,valor_mrr')
      .in('etapa', ['rm_realizada', 'fup_ativa'])
      .is('deletado_em', null)
      .gte('etapa_desde', range.inicio)
      .lte('etapa_desde', range.fim)
      .then(({ data: leads }) => {
        if (!leads) return;
        const contrato = leads.reduce((acc, l: any) => acc + (parseFloat(l.valor_contrato) || 0), 0);
        const cc = leads.reduce((acc, l: any) => acc + (parseFloat(l.valor_cc) || 0), 0);
        const mrr = leads.reduce((acc, l: any) => acc + (parseFloat(l.valor_mrr) || 0), 0);
        setNegociando({ contrato, cc, mrr });
      });
  }, [range.inicio, range.fim]);

  // Carrega metas do Supabase (fonte de verdade), não do webhook
  useEffect(() => {
    Promise.all([
      supabase.from('metas_mensais').select('*').eq('id', 1).single(),
      supabase.from('dashboard_metas').select('*').eq('id', 1).single(),
    ]).then(([fin, perf]) => {
      setMetasEdit(prev => ({
        ...prev,
        meta_contrato: fin.data?.meta_contrato ?? prev.meta_contrato,
        meta_cc:       fin.data?.meta_cc       ?? prev.meta_cc,
        meta_rm:       perf.data?.meta_rm      ?? prev.meta_rm,
        meta_rr:       perf.data?.meta_rr      ?? prev.meta_rr,
        meta_vendas:   perf.data?.meta_vendas  ?? prev.meta_vendas,
      }));
    }).catch(() => {});
  }, []);

  const saveMeta = async (key: string, val: string) => {
    const n = parseFloat(val) || 0;
    const updated = { ...metasEdit, [key]: n };
    setMetasEdit(updated);
    const table = ['meta_contrato', 'meta_cc'].includes(key) ? 'metas_mensais' : 'dashboard_metas';
    await supabase.from(table).upsert({ id: 1, [key]: n, updated_at: new Date().toISOString() });
    setEditKey(null);
  };

  if (!m) return <Empty />;

  const MetaProgressCard = ({ label, metaKey, realizado }: { label: string; metaKey: string; realizado: number }) => {
    const meta = (metasEdit as any)[metaKey] ?? 0;
    const pct = meta > 0 ? Math.min((realizado / meta) * 100, 100) : 0;
    return (
      <div className="glass-card p-6 space-y-3 text-center">
        <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary">{label}</h3>
        {editKey === metaKey ? (
          <div className="flex items-center justify-center gap-2">
            <input
              autoFocus
              type="number"
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onBlur={() => saveMeta(metaKey, editVal)}
              onKeyDown={e => e.key === 'Enter' && saveMeta(metaKey, editVal)}
              className="w-36 bg-white/10 border border-brand-primary rounded-2xl px-4 py-2 text-xl text-white text-center focus:outline-none font-black"
            />
          </div>
        ) : (
          <div
            onClick={() => isAdmin ? (setEditKey(metaKey), setEditVal(String(meta))) : null}
            className={`inline-block bg-white/10 border border-white/10 rounded-2xl px-6 py-2 ${isAdmin ? 'cursor-pointer hover:border-brand-primary/40 transition-colors' : ''}`}
            title={isAdmin ? 'Clique para editar' : ''}
          >
            <span className="text-2xl font-black text-white">{fmtBRL(meta)}</span>
          </div>
        )}
        <div className="space-y-1">
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-brand-primary transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[9px]" style={{ color: '#aaa' }}>
            <span>0%</span>
            <span className="font-bold text-brand-primary">{pct.toFixed(1)}%</span>
            <span>100%</span>
          </div>
          <p className="text-[10px]" style={{ color: '#aaa' }}>{fmtBRL(realizado)} realizado</p>
        </div>
      </div>
    );
  };

  // Meta editável | Conv. Meta % | Conv. Realizado % | Realizado
  const PerfRow = ({ label, metaKey, metaVal, realizado, convMeta, convReal }: {
    label: string; metaKey: string; metaVal: any; realizado: any;
    convMeta?: string; convReal?: string;
  }) => (
    <div className="grid grid-cols-4 items-center py-3 border-b border-white/5 last:border-0 gap-2">
      <span className="text-xs font-bold" style={{ color: '#aaa' }}>{label}</span>
      {/* Meta editável */}
      <div className="text-center">
        {metaKey && editKey === metaKey ? (
          <input
            autoFocus
            type="number"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onBlur={() => saveMeta(metaKey, editVal)}
            onKeyDown={e => e.key === 'Enter' && saveMeta(metaKey, editVal)}
            className="w-16 bg-white/10 border border-brand-primary rounded-xl px-2 py-1 text-sm text-white text-center focus:outline-none font-black"
          />
        ) : (
          <div
            onClick={() => isAdmin && metaKey ? (setEditKey(metaKey), setEditVal(String(metaVal))) : null}
            className={`inline-block bg-white/10 rounded-xl px-3 py-1 ${isAdmin && metaKey ? 'cursor-pointer hover:border hover:border-brand-primary/40 transition-all' : ''}`}
            title={isAdmin && metaKey ? 'Clique para editar' : ''}
          >
            <span className="text-lg font-black text-white">{metaVal}</span>
          </div>
        )}
      </div>
      {/* Conversão Meta % | Conversão Realizado % */}
      <div className="text-center space-y-1">
        {convMeta && <div className="text-xs font-bold" style={{ color: '#aaa' }}>{convMeta}</div>}
        {convReal && <div className="text-sm font-bold text-brand-primary">{convReal}</div>}
      </div>
      {/* Realizado */}
      <div className="text-center">
        <div className="inline-block bg-white/10 rounded-xl px-3 py-1">
          <span className="text-lg font-black text-white">{realizado}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Topo: Metas Contrato + Cash Collect editáveis */}
      <div className="grid grid-cols-2 gap-4">
        <MetaProgressCard label="Contrato"    metaKey="meta_contrato" realizado={parseFloat(m.contrato_realizado ?? 0)} />
        <MetaProgressCard label="Cash Collect" metaKey="meta_cc"      realizado={parseFloat(m.cc_realizado ?? 0)} />
      </div>

      {/* Meio: Performance | Vendido & Negociando */}
      <div className="grid grid-cols-2 gap-4">

        {/* Performance */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-2">Performance</h3>
          <div className="grid grid-cols-4 text-center mb-1">
            <span />
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#aaa' }}>Meta</span>
            <div className="text-center space-y-0.5">
              <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#aaa' }}>Conv. Meta</div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-brand-primary">Conv. Real</div>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#aaa' }}>Realizado</span>
          </div>
          {(() => {
            const porTp: any[] = typeof m.por_tp === 'string' ? JSON.parse(m.por_tp) : (m.por_tp || []);
            const totalMarcadas = porTp.reduce((s: number, t: any) => s + (parseInt(t.marcadas) || 0), 0);
            const totalRealizadas = porTp.reduce((s: number, t: any) => s + (parseInt(t.realizadas) || 0), 0);
            const totalVendas = parseInt(m.vendas_realizado) || porTp.reduce((s: number, t: any) => s + (parseInt(t.vendas) || 0), 0);
            return (
              <>
                <PerfRow
                  label="Reuniões Marcadas"
                  metaKey="meta_rm"
                  metaVal={fmt(metasEdit.meta_rm || m.meta_rm)}
                  realizado={fmt(totalMarcadas || m.rm_realizado)}
                />
                <PerfRow
                  label="Reuniões Realizadas"
                  metaKey="meta_rr"
                  metaVal={fmt(metasEdit.meta_rr || m.meta_rr)}
                  realizado={fmt(totalRealizadas || m.rr_realizado)}
                  convMeta={metasEdit.meta_rr > 0 && metasEdit.meta_rm > 0 ? `${((metasEdit.meta_rr / metasEdit.meta_rm) * 100).toFixed(1)}%` : undefined}
                  convReal={(totalMarcadas || m.rm_realizado) > 0 ? `${(((totalRealizadas || m.rr_realizado) / (totalMarcadas || m.rm_realizado)) * 100).toFixed(1)}%` : undefined}
                />
                <PerfRow
                  label="Vendas"
                  metaKey="meta_vendas"
                  metaVal={fmt(metasEdit.meta_vendas || m.meta_vendas)}
                  realizado={fmt(totalVendas)}
                  convMeta={metasEdit.meta_vendas > 0 && metasEdit.meta_rr > 0 ? `${((metasEdit.meta_vendas / metasEdit.meta_rr) * 100).toFixed(1)}%` : undefined}
                  convReal={(totalRealizadas || m.rr_realizado) > 0 ? `${((totalVendas / (totalRealizadas || m.rr_realizado)) * 100).toFixed(1)}%` : undefined}
                />
              </>
            );
          })()}
        </div>

        {/* Vendido & Negociando */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-2">Vendido &amp; Negociando</h3>
          <div className="grid grid-cols-3 text-center mb-1">
            <span />
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#aaa' }}>Vendido</span>
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#aaa' }}>Negociando</span>
          </div>
          {[
            { label: 'Contrato',     v: m.contrato_realizado, n: negociando.contrato },
            { label: 'Cash Collect', v: m.cc_realizado,       n: negociando.cc },
            { label: 'MRR',          v: m.mrr_realizado,      n: negociando.mrr },
          ].map(row => (
            <div key={row.label} className="grid grid-cols-3 items-center py-2 border-b border-white/5 last:border-0">
              <span className="text-xs font-bold" style={{ color: '#aaa' }}>{row.label}</span>
              <span className="text-center text-sm font-bold text-white">{fmtBRL(row.v)}</span>
              <span className="text-right text-sm font-bold text-yellow-400">{fmtBRL(row.n)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Baixo: Closer + SDR */}
      <div className="grid grid-cols-2 gap-4">
        {closers.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-4">Performance por Closer</h3>
            {(() => {
              const txColor = (v: any) => {
                const n = parseFloat(v ?? 0);
                if (n >= 50) return 'text-green-400';
                if (n >= 30) return 'text-yellow-400';
                return 'text-red-400';
              };
              return (
                <Table
                  cols={['Closer', 'RM', 'Tx Show', 'RR', 'Tx Conv', 'Vendas', 'Contrato', 'CC']}
                  rows={closers.map((c, i) => [
                    `${i + 1}. ${c.closer}`,
                    c.rm,
                    <span className={txColor(c.tx_show)}>{fmtPct(c.tx_show)}</span>,
                    c.rr,
                    <span className={txColor(c.tx_fechamento)}>{fmtPct(c.tx_fechamento)}</span>,
                    c.vendas,
                    fmtBRL(c.total_contrato),
                    fmtBRL(c.total_cc),
                  ] as any)}
                />
              );
            })()}
          </div>
        )}
        {sdrs.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-4">Performance por SDR</h3>
            <Table
              cols={['SDR', 'RM', 'RR', 'Vendas', 'Show-rate']}
              rows={sdrs.map((s, i) => [`${i + 1}. ${s.sdr}`, s.rm, s.rr, s.vendas, fmtPct(s.show_rate)])}
            />
          </div>
        )}
      </div>

      {/* Vendas do Mês */}
      {vendasLista.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-4">
            Vendas do Mês ({vendasLista.length})
          </h3>
          <Table
            cols={['Data', 'Lead', 'Closer', 'Programa', 'Contrato', 'CC', 'Etapa']}
            rows={vendasLista.map(v => {
              const d = v.data_venda ? new Date(v.data_venda).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—';
              return [
                d,
                v.nome ?? '—',
                v.closer ?? '—',
                v.programa ?? '—',
                v.rs_contrato ? fmtBRL(v.rs_contrato) : '—',
                v.rs_cc ? fmtBRL(v.rs_cc) : '—',
                v.etapa ? <span className="inline-block bg-brand-primary/20 text-brand-primary text-[10px] font-bold px-2 py-0.5 rounded-full">{v.etapa}</span> : '—',
              ] as any;
            })}
          />
          <div className="flex justify-end gap-6 mt-3 pt-3 border-t border-white/10">
            <span className="text-xs text-gray-400">Total: <span className="text-white font-bold">{fmtBRL(vendasLista.reduce((s, v) => s + (parseFloat(v.rs_contrato) || 0), 0))}</span> em contrato</span>
            <span className="text-xs text-gray-400"><span className="text-white font-bold">{fmtBRL(vendasLista.reduce((s, v) => s + (parseFloat(v.rs_cc) || 0), 0))}</span> em CC</span>
          </div>
        </div>
      )}
    </div>
  );
}
// ── PAGE: Semanal ─────────────────────────────────────────────
function PageSemanal({ data, userSession }: { data: any; userSession: any }) {
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
        <Table
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

// ── PAGE: Reuniões ────────────────────────────────────────────
function PageReunioes({ data }: { data: any }) {
  console.log('[reunioes dia] raw data:', data);
  console.log('[reunioes dia] data.dia:', data?.dia);
  const dia: any[] = Array.isArray(data?.dia) ? data.dia : data?.dia ? [data.dia] : [];
  console.log('[reunioes dia] parsed array:', dia.length, dia);

  const statusStyle: Record<string, React.CSSProperties> = {
    'Pendente': { color: '#d4af37' },
    'Reunião Marcada': { color: '#d4af37' },
    'Compareceu': { color: '#4ade80' },
    'Reunião Realizada': { color: '#4ade80' },
    'Venda': { color: '#22c55e', fontWeight: 600 },
    'No-show': { color: '#ef4444' },
    'Não compareceu': { color: '#ef4444' },
    'Perdido': { color: '#dc2626', fontWeight: 600 },
    'Reagendou': { color: '#60a5fa' },
    'Reagendado': { color: '#60a5fa' },
  };

  const STATUS_LABEL: Record<string, string> = {
    'Reunião Marcada': 'Reunião Marcada',
    'No-show': 'No-show',
    'Reunião Realizada': 'Reunião Realizada',
    'Pendente': 'Reunião Marcada',
    'Venda': 'Venda',
    'Perdido': 'Perdido',
    'Reagendado': 'Reagendado',
    'Compareceu': 'Compareceu',
    'Não compareceu': 'Não compareceu',
    'Reagendou': 'Reagendou',
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-4">
          Reuniões do Dia ({dia.length})
        </h3>
        {dia.length === 0 ? <Empty msg="Nenhuma reunião hoje." /> : (
          <Table
            cols={['Lead', 'Telefone', 'Horário', 'Status', 'TP', 'Vendedor', 'SDR']}
            rows={dia.map(r => {
              const label = STATUS_LABEL[r.status] ?? r.status;
              return [
                r.lead,
                r.telefone ?? '—',
                r.horario ?? '—',
                <span style={statusStyle[label] ?? statusStyle[r.status] ?? { color: '#aaa' }}>{label}</span>,
                r.tp ?? '—',
                r.vendedor ?? '—',
                r.sdr ?? '—',
              ] as any;
            })}
          />
        )}
      </div>
    </div>
  );
}

// ── PAGE: Análise de Vendas ───────────────────────────────────
function PageAnalise({ data, range }: { data: any; range: DateRange }) {
  const toArr = (d: any) => Array.isArray(d) ? d : d ? [d] : [];
  const etapas     = toArr(data?.etapas).map((x: any) => ({ ...x, vendas: +x.vendas, ticket_medio: +x.ticket_medio, cc_medio: +x.cc_medio }));
  const etapaPizza = toArr(data?.etapa_pizza).map((x: any) => ({ ...x, vendas: +x.vendas, pct_total: +x.pct_total }));
  const programas  = toArr(data?.programas).map((x: any) => ({ ...x, vendas: +x.vendas, pct_total: +x.pct_total }));
  const motivos    = toArr(data?.motivos).map((x: any) => ({ ...x, quantidade: +x.quantidade, pct_total: +x.pct_total }));
  const closers    = toArr(data?.closers).map((x: any) => ({ ...x, vendas: +x.vendas }));

  // Fetch dados de metas (por_tp + closers por TP)
  const [metasData, setMetasData] = useState<any>(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${WEBHOOK_BASE}?page=metas&data_inicio=${range.inicio}&data_fim=${range.fim}`);
        if (!res.ok) return;
        const json = await res.json();
        setMetasData(json);
      } catch { /* silently fail */ }
    })();
  }, [range.inicio, range.fim]);

  const metasM = Array.isArray(metasData?.metas) ? metasData.metas[0] : metasData?.metas;
  const porTp: { tp: string; marcadas: number; realizadas: number; show_rate: number; vendas: number; tx_conversao: number }[] =
    metasM ? (typeof metasM.por_tp === 'string' ? JSON.parse(metasM.por_tp) : (metasM.por_tp || [])) : [];
  const metasClosers: any[] = Array.isArray(metasData?.closers) ? metasData.closers : metasData?.closers ? [metasData.closers] : [];

  const tpColors: Record<string, string> = { R1: '#fff', R2: '#d4af37', R3: '#ef9f27', 'R4+': '#ef4444' };

  const PizzaLegend = ({ items, nameKey, valueKey }: { items: any[]; nameKey: string; valueKey: string }) => (
    <div className="space-y-1 mt-2">
      {items.map((item: any, i: number) => (
        <div key={i} className="flex justify-between text-xs">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="truncate max-w-[120px]">{item[nameKey]}</span>
          </span>
          <span className="text-gray-400">{item[valueKey]}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Performance por etapa de reunião (por_tp) + Closer por TP */}
      <div className="grid grid-cols-2 gap-4">
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
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    {['TP', 'Marcadas', 'Realizadas', 'Show Rate', 'Vendas', 'Conversão'].map(h => (
                      <th key={h} className="py-2 px-2 text-[9px] font-bold uppercase tracking-widest text-center" style={{ color: '#aaa' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const isTotal = r.tp === 'TOTAL';
                    const color = isTotal ? '#00FF88' : (tpColors[r.tp] ?? '#fff');
                    return (
                      <tr key={r.tp} className={`border-b border-white/5 ${isTotal ? 'bg-white/5' : ''}`}>
                        <td className="py-2 px-2 text-center font-bold" style={{ color }}>{r.tp}</td>
                        <td className="py-2 px-2 text-center text-white">{fmt(r.marcadas)}</td>
                        <td className="py-2 px-2 text-center text-white">{fmt(r.realizadas)}</td>
                        <td className="py-2 px-2 text-center text-white">{r.show_rate?.toFixed(1)}%</td>
                        <td className="py-2 px-2 text-center text-white">{fmt(r.vendas)}</td>
                        <td className="py-2 px-2 text-center text-white">{r.tx_conversao?.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </div>

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
      </div>

      {/* Linha 1: Ticket/CC por Etapa (barras) | Ticket/CC por Closer (tabela) */}
      <div className="grid grid-cols-2 gap-4">
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

        <div className="glass-card p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary">Ticket e CC Médios por Closer</h3>
          {closers.length === 0 ? <Empty /> : (
            <Table
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

      {/* Linha 2: Vendas por Etapa | Vendas por Programa */}
      <div className="grid grid-cols-2 gap-4">
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
                    {etapaPizza.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
                    {programas.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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

// ── PAGE: Anúncios ────────────────────────────────────────────
function PageAnuncios({ data }: { data: any }) {
  const funil: any[] = Array.isArray(data?.funil) ? data.funil
    : data?.funil ? [data.funil] : [];
  const custos = Array.isArray(data?.custos) ? data.custos[0] : data?.custos;

  // Color scale per column threshold
  // lead→mql: green ≥30%, mql→rm: green ≥40%, rm→rr: green ≥40%, rr→venda: green ≥20%
  const txColor = (pct: any, threshold: number) => {
    const v = parseFloat(pct ?? 0);
    if (v >= threshold)            return 'bg-green-700/60 text-green-200';
    if (v >= threshold * 0.75)     return 'bg-yellow-700/60 text-yellow-200';
    if (v >= threshold * 0.50)     return 'bg-orange-700/60 text-orange-200';
    return 'bg-red-800/60 text-red-300';
  };

  const cols = [
    { h: 'Anúncio',   w: 'min-w-[140px]' },
    { h: 'Leads',     w: '' },
    { h: 'Tx (%)',    w: '' },
    { h: 'MQL',       w: '' },
    { h: 'Tx (%)',    w: '' },
    { h: 'RM',        w: '' },
    { h: 'Tx (%)',    w: '' },
    { h: 'RR',        w: '' },
    { h: 'Tx (%)',    w: '' },
    { h: 'Vendas',    w: '' },
    { h: 'Contrato',  w: '' },
    { h: 'CC',        w: '' },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs de custo */}
      {custos && (
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Verba Mídia',    value: fmtBRL(custos.verba_midia) },
            { label: 'CPL',            value: fmtBRL(custos.cpl) },
            { label: 'Custo MQL',      value: fmtBRL(custos.custo_mql) },
            { label: 'Custo RM (CRM)', value: fmtBRL(custos.custo_rm) },
            { label: 'Custo RR (CRR)', value: fmtBRL(custos.custo_rr) },
            { label: 'CAC',            value: fmtBRL(custos.cac) },
          ].map(k => (
            <div key={k.label} className="glass-card p-4 text-center space-y-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-brand-primary">{k.label}</p>
              <p className="text-lg font-black text-white">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabela funil por anúncio */}
      <div className="glass-card p-6 overflow-x-auto">
        <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-4">Performance dos Anúncios</h3>
        {funil.length === 0 ? <Empty /> : (
          <table className="w-full text-xs min-w-[1100px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5 min-w-[140px]">Anúncio</th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">Leads</th>
                <th className="text-center py-2 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">Tx(%)</th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">MQL</th>
                <th className="text-center py-2 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">Tx(%)</th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">RM</th>
                <th className="text-center py-2 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">Tx(%)</th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">RR</th>
                <th className="text-center py-2 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">Tx(%)</th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">Vendas</th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">Contrato</th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">CC</th>
              </tr>
            </thead>
            <tbody>
              {funil.map((row: any, i: number) => (
                <>
                  {/* Linha 1: funil */}
                  <tr key={`funil-${i}`} className="hover:bg-white/5 transition-colors">
                    <td rowSpan={2} className="py-2 px-3 font-medium text-gray-200 border-b border-white/10 align-middle max-w-[160px]">
                      <span className="block truncate">{row.anuncio}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center text-blue-300 font-bold">{row.leads ?? '—'}</td>
                    <td className="py-1.5 px-1 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${txColor(row.tx_mql, 30)}`}>{row.tx_mql ? `${parseFloat(row.tx_mql).toFixed(2)}%` : '—'}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center">{row.mqls ?? '—'}</td>
                    <td className="py-1.5 px-1 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${txColor(row.tx_rm, 40)}`}>{row.tx_rm ? `${parseFloat(row.tx_rm).toFixed(2)}%` : '—'}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center">{row.rm ?? '—'}</td>
                    <td className="py-1.5 px-1 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${txColor(row.tx_rr, 40)}`}>{row.tx_rr ? `${parseFloat(row.tx_rr).toFixed(2)}%` : '—'}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center">{row.rr ?? '—'}</td>
                    <td className="py-1.5 px-1 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${txColor(row.tx_venda, 20)}`}>{row.tx_venda ? `${parseFloat(row.tx_venda).toFixed(2)}%` : '—'}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center text-brand-primary font-bold">{row.vendas ?? '—'}</td>
                    <td className="py-1.5 px-2 text-center text-white">{row.total_contrato ? fmtBRL(row.total_contrato) : '—'}</td>
                    <td className="py-1.5 px-2 text-center text-white">{row.total_cc ? fmtBRL(row.total_cc) : '—'}</td>
                  </tr>
                  {/* Linha 2: custos */}
                  <tr key={`custos-${i}`} className="border-b border-white/10">
                    <td className="py-1 px-2 text-center text-[10px] text-gray-500">
                      {row.custo_lead ? <span className="text-yellow-600">CPL: {fmtBRL(row.custo_lead)}</span> : <span className="text-gray-700">—</span>}
                    </td>
                    <td />
                    <td className="py-1 px-2 text-center text-[10px] text-gray-500">
                      {row.custo_mql ? <span className="text-yellow-600">C.MQL: {fmtBRL(row.custo_mql)}</span> : <span className="text-gray-700">—</span>}
                    </td>
                    <td />
                    <td className="py-1 px-2 text-center text-[10px] text-gray-500">
                      {row.custo_rm ? <span className="text-yellow-600">C.RM: {fmtBRL(row.custo_rm)}</span> : <span className="text-gray-700">—</span>}
                    </td>
                    <td />
                    <td className="py-1 px-2 text-center text-[10px] text-gray-500">
                      {row.custo_rr ? <span className="text-yellow-600">C.RR: {fmtBRL(row.custo_rr)}</span> : <span className="text-gray-700">—</span>}
                    </td>
                    <td />
                    <td className="py-1 px-2 text-center text-[10px] text-gray-500">
                      {row.cac ? <span className="text-yellow-400 font-bold">CAC: {fmtBRL(row.cac)}</span> : <span className="text-gray-700">—</span>}
                    </td>
                    <td />
                    <td />
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── PAGE: SDR ─────────────────────────────────────────────────
function PageSDR({ data }: { data: any }) {
  const producao: any[] = Array.isArray(data?.producao) ? data.producao : [];
  const leads: any[] = Array.isArray(data?.leads_semanal) ? data.leads_semanal : [];

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
          <Table
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
          <Table
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
