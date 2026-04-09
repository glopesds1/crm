import React from 'react';
import { RefreshCw, TrendingUp, Target, Calendar, Users, Activity, BarChart2, Briefcase, AlertCircle } from 'lucide-react';
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { useDashboardData } from './hooks/useDashboardData';
import { Loading } from './components/ui/Loading';
import { OverviewTab } from './components/OverviewTab';
import { MetasMensaisTab } from './components/MetasMensaisTab';
import { SemanalTab } from './components/SemanalTab';
import { ReunioesTab } from './components/ReunioesTab';
import { AnaliseTab } from './components/AnaliseTab';
import { AnunciosTab } from './components/AnunciosTab';
import { SDRTab } from './components/SDRTab';
import type { DashboardPage as PageType } from '../shared/types';

const PAGES: { id: PageType; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: TrendingUp },
  { id: 'metas', label: 'Metas Mensais', icon: Target },
  { id: 'semanal', label: 'Semanal', icon: Calendar },
  { id: 'reunioes', label: 'Reuniões do Dia', icon: Users },
  { id: 'anuncios', label: 'Funis', icon: Activity },
  { id: 'analise', label: "KPI's Vendas", icon: BarChart2 },
  { id: 'sdr', label: "KPI's Pré-vendas", icon: Briefcase },
];

export default function DashboardPage({ userSession }: { userSession: any }) {
  const {
    page, setPage, loading, data, error,
    range, setRange, periodo, setPeriodo, fetchData, fimMes,
  } = useDashboardData(userSession);

  const today = new Date();
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
          {(['overview', 'metas', 'analise', 'anuncios', 'sdr'] as PageType[]).includes(page) && (<>
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
              <input
                type="date"
                value={range.inicio}
                onChange={e => { setPeriodo('custom'); setRange(r => ({ ...r, inicio: e.target.value })); }}
                className="bg-transparent text-xs text-gray-300 focus:outline-none [&::-webkit-calendar-picker-indicator]:brightness-75"
              />
              <span className="text-xs" style={{ color: '#888' }}>→</span>
              <input
                type="date"
                value={range.fim}
                onChange={e => { setPeriodo('custom'); setRange(r => ({ ...r, fim: e.target.value })); }}
                className="bg-transparent text-xs text-gray-300 focus:outline-none [&::-webkit-calendar-picker-indicator]:brightness-75"
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
          {page === 'overview' && <OverviewTab data={data} range={range} userSession={userSession} />}
          {page === 'metas' && <MetasMensaisTab data={data} userSession={userSession} range={range} />}
          {page === 'semanal' && <SemanalTab data={data} userSession={userSession} />}
          {page === 'reunioes' && <ReunioesTab data={data} />}
          {page === 'analise' && <AnaliseTab data={data} range={range} />}
          {page === 'anuncios' && <AnunciosTab data={data} />}
          {page === 'sdr' && <SDRTab data={data} />}
        </>
      )}
    </div>
  );
}
