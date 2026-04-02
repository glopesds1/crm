import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, RefreshCw, Search, Phone, Building2, DollarSign,
  User, X, ChevronLeft, ChevronRight, Loader2, MapPin, Clock,
  PhoneCall, Users, FileText, Calendar, CheckCircle2,
  ChevronDown, Trash2, Bell, Volume2, Send, Video
} from 'lucide-react';
import type { TeamMember } from './types';
import { DEFAULT_ONBOARDING_ITEMS } from './constants';

// ── Helpers — Fuso horário fixo: America/Sao_Paulo (UTC-3) ───
// Brasil aboliu horário de verão em 2019, então -03:00 é fixo.
const SP_TZ = 'America/Sao_Paulo';

const WEBHOOK_BASE = (import.meta.env.VITE_WEBHOOK_BASE ?? 'https://webhook.m2black.com/webhook/dashboard').replace('/webhook/dashboard', '');

const syncPostgres = (leadExternoId: string | undefined | null, fields: Record<string, unknown>) => {
  if (!leadExternoId) return;
  const clean: Record<string, unknown> = { lead_externo_id: leadExternoId };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) clean[k] = v;
  }
  fetch(`${WEBHOOK_BASE}/webhook/crm-sync-etapa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clean),
  }).catch(e => console.warn('[syncPostgres]', e.message));
};

// datetime-local retorna "2026-03-24T18:00" sem timezone.
// Anexa explicitamente -03:00 para que o Supabase (timestamptz) interprete
// como horário de São Paulo, independente do fuso do navegador.
function localDatetimeToISO(dt: string): string {
  if (!dt) return dt;
  // Se já tem offset, não duplicar
  if (/[+-]\d{2}:\d{2}$/.test(dt) || dt.endsWith('Z')) return dt;
  // datetime-local dá "YYYY-MM-DDTHH:mm", pode ou não ter segundos
  const needsSec = (dt.match(/:/g) || []).length < 2;
  return `${dt}${needsSec ? ':00' : ''}-03:00`;
}

// Parse uma data do Supabase garantindo interpretação correta do fuso.
// timestamptz vem com +00:00; timestamp vem sem offset (tratar como SP).
function parseDateSP(iso: string): Date {
  if (!iso) return new Date(NaN);
  if (!iso.includes('+') && !iso.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(iso)) {
    return new Date(iso + '-03:00');
  }
  return new Date(iso);
}

// Formata uma data ISO na timezone de São Paulo.
function fmtDateSP(iso: string, opts?: { year?: boolean }): string {
  if (!iso) return '—';
  try {
    const d = parseDateSP(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      timeZone: SP_TZ,
      day: '2-digit', month: '2-digit',
      ...(opts?.year ? { year: '2-digit' } : {}),
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

/** Formata data/hora, mas omite hora se for exatamente 00:00 (DATE sem hora). */
function fmtDateSmartSP(iso: string, opts?: { year?: boolean }): string {
  if (!iso) return '—';
  try {
    const d = parseDateSP(iso);
    if (isNaN(d.getTime())) return '—';
    const h = Number(d.toLocaleString('pt-BR', { timeZone: SP_TZ, hour: '2-digit', hour12: false }));
    const m = Number(d.toLocaleString('pt-BR', { timeZone: SP_TZ, minute: '2-digit' }));
    if (h === 0 && m === 0) {
      return d.toLocaleDateString('pt-BR', { timeZone: SP_TZ, day: '2-digit', month: '2-digit', ...(opts?.year ? { year: '2-digit' } : {}) });
    }
    return fmtDateSP(iso, opts);
  } catch { return '—'; }
}

// ── Slot Picker — Calendário de disponibilidade ──────────────
const SLOT_HOURS = ['09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00'];
const MAX_POR_SLOT = 2;

const WEBHOOK_BASE_SLOT = (import.meta.env.VITE_WEBHOOK_BASE ?? 'https://webhook.m2black.com/webhook/dashboard').replace('/webhook/dashboard', '');

function SlotPicker({ selectedDate, onSelectDate, selectedHour, onSelectHour, tpAtual }: {
  selectedDate: string; onSelectDate: (d: string) => void; selectedHour: string; onSelectHour: (h: string) => void; tpAtual?: string;
}) {
  const [ocupacao, setOcupacao] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Mês exibido no calendário [year, month(0-indexed)]
  const [viewYear, setViewYear] = useState(() => {
    if (selectedDate) {
      const [y, m] = selectedDate.split('-').map(Number);
      return y;
    }
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDate) {
      const [, m] = selectedDate.split('-').map(Number);
      return m - 1;
    }
    return new Date().getMonth();
  });

  // Today helpers
  const nowRef = useRef(new Date());
  const todayStr = React.useMemo(() => {
    const n = nowRef.current;
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }, []);
  const todayYear = nowRef.current.getFullYear();
  const todayMonth = nowRef.current.getMonth();
  const todayDate = nowRef.current.getDate();
  const currentHour = nowRef.current.getHours();

  // Gerar dias do mês para o grid do calendário
  const calendarDays = React.useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startDow = firstDay.getDay(); // 0=dom
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { day: number; month: number; year: number; currentMonth: boolean; dateStr: string }[] = [];

    // Dias do mês anterior para preencher o início
    for (let i = startDow - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      cells.push({ day: d, month: m, year: y, currentMonth: false, dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }

    // Dias do mês atual
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, month: viewMonth, year: viewYear, currentMonth: true, dateStr: `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }

    // Preencher final para completar a última semana
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      for (let d = 1; d <= remaining; d++) {
        cells.push({ day: d, month: nextM, year: nextY, currentMonth: false, dateStr: `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
      }
    }

    return cells;
  }, [viewYear, viewMonth]);

  // Navegar meses
  const canGoPrev = viewYear > todayYear || (viewYear === todayYear && viewMonth > todayMonth);
  const goNextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
    onSelectHour('');
  };
  const goPrevMonth = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
    onSelectHour('');
  };

  // Nome do mês
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: SP_TZ });

  // Verificar se um dia é passado ou fim de semana
  const isDayDisabled = (cell: typeof calendarDays[0]) => {
    if (!cell.currentMonth) return true;
    const dow = new Date(cell.year, cell.month, cell.day).getDay();
    if (dow === 0 || dow === 6) return true; // fim de semana
    // Dia passado
    if (cell.year < todayYear) return true;
    if (cell.year === todayYear && cell.month < todayMonth) return true;
    if (cell.year === todayYear && cell.month === todayMonth && cell.day < todayDate) return true;
    // Hoje: desabilitar se já passou das 17h
    if (cell.dateStr === todayStr && currentHour >= 17) return true;
    return false;
  };

  // Fetch disponibilidade quando data muda
  useEffect(() => {
    if (!selectedDate) return;
    const map: Record<string, number> = {};
    SLOT_HOURS.forEach(s => map[s] = 0);
    setOcupacao(map);
    setLoading(true);
    (async () => {
      try {
        const resp = await fetch(`${WEBHOOK_BASE_SLOT}/webhook/dashboard?page=disponibilidade&data_inicio=${selectedDate}`);
        const json = await resp.json();
        const slots: { hora: string; ocupacao: number | string }[] = json.slots || [];
        const m: Record<string, number> = {};
        SLOT_HOURS.forEach(s => m[s] = 0);
        slots.forEach(s => { if (m[s.hora] !== undefined) m[s.hora] = Number(s.ocupacao); });
        setOcupacao(m);
      } catch (e) {
        console.warn('[disponibilidade]', e);
      } finally { setLoading(false); }
    })();
  }, [selectedDate]);

  // Filtrar slots passados se hoje
  const visibleSlots = SLOT_HOURS.filter(h => {
    if (selectedDate !== todayStr) return true;
    return parseInt(h) > currentHour;
  });

  // Data selecionada formatada
  const selectedDateFormatted = React.useMemo(() => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: SP_TZ });
  }, [selectedDate]);

  const DOW_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  return (
    <div className="rounded-xl bg-[var(--color-background-secondary,#1a1a2e)] p-4">
      {/* Cabeçalho do mês */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={goPrevMonth} disabled={!canGoPrev}
            className={`p-1 rounded-full transition-colors ${canGoPrev ? 'text-gray-300 hover:text-white hover:bg-white/10' : 'text-gray-700 cursor-not-allowed'}`}>
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-[var(--color-text-primary,#fff)] capitalize">{monthLabel}</span>
          <button type="button" onClick={goNextMonth}
            className="p-1 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
        <span className="text-[11px] text-gray-500">Horário de Brasília</span>
      </div>

      <p className="text-xs text-gray-400 mb-3">Selecione uma data e horário</p>

      {/* Layout: calendário + slots */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Calendário mensal */}
        <div className="flex-shrink-0">
          {/* Cabeçalho dias da semana */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DOW_LABELS.map(d => (
              <div key={d} className="text-center text-[11px] text-gray-500 font-medium py-1">{d}</div>
            ))}
          </div>
          {/* Grid de dias */}
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((cell, i) => {
              const disabled = isDayDisabled(cell);
              const isSelected = selectedDate === cell.dateStr;
              const isToday = cell.dateStr === todayStr;
              return (
                <button key={i} type="button" disabled={disabled}
                  onClick={() => { onSelectDate(cell.dateStr); onSelectHour(''); }}
                  className={`w-8 h-8 rounded-full text-[13px] font-medium transition-all flex items-center justify-center ${
                    isSelected
                      ? 'bg-cyan-500 text-white font-bold'
                      : disabled
                        ? 'text-gray-700 cursor-not-allowed'
                        : isToday
                          ? 'text-cyan-400 border border-cyan-500/40 hover:bg-white/10'
                          : cell.currentMonth
                            ? 'text-gray-300 hover:bg-white/10 hover:text-white'
                            : 'text-gray-700 cursor-not-allowed'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slots de horário */}
        <div className="flex-1 min-w-0">
          {selectedDate ? (
            <>
              <p className="text-xs font-semibold text-[var(--color-text-primary,#fff)] mb-2 capitalize">{selectedDateFormatted}</p>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-gray-500" />
                </div>
              ) : visibleSlots.length === 0 ? (
                <p className="text-[12px] text-gray-600 text-center py-4">Nenhum horário disponível</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {visibleSlots.map(h => {
                    const occ = ocupacao[h] ?? 0;
                    const isR1 = !tpAtual || tpAtual === 'R1';
                    const full = isR1 && occ >= MAX_POR_SLOT;
                    const selected = selectedHour === h;

                    let borderColor = 'border-[#22c55e60]';
                    let bgColor = 'bg-transparent';
                    let txt = 'text-white';
                    let badge = '';
                    if (occ === 1) { borderColor = 'border-[#d4af3760]'; badge = '1/2'; }
                    if (occ >= 2) { borderColor = 'border-[#ef444460]'; badge = '2/2'; }
                    if (full) { txt = 'text-gray-600'; }
                    if (selected && !full) { bgColor = 'bg-cyan-500/20'; borderColor = 'border-cyan-400'; }

                    return (
                      <button key={h} type="button" disabled={full}
                        onClick={() => onSelectHour(h)}
                        className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all flex items-center justify-between ${bgColor} ${borderColor} ${txt} ${
                          full ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:brightness-125'
                        } ${selected && !full ? 'ring-1 ring-cyan-400/30' : ''}`}
                      >
                        <span className="font-bold">{h}</span>
                        {badge && <span className="text-[10px] opacity-70">{badge}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-8 text-gray-600 text-xs">
              Selecione uma data no calendário
            </div>
          )}
        </div>
      </div>

      {/* Resumo */}
      {selectedDate && selectedHour && (
        <p className="text-[11px] text-gray-400 mt-3">
          Reunião marcada para <span className="text-white font-semibold">{selectedDate.split('-').reverse().join('/')}</span> às <span className="text-white font-semibold">{selectedHour}</span>
        </p>
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────
interface CRMLead {
  id: string;
  lead_externo_id?: string;
  nome: string;
  telefone?: string;
  email?: string;
  empresa?: string;
  faturamento?: string;
  area?: string;
  responsavel?: string;
  etapa: string;
  status: string;
  origem: string;
  anuncio?: string;
  programa_apresentado?: string;
  valor_contrato?: number;
  valor_cc?: number;
  valor_mrr?: number;
  motivo_perda?: string;
  proxima_reuniao?: string;

  tags?: string[];
  observacoes?: string;
  created_at: string;
  updated_at: string;
  etapa_desde?: string;
}

interface CRMAtividade {
  id: string;
  lead_id: string;
  tipo: string;
  titulo?: string;
  descricao?: string;
  data_atividade: string;
  realizado_por?: string;
  status_chamada?: string;
  agendou?: boolean;
  touchpoint?: number;
  status_reuniao?: string;
  resultado?: string;
  imagem_url?: string;
  created_at: string;
}

interface CRMTarefa {
  id: string;
  lead_id: string;
  titulo: string;
  tipo?: 'ligacao' | 'reuniao';
  data_agendada?: string;
  responsavel?: string;
  concluida: boolean;
}

// ── Etapas do pipeline ────────────────────────────────────────
const ETAPAS = [
  { id: 'base',           label: 'Base de Leads',      color: 'border-gray-600',     badge: 'bg-gray-700 text-gray-300' },
  { id: 'triagem',        label: 'Triagem / Pré-venda', color: 'border-blue-600',     badge: 'bg-blue-900/50 text-blue-300' },
  { id: 'rm_marcada',     label: 'Reunião Marcada',     color: 'border-yellow-500',   badge: 'bg-yellow-900/50 text-yellow-300' },
  { id: 'rm_realizada',   label: 'Reunião Realizada',   color: 'border-orange-500',   badge: 'bg-orange-900/50 text-orange-300' },
  { id: 'fup_ativa',      label: 'FUP Ativa',           color: 'border-purple-500',   badge: 'bg-purple-900/50 text-purple-300' },
  { id: 'fechado',        label: 'Fechado',             color: 'border-brand-primary', badge: 'bg-green-900/50 text-green-300' },
  { id: 'perdido',        label: 'Perdido',             color: 'border-red-600',      badge: 'bg-red-900/50 text-red-300' },
  { id: 'congelado',      label: 'Congelado',           color: 'border-cyan-700',     badge: 'bg-cyan-900/50 text-cyan-300' },
  { id: 'desqualificado', label: 'Desqualificado',      color: 'border-gray-700',     badge: 'bg-gray-800/50 text-gray-500' },
];
const ETAPA_MAP = Object.fromEntries(ETAPAS.map(e => [e.id, e]));

const TAGS_CONFIG: Record<string, string> = {
  'MQL':             'bg-blue-900/50 text-blue-300 border-blue-700/50',
  'No-show':         'bg-red-900/50 text-red-300 border-red-700/50',
  'Programa Pro':    'bg-yellow-900/50 text-yellow-400 border-yellow-700/50',
  'Programa Lite':   'bg-gray-800/50 text-gray-300 border-gray-600/50',
  'Programa Basic':  'bg-blue-900/50 text-blue-400 border-blue-700/50',
  'Contrato na Mão': 'bg-green-900/50 text-green-300 border-green-700/50',
  'Link na Mão':     'bg-cyan-900/50 text-cyan-300 border-cyan-700/50',
};
const ALL_TAGS = Object.keys(TAGS_CONFIG);

const getProgramaStyle = (programa: string) => {
  const p = (programa || '').toLowerCase();
  if (p === 'pro')   return 'text-yellow-400 font-bold';
  if (p === 'lite')  return 'text-gray-300 font-bold';
  if (p === 'basic') return 'text-blue-400 font-bold';
  return 'text-white font-bold';
};

const TIPO_ICON: Record<string, any> = {
  ligacao: PhoneCall,
  reuniao: Users,
  nota:    FileText,
  tarefa:  Calendar,
};

// ── Lead Card ─────────────────────────────────────────────────
function LeadCard({ lead, proximaTarefa, onClick }: { key?: React.Key; lead: CRMLead; proximaTarefa?: CRMTarefa; onClick: () => void }) {
  const etapa = ETAPA_MAP[lead.etapa];
  const fmtDate = (d: string) => fmtDateSP(d);

  // Próxima reunião analysis
  const proxReuniao = (lead as any).proxima_reuniao;
  const proxDate = proxReuniao ? new Date(proxReuniao) : null;
  const agora = new Date();
  const isHoje = proxDate ? (proxDate.toDateString() === agora.toDateString()) : false;
  const isAtrasada = proxDate ? (proxDate < agora && !isHoje) : false;
  const tpAtual = (lead as any).tp_atual || '';
  const tpColor = tpAtual === 'R1' ? 'bg-white/10 text-gray-400' : tpAtual === 'R2' ? 'bg-amber-900/30 text-amber-400' : tpAtual ? 'bg-red-900/30 text-red-400' : '';

  // WhatsApp URL
  const waUrl = lead.telefone ? `https://api.whatsapp.com/send?phone=${lead.telefone.replace(/\D/g, '').replace(/^0/, '').replace(/^(?!55)/, '55')}` : '';

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`bg-[#161b26] border border-white/8 rounded-xl p-3.5 cursor-pointer hover:bg-[#1a2030] transition-all duration-200 space-y-2 shadow-md shadow-black/20`}
      style={isHoje ? { borderLeft: '3px solid #d97706' } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-xs font-bold text-white leading-tight line-clamp-1">{lead.nome}</p>
          {tpAtual && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${tpColor}`}>{tpAtual}</span>}
        </div>
        <ChevronRight size={12} className="text-gray-600 flex-shrink-0 mt-0.5" />
      </div>
      {/* Próxima reunião */}
      {proxDate && (
        <div className={`flex items-center gap-1.5 text-[10px] ${isAtrasada ? 'text-red-400' : isHoje ? 'text-amber-400' : 'text-gray-500'}`}>
          <Calendar size={9} className="flex-shrink-0" />
          {isAtrasada ? <span className="font-bold">Atrasada</span> : (
            <span>{proxDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {proxDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</span>
          )}
        </div>
      )}
      {lead.telefone && (
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <Phone size={9} className="text-gray-600" />
          <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="hover:text-brand-primary transition-colors">{lead.telefone}</a>
        </div>
      )}
      {lead.area && <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><MapPin size={9} className="text-gray-600" /><span className="truncate">{lead.area}</span></div>}
      {lead.faturamento && <div className="flex items-center gap-1.5 text-[10px] text-gray-500"><DollarSign size={9} className="text-gray-600" />{lead.faturamento}</div>}
      {lead.responsavel && <div className="flex items-center gap-1.5 text-[10px] text-gray-500"><User size={9} className="text-gray-600" />{lead.responsavel}</div>}
      {lead.programa_apresentado && (() => {
        const p = (lead.programa_apresentado || '').toLowerCase();
        const style = p.includes('pro') ? { background: '#d4af3722', color: '#d4af37', border: '1px solid #d4af3744' }
          : p.includes('lite') ? { background: '#c0c0c022', color: '#c0c0c0', border: '1px solid #c0c0c044' }
          : p.includes('basic') ? { background: '#60a5fa22', color: '#60a5fa', border: '1px solid #60a5fa44' }
          : { background: '#ffffff11', color: '#fff', border: '1px solid #ffffff22' };
        return <div style={{ fontSize: 13, fontWeight: 600, padding: '4px 12px', borderRadius: 6, display: 'inline-block', ...style }}>{lead.programa_apresentado}</div>;
      })()}
      {((lead.valor_contrato != null && lead.valor_contrato > 0) || (lead.valor_cc != null && lead.valor_cc > 0)) && (
        <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
          {lead.valor_contrato != null && lead.valor_contrato > 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contrato</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#d4af37' }}>R$ {Number(lead.valor_contrato).toLocaleString('pt-BR', { minimumFractionDigits: lead.valor_contrato % 1 ? 2 : 0 })}</div>
            </div>
          )}
          {lead.valor_cc != null && lead.valor_cc > 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cash Collect</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#60a5fa' }}>R$ {Number(lead.valor_cc).toLocaleString('pt-BR', { minimumFractionDigits: lead.valor_cc % 1 ? 2 : 0 })}</div>
            </div>
          )}
        </div>
      )}
      {proximaTarefa && !proximaTarefa.concluida && (() => {
        const isReuniao = proximaTarefa.titulo.startsWith('R1') || proximaTarefa.titulo.startsWith('R2');
        const colorClass = isReuniao ? 'text-orange-400 bg-orange-900/20' : 'text-yellow-400 bg-yellow-900/20';
        return (
          <div className={`flex items-center gap-1.5 text-[10px] ${colorClass} rounded-lg px-2 py-1`}>
            <Calendar size={9} />
            <span className="truncate">{proximaTarefa.titulo}</span>
            {proximaTarefa.data_agendada && <span className="text-gray-600 ml-auto flex-shrink-0">{fmtDate(proximaTarefa.data_agendada)}</span>}
          </div>
        );
      })()}
      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {lead.tags.map(tag => <span key={tag} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${TAGS_CONFIG[tag] ?? 'bg-white/5 text-gray-500 border-white/10'}`}>{tag}</span>)}
        </div>
      )}
      <div className="text-[9px] text-gray-600 pt-1.5 mt-1 border-t border-white/8">
        {lead.created_at ? fmtDateSmartSP(lead.created_at, { year: true }) : '—'}
      </div>
    </motion.div>
  );
}

// ── Nova Atividade Form ────────────────────────────────────────
function NovaAtividadeForm({ lead: leadObj, leadId, leadName, userSession, onSaved, onCancel, onLeadUpdated, onClientCreated, onTarefaCreated, teamMembers = [], initialTipo }: {
  lead?: CRMLead; leadId: string; leadName: string; userSession: any; onSaved: (a: CRMAtividade) => void; onCancel: () => void; onLeadUpdated?: (upd: Partial<CRMLead>) => void; onClientCreated?: () => void;
  onTarefaCreated?: (tarefa: CRMTarefa) => void; teamMembers?: TeamMember[]; initialTipo?: 'ligacao' | 'reuniao';
}) {
  const [responsavelAtividade, setResponsavelAtividade] = useState(leadObj?.responsavel ?? userSession?.name ?? '');
  const [tipo, setTipo] = useState<'ligacao' | 'reuniao' | null>(initialTipo ?? null);
  const [statusChamada, setStatusChamada] = useState<'Atendeu' | 'Não atendeu' | null>(null);
  const [touchpoint, setTouchpoint] = useState('');
  const [agendou, setAgendou] = useState(false);
  // BANT fields for scheduling (Ligação → Atendeu → Agendar Reunião)
  const [bantTipo, setBantTipo] = useState<'R1' | 'R2'>('R1');
  const [bantDataHora, setBantDataHora] = useState('');
  // SlotPicker state — BANT
  const tomorrowBant = React.useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }, []);
  const [bantSlotDate, setBantSlotDate] = useState(tomorrowBant);
  const [bantSlotHour, setBantSlotHour] = useState('');
  const [bantDuracao, setBantDuracao] = useState('60');
  const [bantCloser, setBantCloser] = useState('');
  const [bantFaturamento, setBantFaturamento] = useState(leadObj?.faturamento ?? '');
  const [bantBudget, setBantBudget] = useState('');
  const [bantMomento, setBantMomento] = useState('');
  const [bantCaptacao, setBantCaptacao] = useState('');
  const [bantAutoridade, setBantAutoridade] = useState('');
  const [bantNecessidade, setBantNecessidade] = useState('');
  const [bantTiming, setBantTiming] = useState('');
  const [bantSdr, setBantSdr] = useState('');
  const [bantObs, setBantObs] = useState('');
  const [imageError, setImageError] = useState(false);
  const [statusReuniao, setStatusReuniao] = useState<'Compareceu' | 'Não compareceu' | null>(null);
  const [resultado, setResultado] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tituloTarefa, setTituloTarefa] = useState('');
  const [dataAgendada, setDataAgendada] = useState('');
  const [saving, setSaving] = useState(false);
  const [erroMotivo, setErroMotivo] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  // Reunião extra fields — pre-fill with existing lead data
  const [valorContrato, setValorContrato] = useState(leadObj?.valor_contrato ? String(leadObj.valor_contrato) : '');
  const [valorCc, setValorCc] = useState(leadObj?.valor_cc ? String(leadObj.valor_cc) : '');
  const [prazoMeses, setPrazoMeses] = useState('');
  const [resumo, setResumo] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [tipoPessoa, setTipoPessoa] = useState<'PF' | 'PJ'>('PJ');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [endereco, setEndereco] = useState('');
  const [emailContato, setEmailContato] = useState('');
  const [telefoneContato, setTelefoneContato] = useState('');
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('');
  const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState('');
  const [proximaReuniao, setProximaReuniao] = useState('');
  // SlotPicker state — Próxima Reunião
  const tomorrowProx = React.useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }, []);
  const [proxSlotDate, setProxSlotDate] = useState(tomorrowProx);
  const [proxSlotHour, setProxSlotHour] = useState('');
  const [motivoPerda, setMotivoPerda] = useState('');
  // Ligação extra fields
  const [resumoLigacao, setResumoLigacao] = useState('');
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [nomeLeadConfirmado, setNomeLeadConfirmado] = useState('');
  const [motivoNaoAtendeu, setMotivoNaoAtendeu] = useState('');
  // Bloco 1: Agendar retorno (ligação não atendeu)
  const [agendarRetorno, setAgendarRetorno] = useState(false);
  const [dataRetorno, setDataRetorno] = useState('');
  // Bloco 4: Campos extras Venda
  const [programaApresentadoNAF, setProgramaApresentadoNAF] = useState(leadObj?.programa_apresentado || '');
  const [tempoContrato, setTempoContrato] = useState('');
  const [dataOnboarding, setDataOnboarding] = useState('');
  // Bloco 5: Reagendar após não compareceu
  const [reagendarNoShow, setReagendarNoShow] = useState(false);
  const [dataReagendamento, setDataReagendamento] = useState('');
  // SlotPicker state — Reagendamento
  const tomorrowReag = React.useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }, []);
  const [reagSlotDate, setReagSlotDate] = useState(tomorrowReag);
  const [reagSlotHour, setReagSlotHour] = useState('');

  // Sync SlotPicker → state variables existentes
  useEffect(() => { setBantDataHora(bantSlotDate && bantSlotHour ? `${bantSlotDate}T${bantSlotHour}:00` : ''); }, [bantSlotDate, bantSlotHour]);
  useEffect(() => { setProximaReuniao(proxSlotDate && proxSlotHour ? `${proxSlotDate}T${proxSlotHour}:00` : ''); }, [proxSlotDate, proxSlotHour]);
  useEffect(() => { setDataReagendamento(reagSlotDate && reagSlotHour ? `${reagSlotDate}T${reagSlotHour}:00` : ''); }, [reagSlotDate, reagSlotHour]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const formatPhoneForWhatsApp = (phone?: string) => {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (!digits.startsWith('55')) digits = '55' + digits;
    return digits;
  };

  const handleSelectTipo = (t: 'ligacao' | 'reuniao') => {
    setTipo(t);
    if (t === 'ligacao' && leadObj?.telefone) {
      const waNumber = formatPhoneForWhatsApp(leadObj.telefone);
      if (waNumber) window.open(`whatsapp://send?phone=${waNumber}`, '_self');
    }
  };

  const [validationMsg, setValidationMsg] = useState('');

  const handleSave = async () => {
    setValidationMsg('');
    if (!tipo) { setValidationMsg('Selecione o tipo: Ligação ou Reunião'); return; }
    if (!responsavelAtividade) { setValidationMsg('Selecione o responsável pela atividade'); return; }
    // Print obrigatório para todas as atividades
    if (!imageFile) { setImageError(true); return; }

    if (tipo === 'ligacao') {
      if (!statusChamada) { setValidationMsg('Selecione se atendeu ou não'); return; }
      if (!touchpoint) { setValidationMsg('Preencha o touchpoint'); return; }
      if (statusChamada === 'Atendeu') {
        if (agendou) {
          if (!bantDataHora) { setValidationMsg('Preencha a data/hora da reunião'); return; }
          if (!bantCloser) { setValidationMsg('Selecione o closer responsável'); return; }
          if (!bantSdr) { setValidationMsg('Selecione o SDR responsável'); return; }
          if (!bantFaturamento) { setValidationMsg('Preencha o faturamento (BANT)'); return; }
          if (!bantBudget) { setValidationMsg('Preencha o budget (BANT)'); return; }
          if (!bantMomento) { setValidationMsg('Selecione o momento do negócio (BANT)'); return; }
          if (!bantCaptacao) { setValidationMsg('Selecione como capta clientes (BANT)'); return; }
          if (!bantAutoridade) { setValidationMsg('Selecione a autoridade (BANT)'); return; }
          if (!bantNecessidade) { setValidationMsg('Selecione a necessidade/dor (BANT)'); return; }
          if (!bantTiming) { setValidationMsg('Selecione o timing/urgência (BANT)'); return; }
          if (!bantObs.trim()) { setValidationMsg('Preencha o desafio, dor e observações (BANT)'); return; }
        }
      }
      if (statusChamada === 'Não atendeu' && !motivoNaoAtendeu) { setValidationMsg('Selecione o motivo'); return; }
      if (statusChamada === 'Não atendeu' && agendarRetorno && !dataRetorno) { setValidationMsg('Preencha a data e hora do retorno'); return; }
    }

    if (tipo === 'reuniao') {
      if (!statusReuniao) { setValidationMsg('Selecione se compareceu ou não'); return; }
      if (statusReuniao === 'Compareceu') {
        if (!resultado) { setValidationMsg('Selecione o resultado da reunião'); return; }
        if (!valorContrato) { setValidationMsg('Preencha o valor do contrato'); return; }
        if (!valorCc) { setValidationMsg('Preencha o valor do cash collect'); return; }
        if (!prazoMeses) { setValidationMsg('Preencha o prazo em meses'); return; }
        if (!resumo.trim()) { setValidationMsg('Preencha o resumo da reunião'); return; }
      }
      if (resultado === 'Venda') {
        if (!programaApresentadoNAF) { setValidationMsg('Selecione o programa'); return; }
        if (!razaoSocial.trim()) { setValidationMsg('Preencha a razão social'); return; }
        if (!cpfCnpj.trim()) { setValidationMsg('Preencha o CPF/CNPJ'); return; }
        if (!endereco.trim()) { setValidationMsg('Preencha o endereço'); return; }
        if (!emailContato.trim()) { setValidationMsg('Preencha o email de contato'); return; }
        if (!telefoneContato.trim()) { setValidationMsg('Preencha o telefone de contato'); return; }
        if (!nomeResponsavel.trim()) { setValidationMsg('Preencha o nome do responsável'); return; }
        if (!formaPagamento) { setValidationMsg('Selecione a forma de pagamento'); return; }
        if (!dataPrimeiroVencimento) { setValidationMsg('Preencha a data do 1º vencimento'); return; }
        if (!tempoContrato) { setValidationMsg('Selecione o tempo de contrato'); return; }
      }
      if (resultado === 'Perdido' && !motivoPerda.trim()) { setErroMotivo(true); return; }
      if ((resultado === 'Marcou R2+' || resultado === 'Reagendou') && !proximaReuniao) { setValidationMsg('Preencha a data da próxima reunião'); return; }
      if (statusReuniao === 'Não compareceu' && reagendarNoShow && !dataReagendamento) { setValidationMsg('Preencha a data do reagendamento'); return; }
    }

    if (tipo !== 'reuniao' && !(tipo === 'ligacao' && agendou) && !descricao.trim()) { setValidationMsg('Preencha as observações sobre a atividade'); return; }

    setSaving(true);
    // Clear resultado when lead didn't show up
    if (tipo === 'reuniao' && statusReuniao === 'Não compareceu') setResultado('');
    const now = new Date().toISOString();

    // Upload image if selected (completely optional — never blocks save)
    let uploadedImageUrl: string | null = null;
    if (imageFile) {
      try {
        const ext = imageFile.name.split('.').pop() ?? 'png';
        const path = `${leadId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('comercial-prints').upload(path, imageFile);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('comercial-prints').getPublicUrl(path);
          uploadedImageUrl = urlData.publicUrl;
        } else {
          console.warn('[upload] Image upload failed, continuing without image:', upErr);
        }
      } catch (uploadErr) {
        console.warn('[upload] Image upload exception, continuing without image:', uploadErr);
      }
    }

    // Build descricao — embed extras as JSON
    let finalDescricao: string | null = descricao || null;
    if (tipo === 'ligacao') {
      const extras: Record<string, string> = {};
      if (resumoLigacao) extras.resumo_ligacao = resumoLigacao;
      if (motivoNaoAtendeu) extras.motivo_nao_atendeu = motivoNaoAtendeu;
      if (agendou && bantDataHora) {
        extras.data_agendamento = bantDataHora;
        extras.closer = bantCloser;
        extras.tipo_reuniao = bantTipo;
      }
      if (Object.keys(extras).length > 0) {
        finalDescricao = JSON.stringify({ obs: descricao || '', ...extras });
      }
    } else if (tipo === 'reuniao') {
      const extras: Record<string, string> = {};
      if (resumo) extras.resumo = resumo;
      if (razaoSocial) extras.razao_social = razaoSocial;
      if (tipoPessoa) extras.tipo_pessoa = tipoPessoa;
      if (cpfCnpj) extras.cpf_cnpj = cpfCnpj;
      if (endereco) extras.endereco_completo = endereco;
      if (emailContato) extras.email_contato = emailContato;
      if (telefoneContato) extras.telefone_contato = telefoneContato;
      if (nomeResponsavel) extras.nome_responsavel = nomeResponsavel;
      if (formaPagamento) extras.forma_pagamento = formaPagamento;
      if (dataPrimeiroVencimento) extras.data_primeiro_vencimento = dataPrimeiroVencimento;
      if (motivoPerda) extras.motivo_perda = motivoPerda;
      if (proximaReuniao) extras.proxima_reuniao = proximaReuniao;
      if (Object.keys(extras).length > 0) {
        finalDescricao = JSON.stringify({ obs: descricao || '', ...extras });
      }
    }

    const ativ: any = {
      lead_id: leadId,
      tipo,
      data_atividade: now,
      realizado_por: responsavelAtividade || userSession?.name || '',
      descricao: finalDescricao,
      status_chamada: tipo === 'ligacao' ? statusChamada : null,
      agendou: tipo === 'ligacao' ? agendou : null,
      touchpoint: tipo === 'ligacao' && touchpoint ? parseInt(touchpoint) : null,
      status_reuniao: tipo === 'reuniao' ? statusReuniao : null,
      resultado: tipo === 'reuniao' ? resultado || null : null,
      imagem_url: uploadedImageUrl,
      created_at: now,
    };
    console.log('[crm_atividades] Inserting:', JSON.stringify(ativ, null, 2));
    const { data, error } = await supabase.from('crm_atividades').insert(ativ).select().single();
    if (error) { console.error('[crm_atividades] Insert failed:', error); setSaving(false); return; }

    // Side-effects based on tipo/resultado (fire-and-forget)
    if (tipo === 'ligacao') {
      // Auto-create task + move to rm_marcada + send BANT webhook when agendou
      if (agendou && bantDataHora && bantCloser) {
        // Send BANT payload to webhook
        try {
          const bantPayload = {
            lead_nome: leadName,
            lead_telefone: leadObj?.telefone ?? '',
            lead_externo_id: leadObj?.lead_externo_id ?? leadId,
            closer: bantCloser,
            tipo_reuniao: bantTipo,
            data_hora: new Date(bantDataHora).toISOString(),
            duracao_min: parseInt(bantDuracao) || 60,
            bant: {
              faturamento: bantFaturamento,
              budget: bantBudget,
              momento: bantMomento,
              captacao: bantCaptacao,
              autoridade: bantAutoridade,
              necessidade: bantNecessidade,
              timing: bantTiming,
              sdr: bantSdr,
              observacoes: bantObs,
            },
          };
          const webhookBase = import.meta.env.VITE_WEBHOOK_BASE?.replace('/webhook/dashboard', '') ?? 'https://webhook.m2black.com';
          console.log('[BANT webhook] lead_externo_id:', leadObj?.lead_externo_id, 'lead.id:', leadId);
          const bantResp = await fetch(`${webhookBase}/webhook/agendar-reuniao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bantPayload),
          }).catch(e => { console.warn('Webhook agendar-reuniao (CORS em dev):', e.message); return null; });
          // Fire-and-forget: agendar touchpoints
          try {
            let meetLink = '';
            try { if (bantResp?.ok) { const rj = await bantResp.json(); meetLink = rj.meet_link ?? ''; } } catch { /* no json */ }
            fetch(`${webhookBase}/webhook/agendar-touchpoints`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lead_id: leadObj?.lead_externo_id ?? leadId,
                lead_nome: leadName,
                lead_telefone: leadObj?.telefone ?? '',
                data_hora: new Date(bantDataHora).toISOString(),
                meet_link: meetLink,
              }),
            }).catch(() => {});
          } catch { /* silent */ }
        } catch (err) {
          console.error('Failed to send BANT webhook:', err);
        }

        // INSERT reunião na tabela reunioes (Bloco 1 — agendar R1)
        {
          const tpAtual_bant = (leadObj as any)?.tp_atual || 'R1';
          const horaBANT = new Date(bantDataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' });
          syncPostgres(leadObj?.lead_externo_id, {
            reuniao_action: 'agendar',
            crm_lead_id: leadId,
            reuniao_tp: tpAtual_bant,
            Data_Reuniao_Marcada: new Date(bantDataHora).toISOString().split('T')[0],
            hora_marcada: horaBANT,
            etapa: 'rm_marcada',
            closer: bantCloser || null,
          });
        }

        // Create scheduled task
        try {
          const { data: newTask } = await supabase.from('crm_tarefas').insert({
            lead_id: leadId,
            titulo: `Reunião ${bantTipo} - ${leadName}`,
            tipo: 'reuniao',
            data_agendada: localDatetimeToISO(bantDataHora),
            responsavel: bantCloser,
            concluida: false,
            created_at: now,
          }).select().single();
          if (newTask) onTarefaCreated?.(newTask);
        } catch (err) {
          console.error('Failed to create scheduled meeting task:', err);
        }
        // Move lead to rm_marcada + update closer as responsavel
        try {
          const leadUpd: any = {
            etapa: 'rm_marcada',
            etapa_desde: now,
            proxima_reuniao: localDatetimeToISO(bantDataHora),
            faturamento: bantFaturamento || undefined,
            responsavel: bantCloser,
            tp_atual: 'R1',
            updated_at: now,
          };
          await supabase.from('crm_leads').update(leadUpd).eq('id', leadId);
          onLeadUpdated?.(leadUpd);
        } catch (err) {
          console.error('Failed to update lead to rm_marcada:', err);
        }
      }

      // Bloco 1: Criar tarefa de retorno quando não atendeu + agendarRetorno
      if (statusChamada === 'Não atendeu' && agendarRetorno && dataRetorno) {
        try {
          const { data: retornoTask } = await supabase.from('crm_tarefas').insert({
            lead_id: leadId,
            titulo: `Retorno ligação - ${leadName}`,
            tipo: 'ligacao',
            data_agendada: localDatetimeToISO(dataRetorno),
            responsavel: responsavelAtividade || userSession?.name || '',
            concluida: false,
            created_at: now,
          }).select().single();
          if (retornoTask) onTarefaCreated?.(retornoTask);
        } catch (err) { console.error('Failed to create return task:', err); }
      }
    } else if (tipo === 'reuniao') {
      // TP sempre do card (crm_leads) — nunca de crm_tarefas
      const resolvedTP = (leadObj as any)?.tp_atual || 'R1';

      try {
        if (resultado === 'Venda') {
          const vendaPrograma = programaApresentadoNAF || leadObj?.programa_apresentado || null;
          const vendaContrato = valorContrato ? parseFloat(valorContrato) : null;
          const vendaCc = valorCc ? parseFloat(valorCc) : null;
          const vendaMrr = prazoMeses && valorContrato ? parseFloat(valorContrato) / parseInt(prazoMeses) : null;
          await supabase.from('crm_leads').update({
            etapa: 'fechado', status: 'ganho',
            programa_apresentado: vendaPrograma,
            valor_contrato: vendaContrato,
            valor_cc: vendaCc,
            valor_mrr: vendaMrr,
            updated_at: now, etapa_desde: now,
          }).eq('id', leadId);
          onLeadUpdated?.({ etapa: 'fechado', status: 'ganho', programa_apresentado: vendaPrograma ?? undefined, valor_contrato: vendaContrato ?? undefined, valor_cc: vendaCc ?? undefined, valor_mrr: vendaMrr ?? undefined } as Partial<CRMLead>);

          // Auto-create client
          try {
            const parsedContrato = valorContrato ? parseFloat(valorContrato) : 0;
            const parsedMrr = prazoMeses && valorContrato ? parseFloat(valorContrato) / parseInt(prazoMeses) : 0;
            const dur = parseInt(tempoContrato) || (parsedMrr ? Math.round(parsedContrato / parsedMrr) : 12);
            const entryDate = new Date().toISOString().split('T')[0];
            const clienteData = {
              id: Date.now().toString(),
              name: razaoSocial || leadName,
              responsible: nomeResponsavel || (leadObj as any)?.nome_responsavel_financeiro || responsavelAtividade || (leadObj?.responsavel ?? ''),
              plan: vendaPrograma || 'Pro',
              status: 'Ativo',
              entry_date: entryDate,
              exit_date: '',
              contract_duration: dur,
              docs: { access: '', transcription: '' },
              tags: [],
              platforms: [],
              funnels: [],
              onboarding_checklist: DEFAULT_ONBOARDING_ITEMS.map((label, i) => ({
                id: `ob-${i}-${Date.now()}`,
                label,
                completed: false,
              })),
              monthly_meetings: [],
              comments: [],
              offers: [],
              situation: '',
              razao_social: razaoSocial || '',
              tipo_pessoa: tipoPessoa || '',
              cpf_cnpj: cpfCnpj || '',
              endereco: endereco || '',
              email_contato: emailContato || '',
              telefone_contato: telefoneContato || '',
              nome_responsavel_financeiro: nomeResponsavel || '',
              valor_contrato: parsedContrato,
              valor_cc: valorCc ? parseFloat(valorCc) : 0,
              valor_mrr: parsedMrr,
              forma_pagamento: formaPagamento || '',
              data_primeiro_vencimento: dataPrimeiroVencimento || '',
            };
            console.log('[clients] Inserting:', JSON.stringify(clienteData, null, 2));
            const { error: clientErr } = await supabase.from('clients').insert(clienteData);
            if (clientErr) {
              console.error('[clients] Insert error:', JSON.stringify(clientErr));
            } else {
              onClientCreated?.();
            }
          } catch (err) { console.error('Failed to create client:', err); }


        } else if (resultado === 'Perdido') {
          await supabase.from('crm_leads').update({
            etapa: 'perdido', status: 'perdido',
            motivo_perda: motivoPerda || null,
            updated_at: now, etapa_desde: now,
          }).eq('id', leadId);
          onLeadUpdated?.({ etapa: 'perdido', status: 'perdido' });
        } else if (resultado === 'Marcou R2+' || resultado === 'Reagendou') {
          // Bloco 3: Atualizar lead para rm_realizada com tp_atual
          const tpMap_upd: Record<string, string> = {'R1': 'R2', 'R2': 'R3', 'R3': 'R4+'};
          const nextTP_upd = resultado === 'Marcou R2+' ? (tpMap_upd[resolvedTP] || 'R4+') : resolvedTP;
          const leadUpdR2: Partial<CRMLead> = {
            etapa: 'rm_realizada',
            etapa_desde: now,
            proxima_reuniao: proximaReuniao ? localDatetimeToISO(proximaReuniao) : undefined,
            programa_apresentado: programaApresentadoNAF || leadObj?.programa_apresentado || undefined,
            valor_contrato: valorContrato ? parseFloat(valorContrato) : undefined,
            valor_cc: valorCc ? parseFloat(valorCc) : undefined,
            updated_at: now,
          };
          (leadUpdR2 as any).tp_atual = nextTP_upd;
          await supabase.from('crm_leads').update(leadUpdR2).eq('id', leadId);
          onLeadUpdated?.(leadUpdR2);
        } else if (statusReuniao === 'Compareceu') {
          // Other results (Pendente, etc): move to rm_realizada
          await supabase.from('crm_leads').update({
            etapa: 'rm_realizada', etapa_desde: now, updated_at: now,
          }).eq('id', leadId);
          onLeadUpdated?.({ etapa: 'rm_realizada' });
        }
      } catch (err) {
        console.error('Failed to update lead after reunião:', err);
      }

      // Auto-create task for R2+ / Reagendou
      if ((resultado === 'Marcou R2+' || resultado === 'Reagendou') && proximaReuniao) {
        // Compute TP for webhook and syncPostgres (using resolvedTP)
        const tpMap_naf: Record<string, string> = {'R1': 'R2', 'R2': 'R3', 'R3': 'R4+'};
        const nextTP_naf = tpMap_naf[resolvedTP] || 'R4+';
        const reagendaTP_naf = resolvedTP;
        const webhookTipoReuniao_naf = resultado === 'Reagendou' ? reagendaTP_naf : nextTP_naf;

        try {
          const taskTP = resultado === 'Marcou R2+' ? nextTP_naf : reagendaTP_naf;
          const { data: r2Task } = await supabase.from('crm_tarefas').insert({
            lead_id: leadId,
            titulo: `${taskTP} - ${leadName}`,
            tipo: 'reuniao',
            data_agendada: localDatetimeToISO(proximaReuniao),
            responsavel: responsavelAtividade || (userSession?.name ?? ''),
            concluida: false,
            created_at: now,
          }).select().single();
          if (r2Task) onTarefaCreated?.(r2Task);
        } catch (err) {
          console.error('Failed to create R2+ task:', err);
        }

        // Send agendar-reuniao webhook for R2+ / Reagendou (Google Calendar + WhatsApp)
        try {
          const rrResp_naf = await fetch(`${WEBHOOK_BASE}/webhook/agendar-reuniao`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lead_nome: leadName,
              lead_telefone: leadObj?.telefone ?? '',
              lead_externo_id: leadObj?.lead_externo_id ?? leadId,
              closer: responsavelAtividade || leadObj?.responsavel || '',
              data_hora: new Date(proximaReuniao).toISOString(),
              tipo_reuniao: webhookTipoReuniao_naf,
              duracao_min: 60,
              bant: { sdr: (leadObj as any)?.sdr || leadObj?.responsavel || '' },
              reagendamento: resultado === 'Reagendou',
            }),
          }).catch(e => { console.warn('[agendar-reuniao R2+ NAF]', e.message); return null; });
          // Fire-and-forget: agendar touchpoints
          try {
            let meetLink_naf = '';
            try { if (rrResp_naf?.ok) { const rj = await rrResp_naf.json(); meetLink_naf = rj.meet_link ?? ''; } } catch { /* no json */ }
            fetch(`${WEBHOOK_BASE}/webhook/agendar-touchpoints`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lead_id: leadObj?.lead_externo_id ?? leadId,
                lead_nome: leadName,
                lead_telefone: leadObj?.telefone ?? '',
                data_hora: new Date(proximaReuniao).toISOString(),
                meet_link: meetLink_naf,
              }),
            }).catch(() => {});
          } catch { /* silent */ }
        } catch (err) { console.error('Failed to send agendar-reuniao webhook (NAF):', err); }
      }

      // Sync Postgres → Railway via n8n (fire-and-forget)
      {
        const hoje = new Date().toISOString().split('T')[0];
        const closer = responsavelAtividade || leadObj?.responsavel || null;
        const currentTP = resolvedTP;

        if (statusReuniao === 'Não compareceu') {
          // Cancelar touchpoints pendentes
          fetch(`${WEBHOOK_BASE}/webhook/cancelar-touchpoints`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead_id: leadObj?.lead_externo_id ?? leadId }),
          }).catch(() => {});

          if (reagendarNoShow && dataReagendamento) {
            // Bloco 6 + reagendamento: UPDATE No-show + INSERT nova Pendente (atômico)
            const horaReag = new Date(dataReagendamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: SP_TZ });
            syncPostgres(leadObj?.lead_externo_id, {
              reuniao_action: 'resultado_e_reagendar',
              crm_lead_id: leadId,
              reuniao_tp: currentTP,
              reuniao_status: 'Reagendou',
              reuniao_resultado: 'No-show',
              closer,
              nova_data_marcada: new Date(dataReagendamento).toISOString().split('T')[0],
              nova_hora_marcada: horaReag,
              novo_tp: currentTP,
            });
            // Calendar + WhatsApp
            fetch(`${WEBHOOK_BASE}/webhook/agendar-reuniao`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lead_nome: leadName,
                lead_telefone: leadObj?.telefone ?? '',
                lead_externo_id: leadObj?.lead_externo_id ?? leadId,
                closer: responsavelAtividade || leadObj?.responsavel || '',
                data_hora: new Date(dataReagendamento).toISOString(),
                tipo_reuniao: currentTP,
                duracao_min: 60,
                bant: { sdr: (leadObj as any)?.sdr || leadObj?.responsavel || '' },
              }),
            }).catch(e => console.warn('[reagendar no-show]', e.message));
            // Criar tarefa de lembrete
            try {
              const { data: nsTask } = await supabase.from('crm_tarefas').insert({
                lead_id: leadId, titulo: `${currentTP} - ${leadName}`, tipo: 'reuniao',
                data_agendada: localDatetimeToISO(dataReagendamento),
                responsavel: responsavelAtividade || userSession?.name || '',
                concluida: false, created_at: now,
              }).select().single();
              if (nsTask) onTarefaCreated?.(nsTask);
            } catch { /* silent */ }
            // Atualizar crm_leads
            try {
              await supabase.from('crm_leads').update({
                etapa: 'rm_marcada', proxima_reuniao: localDatetimeToISO(dataReagendamento), updated_at: now,
              }).eq('id', leadId);
              onLeadUpdated?.({ etapa: 'rm_marcada' });
            } catch { /* silent */ }
          } else {
            // Sem reagendamento: apenas No-show
            syncPostgres(leadObj?.lead_externo_id, {
              reuniao_action: 'resultado',
              crm_lead_id: leadId,
              reuniao_tp: currentTP,
              reuniao_status: 'No-show',
              reuniao_resultado: 'No-show',
              closer,
            });
            // Mover para rm_realizada
            try {
              await supabase.from('crm_leads').update({ etapa: 'rm_realizada', etapa_desde: now, updated_at: now }).eq('id', leadId);
              onLeadUpdated?.({ etapa: 'rm_realizada' });
            } catch { /* silent */ }
          }
        } else if (statusReuniao === 'Compareceu') {
          if (resultado === 'Marcou R2+') {
            // Bloco 2: UPDATE reunião atual → Compareceu + INSERT R2
            const tpMap_sync: Record<string, string> = {'R1': 'R2', 'R2': 'R3', 'R3': 'R4+'};
            const nextTP = tpMap_sync[currentTP] || 'R4+';
            syncPostgres(leadObj?.lead_externo_id, {
              reuniao_action: 'resultado',
              crm_lead_id: leadId,
              reuniao_tp: currentTP,
              reuniao_status: 'Compareceu',
              reuniao_resultado: 'Marcou R2+',
              Data_Reuniao_Realizada: hoje,
              Data_TP: proximaReuniao ? new Date(proximaReuniao).toISOString().split('T')[0] : hoje,
              TP: nextTP,
              programa: programaApresentadoNAF || leadObj?.programa_apresentado || null,
              rs_contrato: valorContrato || null,
              rs_cc: valorCc || null,
              closer,
            });
            if (proximaReuniao) {
              const horaR2 = new Date(proximaReuniao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: SP_TZ });
              syncPostgres(leadObj?.lead_externo_id, {
                reuniao_action: 'agendar',
                crm_lead_id: leadId,
                reuniao_tp: nextTP,
                Data_Reuniao_Marcada: new Date(proximaReuniao).toISOString().split('T')[0],
                hora_marcada: horaR2,
                closer,
              });
            }
          } else if (resultado === 'Reagendou') {
            // Bloco 7: UPDATE Reagendou + INSERT mesma TP (atômico)
            if (proximaReuniao) {
              const horaReag = new Date(proximaReuniao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: SP_TZ });
              syncPostgres(leadObj?.lead_externo_id, {
                reuniao_action: 'resultado_e_reagendar',
                crm_lead_id: leadId,
                reuniao_tp: currentTP,
                reuniao_status: 'Reagendou',
                reuniao_resultado: 'Reagendou',
                closer,
                nova_data_marcada: new Date(proximaReuniao).toISOString().split('T')[0],
                nova_hora_marcada: horaReag,
                novo_tp: currentTP,
              });
            }
          } else if (resultado === 'Venda') {
            // Bloco 3: UPDATE reunião → Venda
            syncPostgres(leadObj?.lead_externo_id, {
              reuniao_action: 'resultado',
              crm_lead_id: leadId,
              reuniao_tp: currentTP,
              reuniao_status: 'Venda',
              reuniao_resultado: 'Venda',
              status: 'ganho', etapa: 'fechado',
              Data_Venda: hoje, Data_Reuniao_Realizada: hoje,
              programa: programaApresentadoNAF || leadObj?.programa_apresentado || null,
              rs_contrato: valorContrato || null, rs_cc: valorCc || null,
              Etapa_Fechamento: currentTP, closer,
            });
          } else if (resultado === 'Perdido') {
            // Bloco 4: UPDATE reunião → Perdido
            syncPostgres(leadObj?.lead_externo_id, {
              reuniao_action: 'resultado',
              crm_lead_id: leadId,
              reuniao_tp: currentTP,
              reuniao_status: 'Perdido',
              reuniao_resultado: 'Perdido',
              status: 'perdido',
              Data_Reuniao_Realizada: hoje,
              closer,
            });
          } else {
            // Bloco 5: UPDATE reunião → Pendente
            syncPostgres(leadObj?.lead_externo_id, {
              reuniao_action: 'resultado',
              crm_lead_id: leadId,
              reuniao_tp: currentTP,
              reuniao_status: 'Compareceu',
              reuniao_resultado: 'Pendente',
              Data_Reuniao_Realizada: hoje,
              closer,
            });
          }
        }
      }

      // Add No-show tag when lead didn't show up
      if (statusReuniao === 'Não compareceu') {
        try {
          const tagsAtuais: string[] = leadObj?.tags ?? [];
          if (!tagsAtuais.includes('No-show')) {
            await supabase.from('crm_leads').update({ tags: [...tagsAtuais, 'No-show'] }).eq('id', leadId);
            onLeadUpdated?.({ tags: [...tagsAtuais, 'No-show'] });
          }
        } catch { /* silent */ }
      }

      // Bloco 6: Auto-concluir tarefa pendente do lead (match por tipo)
      try {
        const { data: tarefasPendentes } = await supabase
          .from('crm_tarefas')
          .select('id, titulo, tipo')
          .eq('lead_id', leadId)
          .eq('concluida', false)
          .order('data_agendada', { ascending: false })
          .limit(5);
        if (tarefasPendentes && tarefasPendentes.length > 0) {
          const tipoMatch = tipo === 'ligacao' ? 'ligacao' : 'reuniao';
          const tarefa = tarefasPendentes.find(t => t.tipo === tipoMatch)
            || tarefasPendentes.find(t => /reuni|R\d|ligac/i.test(t.titulo || ''))
            || null;
          if (tarefa) {
            await supabase.from('crm_tarefas').update({ concluida: true }).eq('id', tarefa.id);
          }
        }
      } catch (e) { console.warn('[auto-concluir tarefa NAF]', e); }
    }

    // Mirror to comercial_tasks (fire-and-forget)
    try {
      const taskData = {
        id: crypto.randomUUID(),
        type: tipo === 'ligacao' ? 'PreVendas' : 'Vendas',
        category: tipo === 'ligacao' ? 'Ligação' : 'Reunião',
        collaborator: responsavelAtividade || leadObj?.responsavel || userSession?.name || '',
        answered: tipo === 'ligacao' ? statusChamada : null,
        touchpoint: tipo === 'ligacao' && touchpoint ? parseInt(touchpoint) : null,
        scheduled: tipo === 'ligacao' ? agendou : false,
        meeting_status: tipo === 'reuniao' ? statusReuniao : null,
        sale_status: tipo === 'reuniao' ? resultado || null : null,
        contract_value: tipo === 'reuniao' && valorContrato ? parseFloat(valorContrato) : null,
        cash_collect: tipo === 'reuniao' && valorCc ? parseFloat(valorCc) : null,
        next_meeting_date: tipo === 'reuniao' && proximaReuniao ? localDatetimeToISO(proximaReuniao) : (tipo === 'ligacao' && agendou && bantDataHora ? localDatetimeToISO(bantDataHora) : null),
        loss_reason: tipo === 'reuniao' && motivoPerda ? motivoPerda : (tipo === 'ligacao' && statusChamada === 'Não atendeu' && motivoNaoAtendeu ? motivoNaoAtendeu : null),
        company_name: tipo === 'reuniao' && razaoSocial ? razaoSocial : null,
        responsible_name: tipo === 'reuniao' && nomeResponsavel ? nomeResponsavel : null,
        completion_time: new Date().toLocaleString('pt-BR', { timeZone: SP_TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        image_url: uploadedImageUrl || '',
        created_at: new Date().toISOString(),
      };
      console.log('[comercial_tasks] Inserting:', JSON.stringify(taskData, null, 2));
      const { error: taskError } = await supabase.from('comercial_tasks').insert(taskData);
      if (taskError) {
        console.log('[comercial_tasks] Error detail:', JSON.stringify(taskError));
      }
    } catch (err) {
      console.error('Failed to mirror to comercial_tasks:', err);
    }

    // Create task if scheduled (manual)
    if (tituloTarefa.trim()) {
      const { data: manualTask } = await supabase.from('crm_tarefas').insert({
        lead_id: leadId,
        titulo: tituloTarefa,
        data_agendada: dataAgendada ? localDatetimeToISO(dataAgendada) : null,
        responsavel: userSession?.name ?? '',
        concluida: false,
        created_at: now,
      }).select().single();
      if (manualTask) onTarefaCreated?.(manualTask);
    }
    setSaving(false);
    onSaved(data);
  };

  return (
    <div className="bg-white/5 rounded-xl p-4 space-y-4 border border-white/10">
      {/* Tipo */}
      <div className="flex gap-2">
        {(['ligacao', 'reuniao'] as const).map(t => (
          <button key={t} onClick={() => handleSelectTipo(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tipo === t ? 'bg-brand-primary text-black' : 'bg-white/5 text-gray-400 hover:text-white'}`}
          >
            {t === 'ligacao' ? '📞 Ligação' : '🤝 Reunião'}
          </button>
        ))}
      </div>

      {tipo === null && (
        <div className="flex items-center justify-center h-16 text-gray-600 text-xs">
          Selecione o tipo de atividade acima
        </div>
      )}

      {tipo !== null && <>
      {/* Responsável pela atividade */}
      <div>
        <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Responsável pela atividade <span className="text-red-400">*</span></label>
        <select value={responsavelAtividade} onChange={e => setResponsavelAtividade(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
        >
          <option value="" className="bg-bg-main">Selecionar...</option>
          {teamMembers.filter(m => ['admin','comercial'].includes((m.role ?? '').toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
            .map(m => <option key={m.id} value={m.name} className="bg-bg-main">{m.name}</option>)}
        </select>
      </div>

      {tipo === 'ligacao' && (
        <>
          <div className="flex gap-2">
            {(['Atendeu', 'Não atendeu'] as const).map(s => (
              <button key={s} onClick={() => setStatusChamada(s)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${statusChamada === s ? (s === 'Atendeu' ? 'bg-brand-primary/20 border-brand-primary text-brand-primary' : 'bg-red-900/30 border-red-500 text-red-400') : 'bg-white/5 border-white/10 text-gray-500'}`}
              >{s}</button>
            ))}
          </div>
          {statusChamada && (
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Touchpoint <span className="text-red-400">*</span></label>
              <input type="number" value={touchpoint} onChange={e => setTouchpoint(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                placeholder="Nº da tentativa"
              />
            </div>
          )}
          {statusChamada === 'Atendeu' && (
            <>
              {/* Botão Agendar Reunião */}
              <button onClick={() => setAgendou(!agendou)} type="button"
                className={`w-full py-2 rounded-xl border border-dashed text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${agendou ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'border-yellow-500/30 text-gray-500 hover:text-yellow-400 hover:border-yellow-500/50'}`}
              >
                <Calendar size={13} /> {agendou ? '✓ Reunião sendo agendada' : 'Agendar Reunião'}
              </button>

              {/* Campos BANT de agendamento */}
              {agendou && (
                <div className="space-y-3 bg-white/[0.02] border border-yellow-500/20 rounded-xl p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Tipo</label>
                      <select value={bantTipo} onChange={e => setBantTipo(e.target.value as 'R1' | 'R2')}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 appearance-none"
                      >
                        <option value="R1" className="bg-bg-main">R1</option>
                        <option value="R2" className="bg-bg-main">R2</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Duração (min)</label>
                      <input value={bantDuracao} onChange={e => setBantDuracao(e.target.value)} type="number"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Data e hora <span className="text-red-400">*</span></label>
                    <SlotPicker selectedDate={bantSlotDate} onSelectDate={setBantSlotDate} selectedHour={bantSlotHour} onSelectHour={setBantSlotHour} tpAtual={(leadObj as any)?.tp_atual || 'R1'} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Closer responsável <span className="text-red-400">*</span></label>
                      <select value={bantCloser} onChange={e => setBantCloser(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 appearance-none"
                      >
                        <option value="" className="bg-bg-main">Selecionar...</option>
                        {teamMembers.filter(m => ['admin','comercial'].includes((m.role ?? '').toLowerCase()))
                          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                          .map(m => <option key={m.id} value={m.name} className="bg-bg-main">{m.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">SDR responsável <span className="text-red-400">*</span></label>
                      <select value={bantSdr} onChange={e => setBantSdr(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 appearance-none"
                      >
                        <option value="" className="bg-bg-main">Selecionar...</option>
                        {teamMembers.filter(m => ['admin','comercial'].includes((m.role ?? '').toLowerCase()))
                          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                          .map(m => <option key={m.id} value={m.name} className="bg-bg-main">{m.name}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Divisor BANT */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600">BANT</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Faturamento (R$)</label>
                      <input value={bantFaturamento} onChange={e => setBantFaturamento(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500"
                        placeholder="Ex: 100.000"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Budget líquido (R$)</label>
                      <input value={bantBudget} onChange={e => setBantBudget(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500"
                        placeholder="Ex: 5.000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Momento do negócio</label>
                    <select value={bantMomento} onChange={e => setBantMomento(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 appearance-none"
                    >
                      <option value="" className="bg-bg-main">Selecionar...</option>
                      <option value="Comecei agora e preciso de estrutura no digital" className="bg-bg-main">Comecei agora e preciso de estrutura no digital</option>
                      <option value="Já contratei agência, mas não tive resultado" className="bg-bg-main">Já contratei agência, mas não tive resultado</option>
                      <option value="Já vendo por indicação, mas quero escalar via internet" className="bg-bg-main">Já vendo por indicação, mas quero escalar via internet</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Como capta clientes hoje</label>
                    <select value={bantCaptacao} onChange={e => setBantCaptacao(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 appearance-none"
                    >
                      <option value="" className="bg-bg-main">Selecionar...</option>
                      <option value="Indicação" className="bg-bg-main">Indicação</option>
                      <option value="Tráfego Pago" className="bg-bg-main">Tráfego Pago</option>
                      <option value="Ainda não tenho clientes" className="bg-bg-main">Ainda não tenho clientes</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Autoridade (Decisores)</label>
                    <select value={bantAutoridade} onChange={e => setBantAutoridade(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 appearance-none"
                    >
                      <option value="" className="bg-bg-main">Selecionar...</option>
                      <option value="Nenhum decisor envolvido / lead terceirizado" className="bg-bg-main">Nenhum decisor envolvido / lead terceirizado</option>
                      <option value="Tem influência, mas depende do sócio ou gestor" className="bg-bg-main">Tem influência, mas depende do sócio ou gestor</option>
                      <option value="Decisor principal e sócio confirmado para a reunião" className="bg-bg-main">Decisor principal e sócio confirmado para a reunião</option>
                      <option value="É o único decisor e demonstra autoridade total" className="bg-bg-main">É o único decisor e demonstra autoridade total</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Necessidade / Dor</label>
                    <select value={bantNecessidade} onChange={e => setBantNecessidade(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 appearance-none"
                    >
                      <option value="" className="bg-bg-main">Selecionar...</option>
                      <option value="Quer melhorar marketing, mas sem dor clara" className="bg-bg-main">Quer melhorar marketing, mas sem dor clara</option>
                      <option value="Reconhece que falta previsibilidade, mas ainda sem urgência" className="bg-bg-main">Reconhece que falta previsibilidade, mas ainda sem urgência</option>
                      <option value="Sofre com falta de leads ou estrutura comercial e quer resolver" className="bg-bg-main">Sofre com falta de leads ou estrutura comercial e quer resolver</option>
                      <option value="Está com prejuízo, sem previsibilidade e quer agir agora" className="bg-bg-main">Está com prejuízo, sem previsibilidade e quer agir agora</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Timing / Urgência</label>
                    <select value={bantTiming} onChange={e => setBantTiming(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 appearance-none"
                    >
                      <option value="" className="bg-bg-main">Selecionar...</option>
                      <option value="Não tem previsão / talvez no futuro" className="bg-bg-main">Não tem previsão / talvez no futuro</option>
                      <option value="Pensa em agir em até 3 meses" className="bg-bg-main">Pensa em agir em até 3 meses</option>
                      <option value="Quer começar em até 30 dias" className="bg-bg-main">Quer começar em até 30 dias</option>
                      <option value="Quer iniciar imediatamente / essa semana" className="bg-bg-main">Quer iniciar imediatamente / essa semana</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Desafio, dor e observações</label>
                    <textarea value={bantObs} onChange={e => setBantObs(e.target.value)} rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 resize-none"
                      placeholder="Descreva o cenário do lead..."
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Não atendeu — motivo */}
          {statusChamada === 'Não atendeu' && (
            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Motivo</label>
                <select value={motivoNaoAtendeu} onChange={e => setMotivoNaoAtendeu(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
                >
                  <option value="" className="bg-bg-main">Selecionar...</option>
                  {['Não atendeu', 'Caixa postal', 'Número errado', 'Bloqueou', 'Outro'].map(m => <option key={m} value={m} className="bg-bg-main">{m}</option>)}
                </select>
              </div>
              {/* Bloco 1: Agendar retorno */}
              <button onClick={() => setAgendarRetorno(!agendarRetorno)} type="button"
                className={`w-full py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${agendarRetorno ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'}`}
              >
                <Calendar size={13} /> {agendarRetorno ? '✓ Retorno agendado' : 'Agendar retorno'}
              </button>
              {agendarRetorno && (
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Data e hora do retorno <span className="text-red-400">*</span></label>
                  <input type="datetime-local" value={dataRetorno} onChange={e => setDataRetorno(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-yellow-500"
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tipo === 'reuniao' && (
        <>
          <div className="flex gap-2">
            {(['Compareceu', 'Não compareceu'] as const).map(s => (
              <button key={s} onClick={() => setStatusReuniao(s)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${statusReuniao === s ? (s === 'Compareceu' ? 'bg-brand-primary/20 border-brand-primary text-brand-primary' : 'bg-red-900/30 border-red-500 text-red-400') : 'bg-white/5 border-white/10 text-gray-500'}`}
              >{s}</button>
            ))}
          </div>
          {/* Bloco 5: Não compareceu — reagendar */}
          {statusReuniao === 'Não compareceu' && (
            <div className="space-y-3 bg-red-900/10 border border-red-500/20 rounded-xl p-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-red-400">Lead não compareceu</p>
              <button onClick={() => setReagendarNoShow(!reagendarNoShow)} type="button"
                className={`w-full py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${reagendarNoShow ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'}`}
              >
                <Calendar size={13} /> {reagendarNoShow ? '✓ Reagendamento confirmado' : 'Deseja reagendar?'}
              </button>
              {reagendarNoShow && (
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Nova data e hora <span className="text-red-400">*</span></label>
                  <SlotPicker selectedDate={reagSlotDate} onSelectDate={setReagSlotDate} selectedHour={reagSlotHour} onSelectHour={setReagSlotHour} tpAtual={(leadObj as any)?.tp_atual || 'R1'} />
                </div>
              )}
            </div>
          )}

          {statusReuniao === 'Compareceu' && (
            <>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Resultado</label>
                <select value={resultado} onChange={e => setResultado(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
                >
                  <option value="" className="bg-bg-main">Selecionar...</option>
                  {['Venda', 'Marcou R2+', 'Reagendou', 'Perdido', 'Pendente'].map(r => <option key={r} value={r} className="bg-bg-main">{r}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Campos base reunião (only when Compareceu) */}
          {statusReuniao === 'Compareceu' && (<>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Contrato (R$)</label>
              <input type="number" value={valorContrato} onChange={e => setValorContrato(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary" placeholder="0"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Cash Collect (R$)</label>
              <input type="number" value={valorCc} onChange={e => setValorCc(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary" placeholder="0"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Prazo (meses)</label>
              <input type="number" value={prazoMeses} onChange={e => setPrazoMeses(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary" placeholder="0"
              />
            </div>
          </div>
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Resumo da reunião</label>
            <textarea value={resumo} onChange={e => setResumo(e.target.value)} rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-primary resize-none"
              placeholder="Resumo do que foi discutido..."
            />
          </div>

          {/* Venda — dados do cliente */}
          {resultado === 'Venda' && (
            <div className="border-t border-white/5 pt-3 space-y-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-brand-primary">Dados do Cliente</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Programa <span className="text-red-400">*</span></label>
                  <select value={programaApresentadoNAF} onChange={e => setProgramaApresentadoNAF(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
                  >
                    <option value="" className="bg-bg-main">Selecionar...</option>
                    {['Pro', 'Lite', 'Basic'].map(p => <option key={p} value={p} className="bg-bg-main">{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Tempo Contrato <span className="text-red-400">*</span></label>
                  <select value={tempoContrato} onChange={e => setTempoContrato(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
                  >
                    <option value="" className="bg-bg-main">Selecionar...</option>
                    {['1', '3', '6', '12'].map(m => <option key={m} value={m} className="bg-bg-main">{m} {m === '1' ? 'mês' : 'meses'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Data Onboarding</label>
                  <input type="datetime-local" value={dataOnboarding} onChange={e => setDataOnboarding(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Razão Social</label>
                  <input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Tipo de Pessoa</label>
                  <select value={tipoPessoa} onChange={e => setTipoPessoa(e.target.value as 'PF' | 'PJ')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
                  >
                    <option value="PJ" className="bg-bg-main">Pessoa Jurídica (CNPJ)</option>
                    <option value="PF" className="bg-bg-main">Pessoa Física (CPF)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">CPF / CNPJ</label>
                <input value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                  placeholder={tipoPessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Endereço Completo</label>
                <input value={endereco} onChange={e => setEndereco(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Email de Contato</label>
                  <input type="email" value={emailContato} onChange={e => setEmailContato(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Telefone</label>
                  <input value={telefoneContato} onChange={e => setTelefoneContato(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Nome do Responsável</label>
                <input value={nomeResponsavel} onChange={e => setNomeResponsavel(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Forma de Pagamento</label>
                  <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
                  >
                    <option value="" className="bg-bg-main">Selecionar...</option>
                    {['À vista', '2x', '3x', '6x', '12x', 'Boleto mensal', 'Cartão recorrente'].map(f => <option key={f} value={f} className="bg-bg-main">{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Data do 1º Vencimento</label>
                  <input type="date" value={dataPrimeiroVencimento} onChange={e => setDataPrimeiroVencimento(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Marcou R2+ / Reagendou — próxima reunião */}
          {(resultado === 'Marcou R2+' || resultado === 'Reagendou') && (() => {
            const curTP = (leadObj as any)?.tp_atual || 'R1';
            const tpMap: Record<string, string> = { 'R1': 'R2', 'R2': 'R3', 'R3': 'R4+' };
            const nextTP = tpMap[curTP] || 'R4+';
            return (
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Próxima Reunião</label>
                <SlotPicker selectedDate={proxSlotDate} onSelectDate={setProxSlotDate} selectedHour={proxSlotHour} onSelectHour={setProxSlotHour} tpAtual={nextTP} />
              </div>
            );
          })()}

          {/* Perdido — motivo */}
          {resultado === 'Perdido' && (
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Motivo de Perda <span className="text-red-400">*</span></label>
              <textarea value={motivoPerda} onChange={e => { setMotivoPerda(e.target.value); setErroMotivo(false); }} rows={2}
                className={`w-full bg-white/5 border rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-primary resize-none ${erroMotivo ? 'border-red-500' : 'border-white/10'}`}
                placeholder="Por que o lead foi perdido..."
              />
              {erroMotivo && <p className="text-[10px] text-red-400 mt-1">Motivo de perda obrigatório</p>}
            </div>
          )}
          </>)}
        </>
      )}

      {tipo !== 'reuniao' && !(tipo === 'ligacao' && agendou) && (
        <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2}
          placeholder="Observações sobre a atividade..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-primary resize-none"
        />
      )}

      {/* Upload de print */}
      <div>
        <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">
          Print da tela <span className="text-red-400">* (obrigatório)</span>
        </label>
        <input type="file" accept="image/*" onChange={e => { handleImageChange(e); setImageError(false); }}
          className={`w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-white/10 file:text-gray-300 hover:file:bg-white/20 file:cursor-pointer file:transition-colors ${imageError ? 'ring-1 ring-red-500 rounded-lg' : ''}`}
        />
        {imageError && <p className="text-[10px] text-red-400 mt-1">Print obrigatório para registrar atividade</p>}
        {imagePreview && (
          <div className="mt-2 relative">
            <img src={imagePreview} alt="Preview" className="w-full max-h-40 object-contain rounded-lg border border-white/10" />
            <button onClick={() => { setImageFile(null); setImagePreview(null); }}
              className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-gray-300 hover:text-white transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {validationMsg && <p className="text-[10px] text-red-400 text-center">{validationMsg}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl bg-white/5 text-xs text-gray-400 hover:text-white transition-colors">Cancelar</button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2 rounded-xl bg-brand-primary text-black text-xs font-bold hover:bg-brand-primary/80 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          Registrar
        </button>
      </div>
      </>}
    </div>
  );
}

// ── Lead Modal ────────────────────────────────────────────────
function LeadModal({ lead, onClose, onSave, onDelete, userSession, teamMembers, onClientCreated, onTarefaCreated }: {
  lead: CRMLead; onClose: () => void;
  onSave: (updated: Partial<CRMLead>) => Promise<void>;
  onDelete: (leadId: string) => void;
  userSession: any; teamMembers: TeamMember[]; onClientCreated?: () => void;
  onTarefaCreated?: (tarefa: CRMTarefa) => void;
}) {
  const isAdmin = (userSession?.role ?? '').toLowerCase() === 'admin';
  const [etapa, setEtapa] = useState(lead.etapa);
  const [responsavel, setResponsavel] = useState(lead.responsavel ?? '');
  const [observacoes, setObservacoes] = useState(lead.observacoes ?? '');
  const [faturamento, setFaturamento] = useState(lead.faturamento ?? '');
  const [area, setArea] = useState(lead.area ?? '');
  const [localTags, setLocalTags] = useState<string[]>(lead.tags ?? []);
  const [programaApresentado, setProgramaApresentado] = useState(lead.programa_apresentado ?? '');
  const [valorContrato, setValorContrato] = useState<number | ''>(lead.valor_contrato ?? '');
  const [valorCc, setValorCc] = useState<number | ''>(lead.valor_cc ?? '');
  const [valorMrr, setValorMrr] = useState<number | ''>(lead.valor_mrr ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [atividades, setAtividades] = useState<CRMAtividade[]>([]);
  const [tarefas, setTarefas] = useState<CRMTarefa[]>([]);
  const [showAtivForm, setShowAtivForm] = useState(false);
  const [ativFormTipo, setAtivFormTipo] = useState<'ligacao' | 'reuniao' | undefined>(undefined);
  const [concluindoTarefaViaAtiv, setConcluindoTarefaViaAtiv] = useState<string | null>(null);
  const [showAgendarTarefa, setShowAgendarTarefa] = useState(false);
  const [agTipo, setAgTipo] = useState<'ligacao' | 'follow-up' | 'nota' | 'outro' | null>(null);
  const [agTitulo, setAgTitulo] = useState('');
  const [agData, setAgData] = useState('');
  const [agResponsavel, setAgResponsavel] = useState('');
  const [agSaving, setAgSaving] = useState(false);
  const [tab, setTab] = useState<'info' | 'timeline' | 'tarefas'>('info');
  // ── Agendar Reunião (BANT) ──────────────────────────────────
  const [showAgendarReuniao, setShowAgendarReuniao] = useState(false);
  const [arTipo, setArTipo] = useState<'R1' | 'R2'>('R1');
  const [arDataHora, setArDataHora] = useState('');
  const tomorrowAr = React.useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }, []);
  const [arSlotDate, setArSlotDate] = useState(tomorrowAr);
  const [arSlotHour, setArSlotHour] = useState('');
  const [arDuracao, setArDuracao] = useState('60');
  const [arCloser, setArCloser] = useState('');
  const [arFaturamento, setArFaturamento] = useState(lead.faturamento ?? '');
  const [arBudget, setArBudget] = useState('');
  const [arMomento, setArMomento] = useState('');
  const [arCaptacao, setArCaptacao] = useState('');
  const [arAutoridade, setArAutoridade] = useState('');
  const [arNecessidade, setArNecessidade] = useState('');
  const [arTiming, setArTiming] = useState('');
  const [arSdr, setArSdr] = useState('');
  const [arObs, setArObs] = useState('');
  const [arSaving, setArSaving] = useState(false);
  const [arSuccess, setArSuccess] = useState(false);

  // Sync SlotPicker → arDataHora
  useEffect(() => { setArDataHora(arSlotDate && arSlotHour ? `${arSlotDate}T${arSlotHour}:00` : ''); }, [arSlotDate, arSlotHour]);

  const handleAgendarReuniao = async () => {
    console.log('[handleAgendarReuniao] lead.lead_externo_id:', lead.lead_externo_id);
    if (!arDataHora || !arCloser) return;
    setArSaving(true);
    try {
      const payload = {
        lead_nome: lead.nome,
        lead_telefone: lead.telefone ?? '',
        lead_externo_id: lead.lead_externo_id ?? lead.id,
        closer: arCloser,
        tipo_reuniao: arTipo,
        data_hora: new Date(arDataHora).toISOString(),
        duracao_min: parseInt(arDuracao) || 60,
        bant: {
          faturamento: arFaturamento,
          budget: arBudget,
          momento: arMomento,
          captacao: arCaptacao,
          autoridade: arAutoridade,
          necessidade: arNecessidade,
          timing: arTiming,
          sdr: arSdr || lead.responsavel || '',
          observacoes: arObs,
        },
      };
      const webhookBase = import.meta.env.VITE_WEBHOOK_BASE?.replace('/webhook/dashboard', '') ?? 'https://webhook.m2black.com';
      const arResp = await fetch(`${webhookBase}/webhook/agendar-reuniao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Fire-and-forget: agendar touchpoints
      try {
        let meetLink = '';
        try { if (arResp?.ok) { const rj = await arResp.json(); meetLink = rj.meet_link ?? ''; } } catch { /* no json */ }
        fetch(`${webhookBase}/webhook/agendar-touchpoints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: lead.lead_externo_id ?? lead.id,
            lead_nome: lead.nome,
            lead_telefone: lead.telefone ?? '',
            data_hora: new Date(arDataHora).toISOString(),
            meet_link: meetLink,
          }),
        }).catch(() => {});
      } catch { /* silent */ }
      // INSERT reunião na tabela reunioes
      {
        const tpAtual_ar = (lead as any).tp_atual || 'R1';
        const horaAR = new Date(arDataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' });
        syncPostgres(lead.lead_externo_id, {
          reuniao_action: 'agendar',
          crm_lead_id: lead.id,
          reuniao_tp: tpAtual_ar,
          Data_Reuniao_Marcada: new Date(arDataHora).toISOString().split('T')[0],
          hora_marcada: horaAR,
          etapa: 'rm_marcada',
          closer: arCloser || null,
        });
      }
      const upd: Partial<CRMLead> = {
        etapa: 'rm_marcada',
        proxima_reuniao: new Date(arDataHora).toISOString(),
        faturamento: arFaturamento,
        responsavel: arCloser,
        etapa_desde: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await onSave(upd);
      setEtapa('rm_marcada');
      setArSuccess(true);
      setTimeout(() => { setShowAgendarReuniao(false); setArSuccess(false); }, 2000);
    } catch (err) {
      console.error('Erro ao agendar reunião:', err);
    }
    setArSaving(false);
  };

  // Reunião Realizada section (rm_marcada)
  const [reuniaoRealizada, setReuniaoRealizada] = useState(false);
  const [rrStatusReuniao, setRrStatusReuniao] = useState<'Compareceu' | 'Não compareceu' | null>(null);
  const [rrResultado, setRrResultado] = useState('');
  const [rrValorContrato, setRrValorContrato] = useState(lead.valor_contrato ? String(lead.valor_contrato) : '');
  const [rrValorCc, setRrValorCc] = useState(lead.valor_cc ? String(lead.valor_cc) : '');
  const [rrPrazoMeses, setRrPrazoMeses] = useState('');
  const [rrResumo, setRrResumo] = useState('');
  const [rrMotivoPerda, setRrMotivoPerda] = useState('');
  const [rrProximaReuniao, setRrProximaReuniao] = useState('');
  const [rrRazaoSocial, setRrRazaoSocial] = useState('');
  const [rrTipoPessoa, setRrTipoPessoa] = useState<'PF' | 'PJ'>('PJ');
  const [rrCpfCnpj, setRrCpfCnpj] = useState('');
  const [rrEndereco, setRrEndereco] = useState('');
  const [rrEmailContato, setRrEmailContato] = useState('');
  const [rrTelefoneContato, setRrTelefoneContato] = useState('');
  const [rrNomeResponsavel, setRrNomeResponsavel] = useState('');
  const [rrFormaPagamento, setRrFormaPagamento] = useState('');
  const [rrDataPrimeiroVencimento, setRrDataPrimeiroVencimento] = useState('');
  const [rrImageFile, setRrImageFile] = useState<File | null>(null);
  const [rrImagePreview, setRrImagePreview] = useState<string | null>(null);
  const [rrImageError, setRrImageError] = useState(false);
  const [rrErroMotivo, setRrErroMotivo] = useState(false);
  const [rrSaving, setRrSaving] = useState(false);

  const rrMrr = rrValorContrato && rrPrazoMeses ? (parseFloat(rrValorContrato) / parseInt(rrPrazoMeses)) : null;

  const handleRrImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setRrImageFile(file);
    setRrImageError(false);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setRrImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setRrImagePreview(null);
    }
  };

  useEffect(() => {
    supabase.from('crm_atividades').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false })
      .then(({ data }) => setAtividades(data ?? []));
    supabase.from('crm_tarefas').select('*').eq('lead_id', lead.id).order('data_agendada', { ascending: true })
      .then(({ data }) => setTarefas(data ?? []));
  }, [lead.id]);

  const handleSave = async () => {
    setSaving(true);
    const upd: Partial<CRMLead> = {
      etapa, responsavel, observacoes, faturamento, area, tags: localTags,
      programa_apresentado: programaApresentado || null,
      valor_contrato: valorContrato !== '' ? valorContrato : null,
      valor_cc: valorCc !== '' ? valorCc : null,
      valor_mrr: valorMrr !== '' ? valorMrr : null,
      updated_at: new Date().toISOString(),
    };
    if (etapa !== lead.etapa) upd.etapa_desde = new Date().toISOString();
    await onSave(upd);

    // Sync financeiro → Railway via n8n (fire-and-forget)
    const finChanged = (valorContrato !== '' && valorContrato !== (lead.valor_contrato ?? ''))
      || (valorCc !== '' && valorCc !== (lead.valor_cc ?? ''))
      || (valorMrr !== '' && valorMrr !== (lead.valor_mrr ?? ''))
      || (programaApresentado && programaApresentado !== (lead.programa_apresentado ?? ''));
    if (lead.lead_externo_id && finChanged) {
      const infoFields: Record<string, unknown> = {};
      if (lead.proxima_reuniao) infoFields.Data_Reuniao_Marcada = lead.proxima_reuniao;
      if (programaApresentado) infoFields.programa = programaApresentado;
      if (valorContrato !== '') infoFields.rs_contrato = valorContrato;
      if (valorCc !== '') infoFields.rs_cc = valorCc;
      if (valorMrr && valorContrato) infoFields.tempo_contrato = (Number(valorContrato) / Number(valorMrr)).toFixed(0);
      if (valorMrr !== '') infoFields.mrr_adicionado = valorMrr;
      if (responsavel) infoFields.closer = responsavel;
      syncPostgres(lead.lead_externo_id, infoFields);
    }

    // Sync mudança de etapa → Railway via n8n (fire-and-forget)
    // Pular rm_marcada: o syncPostgres correto (com Data_Reuniao_Marcada) já é disparado pelo formulário de atividade
    if (lead.lead_externo_id && etapa !== lead.etapa && etapa !== 'rm_marcada') {
      syncPostgres(lead.lead_externo_id, { etapa, closer: responsavel || null });
    }

    setSaving(false);
  };

  const handleAtivSaved = async (a: CRMAtividade) => {
    setAtividades(prev => [a, ...prev]);
    if (concluindoTarefaViaAtiv) {
      await supabase.from('crm_tarefas').update({ concluida: true }).eq('id', concluindoTarefaViaAtiv);
      setTarefas(prev => prev.map(t => t.id === concluindoTarefaViaAtiv ? { ...t, concluida: true } : t));
      setConcluindoTarefaViaAtiv(null);
    }
    setShowAtivForm(false);
    setAtivFormTipo(undefined);
    setTab('timeline');
  };

  const handleLeadUpdated = (upd: Partial<CRMLead>) => {
    onSave(upd);
    if (upd.etapa) setEtapa(upd.etapa);
    if (upd.responsavel) setResponsavel(upd.responsavel);
  };

  const handleAgendarTarefa = async () => {
    setAgSaving(true);
    try {
      const now = new Date().toISOString();
      const { data } = await supabase.from('crm_tarefas').insert({
        lead_id: lead.id,
        titulo: agTitulo.trim(),
        tipo: agTipo,
        data_agendada: localDatetimeToISO(agData),
        responsavel: agResponsavel || (userSession?.name ?? ''),
        concluida: false,
        created_at: now,
      }).select().single();
      if (data) { setTarefas(prev => [...prev, data]); onTarefaCreated?.(data); }
      // Update proxima_reuniao if this task is sooner
      const agDate = parseDateSP(agData);
      if (agDate > new Date() && (!lead.proxima_reuniao || agDate < parseDateSP(lead.proxima_reuniao))) {
        await supabase.from('crm_leads').update({ proxima_reuniao: localDatetimeToISO(agData) }).eq('id', lead.id);
        onSave({ proxima_reuniao: localDatetimeToISO(agData) });
      }
      setShowAgendarTarefa(false);
      setAgTipo(null); setAgTitulo(''); setAgData(''); setAgResponsavel('');
      setTab('tarefas');
    } catch (err) { console.error('Failed to schedule task:', err); }
    setAgSaving(false);
  };

  const handleSaveReuniao = async () => {
    if (!rrImageFile) { setRrImageError(true); return; }
    if (rrStatusReuniao === 'Não compareceu') setRrResultado('');
    if (rrResultado === 'Perdido' && !rrMotivoPerda.trim()) { setRrErroMotivo(true); return; }
    setRrSaving(true);
    const now = new Date().toISOString();

    // TP sempre do card (crm_leads) — nunca de crm_tarefas
    const resolvedTP_rr = (lead as any).tp_atual || 'R1';

    // Upload image (non-blocking)
    let uploadedUrl: string | null = null;
    try {
      const ext = rrImageFile.name.split('.').pop() ?? 'png';
      const path = `${lead.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('comercial-prints').upload(path, rrImageFile);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('comercial-prints').getPublicUrl(path);
        uploadedUrl = urlData.publicUrl;
      } else {
        console.warn('[rr-upload] failed, continuing:', upErr);
      }
    } catch (err) {
      console.warn('[rr-upload] exception, continuing:', err);
    }

    const computedMrr = rrMrr;
    const descJson = JSON.stringify({
      resumo: rrResumo, motivo_perda: rrMotivoPerda || undefined,
      proxima_reuniao: rrProximaReuniao || undefined,
      valor_contrato: rrValorContrato || undefined, valor_cc: rrValorCc || undefined,
      prazo_meses: rrPrazoMeses || undefined, valor_mrr: computedMrr ?? undefined,
      razao_social: rrRazaoSocial || undefined, tipo_pessoa: rrTipoPessoa || undefined,
      cpf_cnpj: rrCpfCnpj || undefined, endereco_completo: rrEndereco || undefined,
      email_contato: rrEmailContato || undefined, telefone_contato: rrTelefoneContato || undefined,
      nome_responsavel: rrNomeResponsavel || undefined,
      forma_pagamento: rrFormaPagamento || undefined,
      data_primeiro_vencimento: rrDataPrimeiroVencimento || undefined,
    });

    // 1. crm_atividades
    const { data: ativData } = await supabase.from('crm_atividades').insert({
      lead_id: lead.id, tipo: 'reuniao', status_reuniao: rrStatusReuniao,
      resultado: rrResultado || null, imagem_url: uploadedUrl,
      realizado_por: userSession?.name ?? '', descricao: descJson,
      data_atividade: now, created_at: now,
    }).select().single();

    // Bloco 6: Auto-concluir tarefa de reunião pendente do lead (match por tipo)
    try {
      const { data: tarefasPendentes } = await supabase
        .from('crm_tarefas')
        .select('id, titulo, tipo')
        .eq('lead_id', lead.id)
        .eq('concluida', false)
        .order('data_agendada', { ascending: false })
        .limit(5);
      if (tarefasPendentes && tarefasPendentes.length > 0) {
        const tarefa = tarefasPendentes.find(t => t.tipo === 'reuniao')
          || tarefasPendentes.find(t => /reuni|R\d|ligac/i.test(t.titulo || ''))
          || null;
        if (tarefa) {
          await supabase.from('crm_tarefas').update({ concluida: true }).eq('id', tarefa.id);
          setTarefas(prev => prev.map(t => t.id === tarefa.id ? { ...t, concluida: true } : t));
        }
      }
    } catch (e) { console.warn('[auto-concluir tarefa]', e); }

    // 2. Update lead
    const leadUpd: Partial<CRMLead> = { updated_at: now, etapa_desde: now, programa_apresentado: programaApresentado || null };
    // Always save financial values if provided
    if (rrValorContrato) leadUpd.valor_contrato = parseFloat(rrValorContrato);
    if (rrValorCc) leadUpd.valor_cc = parseFloat(rrValorCc);
    if (computedMrr != null) leadUpd.valor_mrr = computedMrr;
    if (rrResultado === 'Venda') {
      leadUpd.etapa = 'fechado'; leadUpd.status = 'ganho';
    } else if (rrResultado === 'Perdido') {
      leadUpd.etapa = 'perdido'; leadUpd.status = 'perdido';
      leadUpd.motivo_perda = rrMotivoPerda || null;
    } else {
      leadUpd.etapa = 'rm_realizada';
    }
    await supabase.from('crm_leads').update(leadUpd).eq('id', lead.id);
    await onSave(leadUpd);

    // Auto-create client on Venda
    if (rrResultado === 'Venda') {
      try {
        const parsedContrato = rrValorContrato ? parseFloat(rrValorContrato) : 0;
        const parsedMrr = computedMrr ?? 0;
        const dur = parsedMrr ? Math.round(parsedContrato / parsedMrr) : 12;
        const entryDate = new Date().toISOString().split('T')[0];
        const clienteData = {
          id: Date.now().toString(),
          name: lead.nome,
          responsible: rrNomeResponsavel || (lead as any)?.nome_responsavel_financeiro || lead.responsavel || '',
          plan: lead.programa_apresentado === 'Pro' ? 'Pro' : lead.programa_apresentado === 'Lite' ? 'Lite' : 'Basic',
          status: 'Onboarding',
          entry_date: entryDate,
          exit_date: '',
          contract_duration: dur,
          docs: { access: '', transcription: '' },
          tags: [],
          platforms: [],
          funnels: [],
          onboarding_checklist: [],
          monthly_meetings: [],
          comments: [],
          offers: [],
          situation: '',
          razao_social: rrRazaoSocial || '',
          tipo_pessoa: rrTipoPessoa || '',
          cpf_cnpj: rrCpfCnpj || '',
          endereco: rrEndereco || '',
          email_contato: rrEmailContato || '',
          telefone_contato: rrTelefoneContato || '',
          nome_responsavel_financeiro: rrNomeResponsavel || '',
          valor_contrato: parsedContrato,
          valor_cc: rrValorCc ? parseFloat(rrValorCc) : 0,
          valor_mrr: parsedMrr,
          forma_pagamento: rrFormaPagamento || '',
          data_primeiro_vencimento: rrDataPrimeiroVencimento || '',
        };
        console.log('[clients] Inserting:', JSON.stringify(clienteData, null, 2));
        await supabase.from('clients').insert(clienteData);
      } catch (err) { console.error('Failed to create client:', err); }

    }

    // 3. comercial_tasks
    try {
      const taskData2 = {
        id: crypto.randomUUID(), type: 'Vendas', category: 'Reunião',
        collaborator: lead.responsavel || userSession?.name || '', meeting_status: rrStatusReuniao,
        sale_status: rrResultado || null,
        contract_value: rrValorContrato ? parseFloat(rrValorContrato) : null,
        cash_collect: rrValorCc ? parseFloat(rrValorCc) : null,
        next_meeting_date: rrProximaReuniao ? localDatetimeToISO(rrProximaReuniao) : null, loss_reason: rrMotivoPerda || null,
        image_url: uploadedUrl || '', completion_time: new Date().toLocaleString('pt-BR', { timeZone: SP_TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        created_at: now, answered: null, touchpoint: null, scheduled: false,
        company_name: null, responsible_name: null,
      };
      console.log('[comercial_tasks] Inserting:', JSON.stringify(taskData2, null, 2));
      const { error: taskErr2 } = await supabase.from('comercial_tasks').insert(taskData2);
      if (taskErr2) {
        console.log('[comercial_tasks] Error detail:', JSON.stringify(taskErr2));
      }
    } catch (err) { console.error('comercial_tasks mirror failed:', err); }

    // 4. Auto-create task for R2+ / Reagendou
    if ((rrResultado === 'Marcou R2+' || rrResultado === 'Reagendou') && rrProximaReuniao) {
      // Compute TP for webhook and syncPostgres
      const tpMap_rr: Record<string, string> = {'R1': 'R2', 'R2': 'R3', 'R3': 'R4+'};
      const nextTP_rr = tpMap_rr[resolvedTP_rr] || 'R4+';
      const reagendaTP_rr = resolvedTP_rr;
      const webhookTipoReuniao = rrResultado === 'Reagendou' ? reagendaTP_rr : nextTP_rr;

      try {
        const { data: rrTask } = await supabase.from('crm_tarefas').insert({
          lead_id: lead.id, titulo: `R2+ - ${lead.nome}`,
          data_agendada: localDatetimeToISO(rrProximaReuniao), responsavel: userSession?.name ?? '',
          concluida: false, created_at: now,
        }).select().single();
        if (rrTask) onTarefaCreated?.(rrTask);
      } catch (err) { console.error('R2+ task failed:', err); }

      // Send agendar-reuniao webhook for R2+ / Reagendou
      try {
        const webhookBase = import.meta.env.VITE_WEBHOOK_BASE?.replace('/webhook/dashboard', '') ?? 'https://webhook.m2black.com';
        const rrResp = await fetch(`${webhookBase}/webhook/agendar-reuniao`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_nome: lead.nome,
            lead_telefone: lead.telefone ?? '',
            lead_externo_id: lead.lead_externo_id ?? lead.id,
            closer: responsavel || userSession?.name || '',
            tipo_reuniao: webhookTipoReuniao,
            data_hora: new Date(rrProximaReuniao).toISOString(),
            duracao_min: 60,
            reagendamento: rrResultado === 'Reagendou',
            bant: { sdr: (lead as any).sdr || lead.responsavel || '' },
          }),
        }).catch(e => { console.warn('Webhook agendar-reuniao (CORS em dev):', e.message); return null; });
        // Fire-and-forget: agendar touchpoints
        try {
          let meetLink = '';
          try { if (rrResp?.ok) { const rj = await rrResp.json(); meetLink = rj.meet_link ?? ''; } } catch { /* no json */ }
          fetch(`${webhookBase}/webhook/agendar-touchpoints`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lead_id: lead.lead_externo_id ?? lead.id,
              lead_nome: lead.nome,
              lead_telefone: lead.telefone ?? '',
              data_hora: new Date(rrProximaReuniao).toISOString(),
              meet_link: meetLink,
            }),
          }).catch(() => {});
        } catch { /* silent */ }
      } catch (err) { console.error('Failed to send agendar-reuniao webhook:', err); }
    }

    // 5. Update local state
    if (ativData) setAtividades(prev => [ativData, ...prev]);
    if (leadUpd.etapa) setEtapa(leadUpd.etapa);
    if (leadUpd.valor_contrato != null) setValorContrato(leadUpd.valor_contrato);
    if (leadUpd.valor_cc != null) setValorCc(leadUpd.valor_cc);
    if (leadUpd.valor_mrr != null) setValorMrr(leadUpd.valor_mrr);

    // 6. Sync Postgres → Railway via n8n (fire-and-forget)
    {
      const hoje = new Date().toISOString().split('T')[0];
      const closer = responsavel || null;
      const currentTP = resolvedTP_rr;

      if (rrStatusReuniao === 'Não compareceu') {
        // Bloco 6: UPDATE reunião → No-show
        syncPostgres(lead.lead_externo_id, {
          reuniao_action: 'resultado',
          crm_lead_id: lead.id,
          reuniao_tp: currentTP,
          reuniao_status: 'No-show',
          reuniao_resultado: 'No-show',
          closer,
        });
        // Cancelar touchpoints pendentes
        fetch(`${WEBHOOK_BASE}/webhook/cancelar-touchpoints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: lead.lead_externo_id ?? lead.id }),
        }).catch(() => {});
      } else if (rrStatusReuniao === 'Compareceu') {
        if (rrResultado === 'Marcou R2+') {
          // Bloco 2: UPDATE reunião atual → Compareceu + INSERT R2
          const tpMap_ld: Record<string, string> = {'R1': 'R2', 'R2': 'R3', 'R3': 'R4+'};
          const nextTP = tpMap_ld[currentTP] || 'R4+';
          syncPostgres(lead.lead_externo_id, {
            reuniao_action: 'resultado',
            crm_lead_id: lead.id,
            reuniao_tp: currentTP,
            reuniao_status: 'Compareceu',
            reuniao_resultado: 'Marcou R2+',
            Data_Reuniao_Realizada: hoje,
            Data_TP: rrProximaReuniao ? new Date(rrProximaReuniao).toISOString().split('T')[0] : hoje,
            TP: nextTP,
            programa: programaApresentado || null,
            rs_contrato: rrValorContrato || null,
            rs_cc: rrValorCc || null,
            closer,
          });
          if (rrProximaReuniao) {
            const horaR2 = new Date(rrProximaReuniao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: SP_TZ });
            syncPostgres(lead.lead_externo_id, {
              reuniao_action: 'agendar',
              crm_lead_id: lead.id,
              reuniao_tp: nextTP,
              Data_Reuniao_Marcada: new Date(rrProximaReuniao).toISOString().split('T')[0],
              hora_marcada: horaR2,
              closer,
            });
          }
        } else if (rrResultado === 'Reagendou') {
          // Bloco 7: UPDATE Reagendou + INSERT mesma TP (atômico)
          if (rrProximaReuniao) {
            const horaReag = new Date(rrProximaReuniao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: SP_TZ });
            syncPostgres(lead.lead_externo_id, {
              reuniao_action: 'resultado_e_reagendar',
              crm_lead_id: lead.id,
              reuniao_tp: currentTP,
              reuniao_status: 'Reagendou',
              reuniao_resultado: 'Reagendou',
              closer,
              nova_data_marcada: new Date(rrProximaReuniao).toISOString().split('T')[0],
              nova_hora_marcada: horaReag,
              novo_tp: currentTP,
            });
          }
        } else if (rrResultado === 'Venda') {
          // Bloco 3: UPDATE reunião → Venda
          syncPostgres(lead.lead_externo_id, {
            reuniao_action: 'resultado',
            crm_lead_id: lead.id,
            reuniao_tp: currentTP,
            reuniao_status: 'Venda',
            reuniao_resultado: 'Venda',
            status: 'ganho', etapa: 'fechado',
            Data_Venda: hoje, Data_Reuniao_Realizada: hoje,
            programa: programaApresentado || null,
            rs_contrato: rrValorContrato || null, rs_cc: rrValorCc || null,
            mrr_adicionado: computedMrr || null, Etapa_Fechamento: currentTP, closer,
          });
        } else if (rrResultado === 'Perdido') {
          // Bloco 4: UPDATE reunião → Perdido
          syncPostgres(lead.lead_externo_id, {
            reuniao_action: 'resultado',
            crm_lead_id: lead.id,
            reuniao_tp: currentTP,
            reuniao_status: 'Perdido',
            reuniao_resultado: 'Perdido',
            status: 'perdido',
            Data_Reuniao_Realizada: hoje,
            closer,
          });
        } else {
          // Bloco 5: UPDATE reunião → Pendente
          syncPostgres(lead.lead_externo_id, {
            reuniao_action: 'resultado',
            crm_lead_id: lead.id,
            reuniao_tp: currentTP,
            reuniao_status: 'Compareceu',
            reuniao_resultado: 'Pendente',
            Data_Reuniao_Realizada: hoje,
            closer,
          });
        }
      }
    }

    // Add No-show tag when lead didn't show up
    if (rrStatusReuniao === 'Não compareceu') {
      try {
        const tagsAtuais: string[] = lead.tags ?? [];
        if (!tagsAtuais.includes('No-show')) {
          const updatedTags = [...tagsAtuais, 'No-show'];
          await supabase.from('crm_leads').update({ tags: updatedTags }).eq('id', lead.id);
          onSave({ tags: updatedTags });
          setLocalTags(updatedTags);
        }
      } catch { /* silent */ }
    }

    setReuniaoRealizada(false);
    setRrSaving(false);
    setTab('timeline');
  };

  // Estado para concluir tarefa com print
  const [concluindoTarefa, setConcluindoTarefa] = useState<string | null>(null);
  const [tarefaImageFile, setTarefaImageFile] = useState<File | null>(null);
  const [tarefaImagePreview, setTarefaImagePreview] = useState<string | null>(null);
  const [tarefaUploading, setTarefaUploading] = useState(false);
  const [tarefaObs, setTarefaObs] = useState('');
  const tarefaFileRef = useRef<HTMLInputElement>(null);

  // Estado para reagendar tarefa
  const [reagendandoTarefa, setReagendandoTarefa] = useState<string | null>(null);
  const [reagendarData, setReagendarData] = useState('');
  const [reagendarSaving, setReagendarSaving] = useState(false);

  const reagendarTarefa = async (t: CRMTarefa) => {
    if (!reagendarData) return;
    setReagendarSaving(true);
    try {
      const novaData = localDatetimeToISO(reagendarData);
      await supabase.from('crm_tarefas').update({ data_agendada: novaData }).eq('id', t.id);
      setTarefas(prev => prev.map(x => x.id === t.id ? { ...x, data_agendada: novaData } : x));
      // Atualizar proxima_reuniao no lead se aplicável
      const agDate = parseDateSP(reagendarData);
      if (agDate > new Date()) {
        await supabase.from('crm_leads').update({ proxima_reuniao: novaData, updated_at: new Date().toISOString() }).eq('id', lead.id);
        onSave({ proxima_reuniao: novaData });
      }
      // Cancelar touchpoints anteriores antes de reagendar
      try {
        const webhookBase0 = import.meta.env.VITE_WEBHOOK_BASE?.replace('/webhook/dashboard', '') ?? 'https://webhook.m2black.com';
        fetch(`${webhookBase0}/webhook/cancelar-touchpoints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: lead.lead_externo_id ?? lead.id }),
        }).catch(() => {});
      } catch { /* silent */ }
      // Enviar para webhook agendar-reuniao (atualizar Google Agenda)
      try {
        const webhookBase = import.meta.env.VITE_WEBHOOK_BASE?.replace('/webhook/dashboard', '') ?? 'https://webhook.m2black.com';
        const reagResp = await fetch(`${webhookBase}/webhook/agendar-reuniao`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_nome: lead.nome,
            lead_telefone: lead.telefone ?? '',
            lead_externo_id: lead.lead_externo_id ?? lead.id,
            closer: t.responsavel || lead.responsavel || '',
            tipo_reuniao: t.titulo?.includes('R2') ? 'R2' : 'R1',
            data_hora: new Date(reagendarData).toISOString(),
            duracao_min: 60,
            reagendamento: true,
            bant: { sdr: (lead as any).sdr || lead.responsavel || '' },
          }),
        }).catch(() => null);
        // Fire-and-forget: agendar touchpoints
        try {
          let meetLink = '';
          try { if (reagResp?.ok) { const rj = await reagResp.json(); meetLink = rj.meet_link ?? ''; } } catch { /* no json */ }
          fetch(`${webhookBase}/webhook/agendar-touchpoints`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lead_id: lead.lead_externo_id ?? lead.id,
              lead_nome: lead.nome,
              lead_telefone: lead.telefone ?? '',
              data_hora: new Date(reagendarData).toISOString(),
              meet_link: meetLink,
            }),
          }).catch(() => {});
        } catch { /* silent */ }
      } catch { /* fire-and-forget */ }
      // Sync reuniao_tp → Railway (fire-and-forget)
      {
        const currentTP = (lead as any).tp || (lead as any).TP || '';
        const tpMap: Record<string, string> = {'': 'R1', 'R1': 'R2', 'R2': 'R3', 'R3': 'R4+'};
        const agendamentoTP = tpMap[currentTP] || 'R4+';
        const horaReag = new Date(reagendarData).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' });
        syncPostgres(lead.lead_externo_id, {
          reuniao_tp: agendamentoTP,
          Data_Reuniao_Marcada: new Date(reagendarData).toISOString().split('T')[0],
          hora_marcada: horaReag,
          TP: agendamentoTP,
          closer: t.responsavel || lead.responsavel || null,
        });
      }
      setReagendandoTarefa(null);
      setReagendarData('');
    } catch (err) { console.error('Erro ao reagendar tarefa:', err); }
    setReagendarSaving(false);
  };

  const handleTarefaImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setTarefaImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setTarefaImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else { setTarefaImagePreview(null); }
  };

  const concluirTarefa = async (t: CRMTarefa) => {
    if (!tarefaImageFile) return;
    setTarefaUploading(true);
    let imageUrl = '';
    try {
      const ext = tarefaImageFile.name.split('.').pop() ?? 'png';
      const path = `${t.lead_id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('comercial-prints').upload(path, tarefaImageFile);
      if (!error) {
        const { data: urlData } = supabase.storage.from('comercial-prints').getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
    } catch { /* continue */ }

    await supabase.from('crm_tarefas').update({ concluida: true }).eq('id', t.id);
    setTarefas(prev => prev.map(x => x.id === t.id ? { ...x, concluida: true } : x));

    const now = new Date().toISOString();
    const tipoAtiv = (t as any).tipo || 'ligacao';
    const descJson = JSON.stringify({ obs: tarefaObs || '', titulo: t.titulo, agendada: t.data_agendada ? fmtDateSP(t.data_agendada, { year: true }) : '' });
    // 1. crm_atividades (timeline)
    const { data: ativData } = await supabase.from('crm_atividades').insert({
      lead_id: t.lead_id, tipo: tipoAtiv, descricao: descJson,
      imagem_url: imageUrl || null,
      data_atividade: now, realizado_por: userSession?.name ?? '', created_at: now,
    }).select().single();
    if (ativData) setAtividades(prev => [ativData, ...prev]);

    // 2. comercial_tasks (relatório)
    const collaborator = t.responsavel || lead.responsavel || userSession?.name || '';
    const category = tipoAtiv === 'ligacao' ? 'Ligação' : 'Tarefa';
    try {
      await supabase.from('comercial_tasks').insert({
        id: crypto.randomUUID(), type: 'PreVendas', category,
        collaborator, image_url: imageUrl || '',
        completion_time: new Date().toLocaleString('pt-BR', { timeZone: SP_TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        meeting_summary: t.titulo,
        created_at: now,
      });
    } catch { /* fire-and-forget */ }

    setTarefaUploading(false);
    setConcluindoTarefa(null);
    setTarefaImageFile(null);
    setTarefaImagePreview(null);
    setTarefaObs('');
  };

  const etapaObj = ETAPA_MAP[etapa];

  const fmtAtivDate = (d: string) => fmtDateSP(d, { year: true });

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-bg-card border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/5">
          <div>
            <h2 className="text-base font-bold text-white">{lead.nome}</h2>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${etapaObj?.badge}`}>{etapaObj?.label}</span>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && !confirmDelete && (
              <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
            )}
            {isAdmin && confirmDelete && (
              <div className="flex items-center gap-1.5">
                <button onClick={async () => {
                  const { error } = await supabase.from('crm_leads').update({ deletado_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', lead.id);
                  if (error) {
                    console.error('[crm_leads] Erro ao excluir:', JSON.stringify(error));
                    alert('Erro ao excluir lead. Tente novamente.');
                    return;
                  }
                  // Remove tarefas associadas ao lead excluído
                  await supabase.from('crm_tarefas').delete().eq('lead_id', lead.id);
                  onDelete(lead.id);
                }} className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 text-[11px] font-semibold hover:bg-red-500/30 transition-colors">Confirmar exclusão</button>
                <button onClick={() => setConfirmDelete(false)} className="px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 text-[11px] font-semibold hover:bg-white/10 transition-colors">Cancelar</button>
              </div>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400"><X size={16} /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          {[['info','Informações'], ['timeline','Atividades'], ['tarefas','Tarefas']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id as any)}
              className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors ${tab === id ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-500 hover:text-gray-300'}`}
            >{label} {id === 'timeline' && atividades.length > 0 && `(${atividades.length})`}</button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {/* ── TAB: INFORMAÇÕES ─────────── */}
          {tab === 'info' && (<>
            {/* Dados básicos */}
            <div className="grid grid-cols-2 gap-3">
              {lead.telefone && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-0.5">Telefone</p>
                  <a href={`https://api.whatsapp.com/send?phone=${lead.telefone.replace(/\D/g, '').replace(/^0/, '').replace(/^(?!55)/, '55')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-gray-300 hover:text-brand-primary transition-colors"
                  >{lead.telefone}</a>
                </div>
              )}
              {[
                { label: 'Empresa', value: lead.empresa },
                { label: 'Origem', value: lead.anuncio ?? lead.origem, extra: lead.created_at ? fmtDateSmartSP(lead.created_at, { year: true }) : undefined },
              ].filter(f => f.value).map(f => (
                <div key={f.label}>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-0.5">{f.label}</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-300">{f.value}</p>
                    {f.extra && <span className="text-[10px] text-gray-500">{f.extra}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Editáveis: Área + Faturamento */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Área de Atuação</label>
                <input value={area} onChange={e => setArea(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary"
                  placeholder="Ex: Construção Civil"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Faturamento</label>
                <input value={faturamento} onChange={e => setFaturamento(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary"
                  placeholder="Ex: R$ 50.000/mês"
                />
              </div>
            </div>

            {/* Responsável */}
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Responsável</label>
              {isAdmin ? (
                <select value={responsavel} onChange={e => setResponsavel(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
                >
                  <option value="" className="bg-bg-main">Sem responsável</option>
                  {teamMembers.filter(m => ['admin','comercial'].includes((m.role ?? '').toLowerCase()))
                    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                    .map(m => <option key={m.id} value={m.name} className="bg-bg-main">{m.name}</option>)}
                </select>
              ) : <p className="text-sm text-gray-300">{responsavel || '—'}</p>}
            </div>

            {/* Etapa */}
            {isAdmin && (
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Etapa</label>
                <select value={etapa} onChange={e => setEtapa(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
                >
                  {ETAPAS.map(e => <option key={e.id} value={e.id} className="bg-bg-main">{e.label}</option>)}
                </select>
              </div>
            )}

            {!isAdmin && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2">Mover para</p>
                <div className="grid grid-cols-3 gap-2">
                  {ETAPAS.filter(e => e.id !== 'base').map(e => (
                    <button key={e.id} onClick={() => setEtapa(e.id)}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${etapa === e.id ? `${e.badge} border-transparent` : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'}`}
                    >{e.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Info financeira pós-reunião */}
            {((lead.valor_contrato != null && lead.valor_contrato > 0) || (lead.valor_cc != null && lead.valor_cc > 0) || (lead.programa_apresentado != null && lead.programa_apresentado !== '') || atividades.some(a => a.tipo === 'reuniao' && a.status_reuniao === 'Compareceu')) && (
              <div className="bg-white/5 rounded-xl p-3 space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-brand-primary">Negociação</p>
                {lead.programa_apresentado && <div className="flex justify-between text-xs"><span className="text-gray-500">Programa</span><span className={getProgramaStyle(lead.programa_apresentado)}>{lead.programa_apresentado}</span></div>}
                {lead.valor_contrato != null && <div className="flex justify-between text-xs"><span className="text-gray-500">Contrato</span><span className="text-brand-primary font-bold">R$ {Number(lead.valor_contrato).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>}
                {lead.valor_cc != null && <div className="flex justify-between text-xs"><span className="text-gray-500">Cash Collect</span><span className="text-white font-bold">R$ {Number(lead.valor_cc).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>}
              </div>
            )}

            {/* Etiquetas */}
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-2">Etiquetas</label>
              <div className="flex flex-wrap gap-2">
                {ALL_TAGS.map(tag => {
                  const active = localTags.includes(tag);
                  return (
                    <button key={tag} onClick={() => setLocalTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                      className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-all ${active ? TAGS_CONFIG[tag] : 'bg-white/5 text-gray-600 border-white/10 hover:border-white/20'}`}
                    >{tag}</button>
                  );
                })}
              </div>
            </div>

            {/* Negociação */}
            {((lead.valor_contrato != null && lead.valor_contrato > 0) || (lead.valor_cc != null && lead.valor_cc > 0) || (lead.programa_apresentado != null && lead.programa_apresentado !== '') || atividades.some(a => a.tipo === 'reuniao' && a.status_reuniao === 'Compareceu')) && <div className="border-t border-white/5 pt-3 space-y-3">
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block">Negociação</label>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Programa</label>
                <select value={programaApresentado} onChange={e => setProgramaApresentado(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
                >
                  <option value="" className="bg-bg-main">Selecionar...</option>
                  {['Basic', 'Lite', 'Pro'].map(p => <option key={p} value={p} className="bg-bg-main">{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Contrato (R$)</label>
                  <input type="number" value={valorContrato} onChange={e => setValorContrato(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Cash Collect (R$)</label>
                  <input type="number" value={valorCc} onChange={e => setValorCc(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">MRR (R$)</label>
                  <input type="number" value={valorMrr} onChange={e => setValorMrr(e.target.value ? parseFloat(e.target.value) : '')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>}

            {/* Observações */}
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Observações</label>
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-primary resize-none"
                placeholder="Anotações sobre o lead..."
              />
            </div>

            {/* Nova Atividade + Agendar Tarefa inline */}
            <div className="border-t border-white/5 pt-3">
              {showAtivForm ? (
                <NovaAtividadeForm lead={lead} leadId={lead.id} leadName={lead.nome} userSession={userSession} teamMembers={teamMembers} onSaved={handleAtivSaved} onCancel={() => { setShowAtivForm(false); setAtivFormTipo(undefined); setConcluindoTarefaViaAtiv(null); }} onLeadUpdated={handleLeadUpdated} onClientCreated={onClientCreated} onTarefaCreated={onTarefaCreated} initialTipo={ativFormTipo} />
              ) : showAgendarReuniao ? (
                <div className="space-y-3 bg-white/[0.02] border border-yellow-500/20 rounded-xl p-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-yellow-400">Agendar Reunião</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Tipo</label>
                      <select value={arTipo} onChange={e => setArTipo(e.target.value as 'R1' | 'R2')}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 appearance-none"
                      >
                        <option value="R1" className="bg-bg-main">R1</option>
                        <option value="R2" className="bg-bg-main">R2</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Duração (min)</label>
                      <input value={arDuracao} onChange={e => setArDuracao(e.target.value)} type="number"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Data e hora <span className="text-red-400">*</span></label>
                    <SlotPicker selectedDate={arSlotDate} onSelectDate={setArSlotDate} selectedHour={arSlotHour} onSelectHour={setArSlotHour} tpAtual={(lead as any)?.tp_atual || 'R1'} />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Closer responsável <span className="text-red-400">*</span></label>
                    <select value={arCloser} onChange={e => setArCloser(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 appearance-none"
                    >
                      <option value="" className="bg-bg-main">Selecionar...</option>
                      <option value="Gabriel Fonseca" className="bg-bg-main">Gabriel Fonseca</option>
                      <option value="Carla" className="bg-bg-main">Carla</option>
                      <option value="Gabriel Moreira" className="bg-bg-main">Gabriel Moreira</option>
                    </select>
                  </div>
                  {/* Divisor BANT */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600">BANT</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Faturamento (R$)</label>
                      <input value={arFaturamento} onChange={e => setArFaturamento(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500"
                        placeholder="Ex: 100.000"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Budget líquido (R$)</label>
                      <input value={arBudget} onChange={e => setArBudget(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500"
                        placeholder="Ex: 5.000"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Momento do negócio</label>
                    <select value={arMomento} onChange={e => setArMomento(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 appearance-none"
                    >
                      <option value="" className="bg-bg-main">Selecionar...</option>
                      <option value="Comecei agora e preciso de estrutura no digital" className="bg-bg-main">Comecei agora e preciso de estrutura no digital</option>
                      <option value="Já contratei agência, mas não tive resultado" className="bg-bg-main">Já contratei agência, mas não tive resultado</option>
                      <option value="Já vendo por indicação, mas quero escalar via internet" className="bg-bg-main">Já vendo por indicação, mas quero escalar via internet</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Como capta clientes hoje</label>
                    <select value={arCaptacao} onChange={e => setArCaptacao(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 appearance-none"
                    >
                      <option value="" className="bg-bg-main">Selecionar...</option>
                      <option value="Indicação" className="bg-bg-main">Indicação</option>
                      <option value="Tráfego Pago" className="bg-bg-main">Tráfego Pago</option>
                      <option value="Ainda não tenho clientes" className="bg-bg-main">Ainda não tenho clientes</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Autoridade (Decisores)</label>
                    <select value={arAutoridade} onChange={e => setArAutoridade(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 appearance-none"
                    >
                      <option value="" className="bg-bg-main">Selecionar...</option>
                      <option value="Nenhum decisor envolvido / lead terceirizado" className="bg-bg-main">Nenhum decisor envolvido / lead terceirizado</option>
                      <option value="Tem influência, mas depende do sócio ou gestor" className="bg-bg-main">Tem influência, mas depende do sócio ou gestor</option>
                      <option value="Decisor principal e sócio confirmado para a reunião" className="bg-bg-main">Decisor principal e sócio confirmado para a reunião</option>
                      <option value="É o único decisor e demonstra autoridade total" className="bg-bg-main">É o único decisor e demonstra autoridade total</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Necessidade / Dor</label>
                    <select value={arNecessidade} onChange={e => setArNecessidade(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 appearance-none"
                    >
                      <option value="" className="bg-bg-main">Selecionar...</option>
                      <option value="Quer melhorar marketing, mas sem dor clara" className="bg-bg-main">Quer melhorar marketing, mas sem dor clara</option>
                      <option value="Reconhece que falta previsibilidade, mas ainda sem urgência" className="bg-bg-main">Reconhece que falta previsibilidade, mas ainda sem urgência</option>
                      <option value="Sofre com falta de leads ou estrutura comercial e quer resolver" className="bg-bg-main">Sofre com falta de leads ou estrutura comercial e quer resolver</option>
                      <option value="Está com prejuízo, sem previsibilidade e quer agir agora" className="bg-bg-main">Está com prejuízo, sem previsibilidade e quer agir agora</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Timing / Urgência</label>
                    <select value={arTiming} onChange={e => setArTiming(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 appearance-none"
                    >
                      <option value="" className="bg-bg-main">Selecionar...</option>
                      <option value="Não tem previsão / talvez no futuro" className="bg-bg-main">Não tem previsão / talvez no futuro</option>
                      <option value="Pensa em agir em até 3 meses" className="bg-bg-main">Pensa em agir em até 3 meses</option>
                      <option value="Quer começar em até 30 dias" className="bg-bg-main">Quer começar em até 30 dias</option>
                      <option value="Quer iniciar imediatamente / essa semana" className="bg-bg-main">Quer iniciar imediatamente / essa semana</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">SDR responsável</label>
                    <select value={arSdr} onChange={e => setArSdr(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 appearance-none"
                    >
                      <option value="" className="bg-bg-main">Selecionar...</option>
                      <option value="Vitória Mendes" className="bg-bg-main">Vitória Mendes</option>
                      <option value="Pedro Relvas" className="bg-bg-main">Pedro Relvas</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Desafio, dor e observações</label>
                    <textarea value={arObs} onChange={e => setArObs(e.target.value)} rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500 resize-none"
                      placeholder="Descreva o cenário do lead..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAgendarReuniao(false)}
                      className="flex-1 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
                    >Cancelar</button>
                    <button onClick={handleAgendarReuniao} disabled={arSaving || arSuccess || !arDataHora || !arCloser}
                      className="flex-1 py-1.5 rounded-xl bg-yellow-500 text-black text-xs font-bold hover:bg-yellow-400 disabled:opacity-40 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {arSaving ? <Loader2 size={12} className="animate-spin" /> : arSuccess ? <CheckCircle2 size={12} /> : <Send size={12} />}
                      {arSuccess ? 'Agendado!' : 'Agendar e Notificar'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <button onClick={() => { setShowAtivForm(true); setAtivFormTipo(undefined); setConcluindoTarefaViaAtiv(null); setTab('timeline'); }}
                      className="w-full py-2 rounded-xl border border-dashed border-white/15 text-xs text-gray-500 hover:text-brand-primary hover:border-brand-primary/40 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={13} /> Registrar atividade
                    </button>
                  </div>
                  <div className="flex-1">
                    <button onClick={() => { setShowAgendarTarefa(true); setTab('tarefas'); }}
                      className="w-full py-2 rounded-xl border border-dashed border-white/15 text-xs text-gray-500 hover:text-brand-primary hover:border-brand-primary/40 transition-all flex items-center justify-center gap-2"
                    >
                      <Calendar size={13} /> Agendar Tarefa
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2 rounded-xl bg-brand-primary text-black text-sm font-bold hover:bg-brand-primary/80 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}Salvar
              </button>
            </div>
          </>)}

          {/* ── TAB: TIMELINE ─────────────── */}
          {tab === 'timeline' && (
            <div className="space-y-3">
              <button onClick={() => { setShowAtivForm(!showAtivForm); if (!showAtivForm) { setAtivFormTipo(undefined); setConcluindoTarefaViaAtiv(null); } }}
                className="w-full py-2 rounded-xl bg-brand-primary/10 border border-brand-primary/30 text-xs text-brand-primary hover:bg-brand-primary/20 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={13} /> Registrar atividade
              </button>
              {showAtivForm && <NovaAtividadeForm lead={lead} leadId={lead.id} leadName={lead.nome} userSession={userSession} teamMembers={teamMembers} onSaved={handleAtivSaved} onCancel={() => { setShowAtivForm(false); setAtivFormTipo(undefined); setConcluindoTarefaViaAtiv(null); }} onLeadUpdated={handleLeadUpdated} onClientCreated={onClientCreated} onTarefaCreated={onTarefaCreated} initialTipo={ativFormTipo} />}
              {atividades.length === 0 && !showAtivForm && (
                <div className="py-12 text-center text-xs text-gray-600">Nenhuma atividade registrada ainda.</div>
              )}
              {atividades.map(a => {
                const Icon = TIPO_ICON[a.tipo] ?? FileText;
                return (
                  <div key={a.id} className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center mt-0.5">
                      <Icon size={13} className="text-gray-400" />
                    </div>
                    <div className="flex-1 bg-white/5 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                          {a.tipo === 'ligacao' ? 'Ligação' : a.tipo === 'reuniao' ? 'Reunião' : a.tipo === 'tarefa' ? 'Tarefa Concluída' : a.tipo}
                        </span>
                        <span className="text-[9px] text-gray-700">{fmtAtivDate(a.created_at)}</span>
                      </div>
                      {a.status_chamada && <p className={`text-xs font-bold ${a.status_chamada === 'Atendeu' ? 'text-brand-primary' : 'text-red-400'}`}>{a.status_chamada}</p>}
                      {a.status_reuniao && <p className={`text-xs font-bold ${a.status_reuniao === 'Compareceu' ? 'text-brand-primary' : 'text-red-400'}`}>{a.status_reuniao}</p>}
                      {a.resultado && <p className="text-xs text-yellow-400 font-bold">{a.resultado}</p>}
                      {a.touchpoint && <p className="text-[10px] text-gray-500">TP {a.touchpoint}</p>}
                      {a.agendou && <p className="text-[10px] text-blue-400">✓ Marcou reunião</p>}
                      {a.descricao && <p className="text-xs text-gray-400 italic">{a.descricao}</p>}
                      {a.realizado_por && <p className="text-[9px] text-gray-700">{a.realizado_por}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── TAB: TAREFAS ──────────────── */}
          {tab === 'tarefas' && (
            <div className="space-y-3">
              {/* Agendar próxima atividade */}
              {showAgendarTarefa ? (
                <div className="space-y-3 bg-white/[0.02] border border-white/10 rounded-xl p-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-brand-primary">Agendar Próxima Atividade</p>
                  {/* Tipo da atividade */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {([['ligacao', 'Ligação'], ['follow-up', 'Follow-up'], ['nota', 'Nota'], ['outro', 'Outro']] as const).map(([key, label]) => (
                      <button key={key} onClick={() => setAgTipo(key)}
                        className={`py-2 rounded-xl border text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer ${agTipo === key ? 'bg-brand-primary/20 border-brand-primary text-brand-primary' : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'}`}
                      >{label}</button>
                    ))}
                  </div>
                  {agTipo && (<>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Título da tarefa <span className="text-red-400">*</span></label>
                    <input value={agTitulo} onChange={e => setAgTitulo(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                      placeholder="Ex: Ligação de follow-up"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Data e hora <span className="text-red-400">*</span></label>
                    <input type="datetime-local" value={agData} onChange={e => setAgData(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Responsável <span className="text-red-400">*</span></label>
                    <select value={agResponsavel} onChange={e => setAgResponsavel(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
                    >
                      <option value="" className="bg-bg-main">Selecionar...</option>
                      {teamMembers.filter(m => ['admin','comercial'].includes((m.role ?? '').toLowerCase()))
                        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                        .map(m => <option key={m.id} value={m.name} className="bg-bg-main">{m.name}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowAgendarTarefa(false); setAgTipo(null); }}
                      className="flex-1 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
                    >Cancelar</button>
                    <button onClick={handleAgendarTarefa} disabled={agSaving || !agTitulo.trim() || !agData || !agTipo || !agResponsavel}
                      className="flex-1 py-1.5 rounded-xl bg-brand-primary text-black text-xs font-bold hover:bg-brand-primary/80 disabled:opacity-40 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {agSaving && <Loader2 size={12} className="animate-spin" />}
                      Salvar
                    </button>
                  </div>
                  </>)}
                </div>
              ) : (
                <button onClick={() => setShowAgendarTarefa(true)}
                  className="w-full py-2 rounded-xl border border-dashed border-white/15 text-xs text-gray-500 hover:text-brand-primary hover:border-brand-primary/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus size={13} /> Agendar próxima atividade
                </button>
              )}

              <input ref={tarefaFileRef} type="file" accept="image/*" onChange={handleTarefaImage} className="hidden" />
              {tarefas.length === 0 && !showAgendarTarefa && <div className="py-12 text-center text-xs text-gray-600">Nenhuma tarefa agendada.</div>}
              {tarefas.map(t => (
                <div key={t.id} className={`rounded-xl transition-colors ${t.concluida ? 'bg-white/3 opacity-50' : 'bg-white/5'}`}>
                  <div className="flex items-start gap-3 p-3">
                    <CheckCircle2 size={16} className={t.concluida ? 'text-brand-primary mt-0.5' : 'text-gray-600 mt-0.5'} />
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${t.concluida ? 'line-through text-gray-600' : 'text-white'}`}>{t.titulo}</p>
                      {t.data_agendada && <p className="text-[10px] text-gray-500 mt-0.5">{fmtDateSP(t.data_agendada, { year: true })}</p>}
                      {t.responsavel && <p className="text-[9px] text-gray-700">{t.responsavel}</p>}
                    </div>
                    {!t.concluida && reagendandoTarefa !== t.id && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setReagendandoTarefa(t.id); setReagendarData(''); setConcluindoTarefa(null); }}
                          className="text-[10px] font-bold text-yellow-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                        >Reagendar</button>
                        <button onClick={() => {
                          setConcluindoTarefa(t.id);
                          setTarefaImageFile(null);
                          setTarefaImagePreview(null);
                          setTarefaObs('');
                          setReagendandoTarefa(null);
                        }}
                          className="text-[10px] font-bold text-brand-primary hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                        >Concluir</button>
                      </div>
                    )}
                  </div>
                  {/* Painel de reagendamento */}
                  {reagendandoTarefa === t.id && !t.concluida && (
                    <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2 mx-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-yellow-400">Reagendar tarefa</p>
                      <input type="datetime-local" value={reagendarData} onChange={e => setReagendarData(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-yellow-400"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => reagendarTarefa(t)} disabled={!reagendarData || reagendarSaving}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 ${reagendarData ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 cursor-pointer' : 'bg-white/3 border border-white/10 text-gray-600 cursor-not-allowed'}`}
                        >
                          {reagendarSaving ? <Loader2 size={12} className="animate-spin" /> : <Calendar size={12} />} Confirmar
                        </button>
                        <button onClick={() => { setReagendandoTarefa(null); setReagendarData(''); }}
                          className="py-2 px-3 rounded-lg bg-white/5 border border-white/10 text-[11px] font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
                        >Cancelar</button>
                      </div>
                    </div>
                  )}
                  {/* Painel de concluir tarefa */}
                  {concluindoTarefa === t.id && !t.concluida && (
                    <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2 mx-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-brand-primary">Concluir: {t.titulo}</p>
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Print da tela <span className="text-red-400">*</span></label>
                        <input type="file" accept="image/*" onChange={handleTarefaImage}
                          className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-white/10 file:text-gray-300 hover:file:bg-white/20"
                        />
                        {tarefaImagePreview && <img src={tarefaImagePreview} alt="preview" className="mt-2 rounded-lg max-h-24 object-cover" />}
                      </div>
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Observação</label>
                        <textarea value={tarefaObs} onChange={e => setTarefaObs(e.target.value)} rows={2}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-brand-primary resize-none"
                          placeholder="Observação opcional..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => concluirTarefa(t)} disabled={!tarefaImageFile || tarefaUploading}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 ${tarefaImageFile ? 'bg-brand-primary/20 border border-brand-primary/30 text-brand-primary hover:bg-brand-primary/30 cursor-pointer' : 'bg-white/3 border border-white/10 text-gray-600 cursor-not-allowed'}`}
                        >
                          {tarefaUploading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Concluir
                        </button>
                        <button onClick={() => { setConcluindoTarefa(null); setTarefaImageFile(null); setTarefaImagePreview(null); setTarefaObs(''); }}
                          className="py-2 px-3 rounded-lg bg-white/5 border border-white/10 text-[11px] font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
                        >Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── New Lead Modal ─────────────────────────────────────────────
function NewLeadModal({ onClose, onSave, userSession, teamMembers }: {
  onClose: () => void; onSave: (lead: Partial<CRMLead>) => Promise<void>; userSession: any; teamMembers: TeamMember[];
}) {
  const [form, setForm] = useState({ nome: '', telefone: '', empresa: '', faturamento: '', area: '', responsavel: '' });
  const [origem, setOrigem] = useState('');
  const [origemCustom, setOrigemCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const origemFinal = origem === 'Outro' ? origemCustom.trim() : origem;
  const handleSave = async () => {
    if (!form.nome.trim() || !origemFinal) return;
    setSaving(true);
    await onSave({ ...form, etapa: 'base', status: 'ativo', origem: origemFinal, anuncio: origemFinal });
    setSaving(false);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-bg-card border border-white/10 rounded-2xl w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-base font-bold text-white">Novo Lead</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          {[
            { key: 'nome',        label: 'Nome *',           placeholder: 'Nome do lead' },
            { key: 'telefone',    label: 'Telefone',         placeholder: '(xx) xxxxx-xxxx' },
            { key: 'empresa',     label: 'Empresa',          placeholder: 'Nome da empresa' },
            { key: 'area',        label: 'Área de Atuação',  placeholder: 'Ex: Construção Civil' },
            { key: 'faturamento', label: 'Faturamento',      placeholder: 'Ex: R$ 50.000/mês' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">{f.label}</label>
              <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-brand-primary"
              />
            </div>
          ))}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Origem *</label>
            <select value={origem} onChange={e => { setOrigem(e.target.value); if (e.target.value !== 'Outro') setOrigemCustom(''); }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
            >
              <option value="" className="bg-bg-main">Selecione a origem</option>
              {['NT', 'SS', 'Indicação', 'SE', 'Site', 'Evento', 'Prospecção Ativa', 'Outro'].map(o => (
                <option key={o} value={o} className="bg-bg-main">{o}</option>
              ))}
            </select>
          </div>
          {origem === 'Outro' && (
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Origem (personalizada) *</label>
              <input value={origemCustom} onChange={e => setOrigemCustom(e.target.value)}
                placeholder="Digite a origem"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-brand-primary"
              />
            </div>
          )}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Responsável</label>
            <select value={form.responsavel} onChange={e => setForm(p => ({ ...p, responsavel: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
            >
              <option value="" className="bg-bg-main">Sem responsável</option>
              {teamMembers
                .filter(m => ['admin', 'comercial'].includes((m.role ?? '').toLowerCase()))
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                .map(m => <option key={m.id} value={m.name} className="bg-bg-main">{m.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.nome.trim() || !origemFinal}
              className="flex-1 px-4 py-2 rounded-xl bg-brand-primary text-black text-sm font-bold hover:bg-brand-primary/80 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />} Adicionar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Alarm Sound ───────────────────────────────────────────────
function playAlarmSound() {
  try {
    const ctx = new AudioContext();
    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    // 3 beeps
    playTone(880, 0, 0.15);
    playTone(880, 0.25, 0.15);
    playTone(1100, 0.5, 0.3);
  } catch { /* audio not supported */ }
}

// ── Task Alarm Popup ──────────────────────────────────────────
function TaskAlarmPopup({ tarefa, lead, onDismiss, onOpenLead, onComplete, onReschedule }: {
  tarefa: CRMTarefa; lead?: CRMLead; onDismiss: () => void; onOpenLead?: () => void; onComplete: (imageUrl: string) => void; onReschedule: (novaData: string) => void;
}) {
  const fmtDate = (d: string) => fmtDateSP(d, { year: true });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else { setImagePreview(null); }
  };

  const handleComplete = async () => {
    if (!imageFile) return;
    setUploading(true);
    let url = '';
    try {
      const ext = imageFile.name.split('.').pop() ?? 'png';
      const path = `${tarefa.lead_id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('comercial-prints').upload(path, imageFile);
      if (!error) {
        const { data: urlData } = supabase.storage.from('comercial-prints').getPublicUrl(path);
        url = urlData.publicUrl;
      }
    } catch { /* continue */ }
    setUploading(false);
    onComplete(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="w-[380px] bg-bg-card border-2 border-yellow-500/50 rounded-2xl shadow-[0_0_40px_rgba(234,179,8,0.2)] overflow-hidden"
    >
      {/* Header pulsante */}
      <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell size={18} className="text-yellow-400 animate-bounce" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-400 rounded-full animate-ping" />
          </div>
          <span className="text-sm font-bold text-yellow-400 uppercase tracking-widest">Tarefa Agendada</span>
        </div>
        <button onClick={onDismiss} className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-3">
        <p className="text-base font-bold text-white">{tarefa.titulo}</p>

        <div className="space-y-2">
          {tarefa.data_agendada && (
            <div className="flex items-center gap-2 text-xs">
              <Clock size={13} className="text-yellow-400 flex-shrink-0" />
              <span className="text-gray-400">Horário:</span>
              <span className="text-white font-bold">{fmtDate(tarefa.data_agendada)}</span>
            </div>
          )}
          {tarefa.responsavel && (
            <div className="flex items-center gap-2 text-xs">
              <User size={13} className="text-blue-400 flex-shrink-0" />
              <span className="text-gray-400">Responsável tarefa:</span>
              <span className="text-white font-medium">{tarefa.responsavel}</span>
            </div>
          )}
          {lead && (
            <>
              <div className="flex items-center gap-2 text-xs">
                <Building2 size={13} className="text-brand-primary flex-shrink-0" />
                <span className="text-gray-400">Lead:</span>
                <span className="text-white font-medium">{lead.nome}</span>
              </div>
              {lead.responsavel && lead.responsavel !== tarefa.responsavel && (
                <div className="flex items-center gap-2 text-xs">
                  <Users size={13} className="text-purple-400 flex-shrink-0" />
                  <span className="text-gray-400">Responsável lead:</span>
                  <span className="text-white font-medium">{lead.responsavel}</span>
                </div>
              )}
              {lead.telefone && (
                <div className="flex items-center gap-2 text-xs">
                  <Phone size={13} className="text-gray-500 flex-shrink-0" />
                  <a href={`https://api.whatsapp.com/send?phone=${lead.telefone.replace(/\D/g, '').replace(/^0/, '').replace(/^(?!55)/, '55')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-gray-400 hover:text-brand-primary transition-colors"
                  >{lead.telefone}</a>
                </div>
              )}
            </>
          )}
        </div>

        {/* Painel de reagendamento */}
        {showReschedule ? (
          <div className="pt-1 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">Reagendar tarefa</p>
            <input type="datetime-local" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-yellow-400"
            />
            <div className="flex gap-2">
              <button onClick={async () => {
                if (!rescheduleDate) return;
                setRescheduleSaving(true);
                await onReschedule(rescheduleDate);
                setRescheduleSaving(false);
              }} disabled={!rescheduleDate || rescheduleSaving}
                className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-colors flex items-center justify-center gap-2 ${rescheduleDate ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 cursor-pointer' : 'bg-white/3 border-white/10 text-gray-600 cursor-not-allowed'}`}
              >
                {rescheduleSaving ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />} Confirmar
              </button>
              <button onClick={() => { setShowReschedule(false); setRescheduleDate(''); }}
                className="py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 pt-2">
            {onOpenLead && lead && (
              <button onClick={() => { onOpenLead(); onDismiss(); }}
                className="flex-1 py-2.5 rounded-xl bg-brand-primary/10 border border-brand-primary/30 text-xs font-bold text-brand-primary hover:bg-brand-primary/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ChevronRight size={14} /> Abrir Lead
              </button>
            )}
            <button onClick={() => setShowReschedule(true)}
              className="py-2.5 px-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs font-bold text-yellow-400 hover:text-white hover:bg-yellow-500/20 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Calendar size={13} /> Reagendar
            </button>
            <button onClick={onDismiss}
              className="py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              Depois
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main CRM View ─────────────────────────────────────────────
export default function CRMView({ userSession, teamMembers, openLeadByName, onLeadOpened, onClientCreated }: { userSession: any; teamMembers: TeamMember[]; openLeadByName?: string; onLeadOpened?: () => void; onClientCreated?: () => void }) {
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [tarefas, setTarefas] = useState<CRMTarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [etapaSort, setEtapaSort] = useState<Record<string, 'newest' | 'oldest' | 'more_time' | 'less_time'>>({});
  const LEADS_PER_PAGE = 20;
  const [etapaVisible, setEtapaVisible] = useState<Record<string, number>>({});
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [filtroTag, setFiltroTag] = useState('');
  const isAdmin = (userSession?.role ?? '').toLowerCase() === 'admin';

  // ── Task alarm system ──────────────────────────────────────
  const [alarmTarefas, setAlarmTarefas] = useState<CRMTarefa[]>([]);
  const dismissedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const userName = userSession?.name ?? '';
    if (!userName) return;

    const check = () => {
      const now = new Date();
      const due = tarefas.filter(t => {
        if (t.concluida || !t.data_agendada || dismissedRef.current.has(t.id)) return false;
        const agendada = parseDateSP(t.data_agendada);
        if (agendada > now) return false;
        // Mostrar apenas para responsável pela tarefa ou pela oportunidade
        const lead = leads.find(l => l.id === t.lead_id);
        const isTaskResponsavel = (t.responsavel ?? '').toLowerCase() === userName.toLowerCase();
        const isLeadResponsavel = (lead?.responsavel ?? '').toLowerCase() === userName.toLowerCase();
        return isTaskResponsavel || isLeadResponsavel;
      });

      if (due.length > 0) {
        setAlarmTarefas(prev => {
          const prevIds = new Set(prev.map(t => t.id));
          const newOnes = due.filter(t => !prevIds.has(t.id));
          if (newOnes.length > 0) playAlarmSound();
          return due;
        });
      }
    };

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [tarefas, leads, userSession?.name, isAdmin]);

  const dismissAlarm = (tarefaId: string) => {
    dismissedRef.current.add(tarefaId);
    setAlarmTarefas(prev => prev.filter(t => t.id !== tarefaId));
  };

  const completeAlarm = async (tarefaId: string, imageUrl: string) => {
    const tarefa = tarefas.find(t => t.id === tarefaId);
    await supabase.from('crm_tarefas').update({ concluida: true }).eq('id', tarefaId);
    setTarefas(prev => prev.map(t => t.id === tarefaId ? { ...t, concluida: true } : t));
    setAlarmTarefas(prev => prev.filter(t => t.id !== tarefaId));
    if (tarefa) {
      const now = new Date().toISOString();
      const lead = leads.find(l => l.id === tarefa.lead_id);
      const descricao = tarefa.titulo + (tarefa.data_agendada ? ` (agendada: ${fmtDateSP(tarefa.data_agendada, { year: true })})` : '');
      // 1. crm_atividades (timeline do lead)
      await supabase.from('crm_atividades').insert({
        lead_id: tarefa.lead_id, tipo: 'tarefa', descricao,
        imagem_url: imageUrl || null,
        data_atividade: now, realizado_por: userSession?.name ?? '', created_at: now,
      });
      // 2. comercial_tasks (relatório do responsável pela tarefa)
      const collaborator = tarefa.responsavel || lead?.responsavel || userSession?.name || '';
      try {
        await supabase.from('comercial_tasks').insert({
          id: crypto.randomUUID(), type: 'PreVendas', category: 'Tarefa',
          collaborator, image_url: imageUrl || '',
          completion_time: new Date().toLocaleString('pt-BR', { timeZone: SP_TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          meeting_summary: descricao,
          created_at: now,
        });
      } catch { /* fire-and-forget */ }
    }
  };

  const rescheduleAlarm = async (tarefaId: string, novaData: string) => {
    const tarefa = tarefas.find(t => t.id === tarefaId);
    if (!tarefa) return;
    const novaDataISO = localDatetimeToISO(novaData);
    await supabase.from('crm_tarefas').update({ data_agendada: novaDataISO }).eq('id', tarefaId);
    setTarefas(prev => prev.map(t => t.id === tarefaId ? { ...t, data_agendada: novaDataISO } : t));
    setAlarmTarefas(prev => prev.filter(t => t.id !== tarefaId));
    // Atualizar proxima_reuniao no lead
    const lead = leads.find(l => l.id === tarefa.lead_id);
    if (lead) {
      await supabase.from('crm_leads').update({ proxima_reuniao: novaDataISO, updated_at: new Date().toISOString() }).eq('id', lead.id);
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, proxima_reuniao: novaDataISO } : l));
    }
    // Enviar para webhook agendar-reuniao (atualizar Google Agenda)
    try {
      const webhookBase = import.meta.env.VITE_WEBHOOK_BASE?.replace('/webhook/dashboard', '') ?? 'https://webhook.m2black.com';
      const kanbanResp = await fetch(`${webhookBase}/webhook/agendar-reuniao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_nome: lead?.nome ?? '',
          lead_telefone: lead?.telefone ?? '',
          lead_externo_id: lead?.lead_externo_id ?? lead?.id ?? '',
          closer: tarefa.responsavel || lead?.responsavel || '',
          tipo_reuniao: tarefa.titulo?.includes('R2') ? 'R2' : 'R1',
          data_hora: new Date(novaData).toISOString(),
          duracao_min: 60,
          reagendamento: true,
          bant: { sdr: (lead as any)?.sdr || lead?.responsavel || '' },
        }),
      }).catch(() => null);
      // Fire-and-forget: agendar touchpoints
      try {
        let meetLink = '';
        try { if (kanbanResp?.ok) { const rj = await kanbanResp.json(); meetLink = rj.meet_link ?? ''; } } catch { /* no json */ }
        fetch(`${webhookBase}/webhook/agendar-touchpoints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: lead?.lead_externo_id ?? lead?.id ?? '',
            lead_nome: lead?.nome ?? '',
            lead_telefone: lead?.telefone ?? '',
            data_hora: new Date(novaData).toISOString(),
            meet_link: meetLink,
          }),
        }).catch(() => {});
      } catch { /* silent */ }
    } catch { /* fire-and-forget */ }
    // Sync reuniao_tp → Railway (fire-and-forget)
    if (lead) {
      const currentTP = (lead as any).tp || (lead as any).TP || '';
      const tpMap: Record<string, string> = {'': 'R1', 'R1': 'R2', 'R2': 'R3', 'R3': 'R4+'};
      const agendamentoTP = tpMap[currentTP] || 'R4+';
      const horaKanban = new Date(novaData).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' });
      syncPostgres(lead.lead_externo_id, {
        reuniao_tp: agendamentoTP,
        Data_Reuniao_Marcada: new Date(novaData).toISOString().split('T')[0],
        hora_marcada: horaKanban,
        TP: agendamentoTP,
        closer: tarefa.responsavel || lead.responsavel || null,
      });
    }
  };

  const loadLeads = useCallback(async () => {
    setLoading(true);
    let allLeads: CRMLead[] = [];
    const PAGE_SIZE = 1000;
    const SMALL_PAGE = 100;
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      let query = supabase.from('crm_leads').select('*').is('deletado_em', null).order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
      if (!isAdmin) query = query.eq('responsavel', userSession?.name ?? '');
      const { data, error } = await query;
      if (error) {
        console.warn('[crm_leads] Erro na página', from, '— tentando em lotes menores:', error.message);
        // Tenta buscar a mesma faixa em lotes menores para isolar o registro corrompido
        let smallFrom = from;
        const smallEnd = from + PAGE_SIZE;
        while (smallFrom < smallEnd) {
          let smallQuery = supabase.from('crm_leads').select('*').is('deletado_em', null).order('created_at', { ascending: false }).range(smallFrom, smallFrom + SMALL_PAGE - 1);
          if (!isAdmin) smallQuery = smallQuery.eq('responsavel', userSession?.name ?? '');
          const { data: smallData, error: smallError } = await smallQuery;
          if (smallError) {
            console.warn('[crm_leads] Lote corrompido ignorado:', smallFrom, '-', smallFrom + SMALL_PAGE - 1, smallError.message);
          } else {
            allLeads = [...allLeads, ...(smallData ?? [])];
            if (!smallData || smallData.length < SMALL_PAGE) { hasMore = false; break; }
          }
          smallFrom += SMALL_PAGE;
        }
        from += PAGE_SIZE;
        continue;
      }
      if (!data || data.length < PAGE_SIZE) hasMore = false;
      allLeads = [...allLeads, ...(data ?? [])];
      from += PAGE_SIZE;
    }

    // Deduplica por id — merge-duplicates no Supabase pode gerar duplicatas
    const seen = new Set<string>();
    const unique = allLeads.filter(l => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });

    // Load all tasks (only for active leads) + cleanup orphaned tasks
    const { data: t } = await supabase.from('crm_tarefas').select('*');

    // Para não-admin: também carregar leads que tenham tarefas pendentes atribuídas ao usuário
    // (permite abrir o card via alarme mesmo que o lead pertença a outro responsável)
    if (!isAdmin && t) {
      const loadedIds = new Set(unique.map(l => l.id));
      const extraLeadIds = [...new Set(
        t.filter(task => !task.concluida && (task.responsavel ?? '').toLowerCase() === (userSession?.name ?? '').toLowerCase() && !loadedIds.has(task.lead_id))
          .map(task => task.lead_id)
      )];
      if (extraLeadIds.length > 0) {
        const { data: extraLeads } = await supabase.from('crm_leads').select('*').is('deletado_em', null).in('id', extraLeadIds);
        if (extraLeads) {
          for (const el of extraLeads) {
            if (!seen.has(el.id)) { seen.add(el.id); unique.push(el); }
          }
        }
      }
    }

    setLeads(unique);

    const activeLeadIds = new Set(unique.map(l => l.id));
    const orphanIds = (t ?? []).filter(task => !activeLeadIds.has(task.lead_id)).map(task => task.id);
    if (orphanIds.length > 0) {
      await supabase.from('crm_tarefas').delete().in('id', orphanIds);
    }
    setTarefas((t ?? []).filter(task => activeLeadIds.has(task.lead_id) && !task.concluida));
    setLoading(false);
  }, [isAdmin, userSession?.name]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  useEffect(() => {
    if (openLeadByName && leads.length > 0) {
      const lead = leads.find(l => l.nome.toLowerCase() === openLeadByName.toLowerCase());
      if (lead) setSelectedLead(lead);
      onLeadOpened?.();
    }
  }, [openLeadByName, leads]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(import.meta.env.VITE_SYNC_CRM_WEBHOOK ?? 'https://webhook.m2black.com/webhook/sync-crm-leads', { method: 'POST' });
      await new Promise(r => setTimeout(r, 3000));
      await loadLeads();
    } catch (e) { console.error(e); }
    setSyncing(false);
  };

  const syncEtapaToPostgres = (leadData: CRMLead, updated: Partial<CRMLead>) => {
    if (!updated.etapa && !updated.status) return;
    fetch('https://webhook.m2black.com/webhook/crm-sync-etapa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_externo_id: leadData.lead_externo_id,
        etapa: updated.etapa ?? leadData.etapa,
        status: updated.status ?? leadData.status,
        valor_contrato: updated.valor_contrato ?? leadData.valor_contrato,
        valor_cc: updated.valor_cc ?? leadData.valor_cc,
        valor_mrr: updated.valor_mrr ?? leadData.valor_mrr,
        programa_apresentado: updated.programa_apresentado ?? leadData.programa_apresentado,
        responsavel: updated.responsavel ?? leadData.responsavel,
        motivo_perda: updated.motivo_perda ?? leadData.motivo_perda,
        updated_at: new Date().toISOString(),
      }),
    }).catch(e => console.warn('Sync etapa falhou (não crítico):', e));
  };

  const handleSaveLead = async (updated: Partial<CRMLead>) => {
    if (!selectedLead) return;
    const { error } = await supabase.from('crm_leads').update({ ...updated, updated_at: new Date().toISOString() }).eq('id', selectedLead.id);
    if (error) { console.error(error); return; }
    const merged = { ...selectedLead, ...updated };
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? merged : l));
    setSelectedLead(merged);
    syncEtapaToPostgres(selectedLead, updated);
  };

  const handleDeleteLead = (leadId: string) => {
    setLeads(prev => prev.filter(l => l.id !== leadId));
    setTarefas(prev => prev.filter(t => t.lead_id !== leadId));
    setAlarmTarefas(prev => prev.filter(t => t.lead_id !== leadId));
    setSelectedLead(null);
  };

  const handleNewLead = async (lead: Partial<CRMLead>) => {
    const { data, error } = await supabase
      .from('crm_leads')
      .insert({ ...lead, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) { console.error(error); return; }

    // Registra lead no Railway e obtém lead_externo_id
    let leadFinal = data;
    if (data) {
      try {
        const webhookBase = import.meta.env.VITE_WEBHOOK_BASE?.replace('/webhook/dashboard', '')
          ?? 'https://webhook.m2black.com';
        console.log('[criar-lead-manual] payload:', JSON.stringify({nome: lead.nome, telefone: lead.telefone, responsavel: lead.responsavel}));
        const res = await fetch(`${webhookBase}/webhook/criar-lead-manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: lead.nome,
            email: lead.email ?? '',
            telefone: lead.telefone ?? '',
            area: lead.area ?? '',
            faturamento: lead.faturamento ?? '',
            responsavel: lead.responsavel ?? '',
            anuncio: lead.anuncio ?? lead.origem ?? '',
          }),
        });
        if (res.ok) {
          const json = await res.json();
          console.log('[criar-lead-manual] resposta:', json);
          if (json.lead_externo_id) {
            await supabase
              .from('crm_leads')
              .update({ lead_externo_id: String(json.lead_externo_id) })
              .eq('id', data.id);
            leadFinal = { ...data, lead_externo_id: String(json.lead_externo_id) };
          }
        }
      } catch (e) {
        console.warn('Não foi possível registrar lead no Railway:', e);
      }
      setLeads(prev => [leadFinal, ...prev]);
      console.log('[handleNewLead] leadFinal.lead_externo_id:', leadFinal.lead_externo_id);
    }
  };

  const proximaTarefaByLead = Object.fromEntries(
    tarefas.map(t => [t.lead_id, t]).filter(([, t]) => !(t as CRMTarefa).concluida)
  );

  const responsaveis = [...new Set(leads.map(l => l.responsavel).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const filteredLeads = leads
    .filter(l => {
      if (filtroResponsavel === '__sem__' && l.responsavel) return false;
      if (filtroResponsavel && filtroResponsavel !== '__sem__' && l.responsavel !== filtroResponsavel) return false;
      if (filtroTag && !(l.tags ?? []).includes(filtroTag)) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return l.nome.toLowerCase().includes(q) ||
        (l.telefone ?? '').includes(q) ||
        (l.empresa ?? '').toLowerCase().includes(q) ||
        (l.area ?? '').toLowerCase().includes(q) ||
        (l.responsavel ?? '').toLowerCase().includes(q);
    })
    ;

  const sortLeads = (list: CRMLead[], order: 'newest' | 'oldest' | 'more_time' | 'less_time') => {
    return [...list].sort((a, b) => {
      let diff = 0;
      if (order === 'newest')    diff = new Date(b.created_at || (b as any).data || 0).getTime() - new Date(a.created_at || (a as any).data || 0).getTime();
      else if (order === 'oldest')    diff = new Date(a.created_at || (a as any).data || 0).getTime() - new Date(b.created_at || (b as any).data || 0).getTime();
      else if (order === 'more_time') diff = new Date(a.etapa_desde ?? a.updated_at).getTime() - new Date(b.etapa_desde ?? b.updated_at).getTime();
      else if (order === 'less_time') diff = new Date(b.etapa_desde ?? b.updated_at).getTime() - new Date(a.etapa_desde ?? a.updated_at).getTime();
      if (diff !== 0) return diff;
      // Desempate: lead_externo_id numérico (Facebook IDs são sequenciais — maior = mais recente)
      const aExt = Number(a.lead_externo_id);
      const bExt = Number(b.lead_externo_id);
      if (!isNaN(aExt) && !isNaN(bExt) && aExt !== bExt) {
        return (order === 'oldest' || order === 'more_time') ? aExt - bExt : bExt - aExt;
      }
      // Último desempate: updated_at mais recente primeiro
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  };

  const leadsByEtapa = Object.fromEntries(ETAPAS.map(e => [e.id, sortLeads(filteredLeads.filter(l => l.etapa === e.id), etapaSort[e.id] ?? 'newest')]));

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-brand-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lead..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary"
            />
          </div>
          <span className="text-xs text-gray-600">{filteredLeads.length} leads</span>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && responsaveis.length > 1 && (
            <select value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-brand-primary appearance-none"
            >
              <option value="" className="bg-bg-main">Todos os responsáveis</option>
              <option value="__sem__" className="bg-bg-main">Sem responsável</option>
              {responsaveis.map(r => <option key={r} value={r} className="bg-bg-main">{r}</option>)}
            </select>
          )}
          <select value={filtroTag} onChange={e => setFiltroTag(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-brand-primary appearance-none"
          >
            <option value="" className="bg-bg-main">Todas as etiquetas</option>
            {ALL_TAGS.map(t => <option key={t} value={t} className="bg-bg-main">{t}</option>)}
          </select>
          {isAdmin && (
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white transition-all"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin text-brand-primary' : ''} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          )}
          <button onClick={() => setShowNewLead(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-primary text-black text-xs font-bold hover:bg-brand-primary/80 transition-colors"
          >
            <Plus size={13} /> Novo Lead
          </button>
        </div>
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {ETAPAS.map(etapa => {
            const etapaLeads = leadsByEtapa[etapa.id] ?? [];
            return (
              <div key={etapa.id} className="w-64 flex-shrink-0 bg-[#1a1f2e] rounded-2xl p-2.5 border border-white/5">
                <div className={`flex items-center justify-between mb-3 px-3 py-2.5 rounded-xl bg-white/5 border-l-2 ${etapa.color} sticky top-0 z-10 backdrop-blur-sm`}>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{etapa.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${etapa.badge}`}>{etapaLeads.length}</span>
                    <select
                      value={etapaSort[etapa.id] ?? 'newest'}
                      onChange={e => setEtapaSort(prev => ({ ...prev, [etapa.id]: e.target.value as any }))}
                      className="bg-white/5 border border-white/10 rounded-lg px-1 py-0.5 text-[9px] text-gray-400 focus:outline-none focus:border-brand-primary appearance-none cursor-pointer"
                    >
                      <option value="newest" className="bg-bg-main">Recentes</option>
                      <option value="oldest" className="bg-bg-main">Antigas</option>
                      <option value="more_time" className="bg-bg-main">+ tempo</option>
                      <option value="less_time" className="bg-bg-main">- tempo</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {(() => {
                    const limit = etapaVisible[etapa.id] ?? LEADS_PER_PAGE;
                    const visible = etapaLeads.slice(0, limit);
                    const remaining = etapaLeads.length - limit;
                    return (
                      <>
                        <AnimatePresence>
                          {visible.map(lead => (
                            <LeadCard key={lead.id} lead={lead}
                              proximaTarefa={proximaTarefaByLead[lead.id] as CRMTarefa | undefined}
                              onClick={() => setSelectedLead(lead)}
                            />
                          ))}
                        </AnimatePresence>
                        {remaining > 0 && (
                          <button
                            onClick={() => setEtapaVisible(prev => ({ ...prev, [etapa.id]: limit + LEADS_PER_PAGE }))}
                            className="w-full flex items-center justify-center gap-1 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] text-gray-400 hover:text-white hover:border-white/20 transition-colors"
                          >
                            <ChevronDown size={12} />
                            Ver mais {Math.min(remaining, LEADS_PER_PAGE)} de {remaining}
                          </button>
                        )}
                      </>
                    );
                  })()}
                  {etapaLeads.length === 0 && (
                    <div className="h-16 border border-dashed border-white/5 rounded-xl flex items-center justify-center">
                      <span className="text-[10px] text-gray-700">Vazio</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedLead && (
        <LeadModal lead={selectedLead} onClose={() => setSelectedLead(null)}
          onSave={handleSaveLead} onDelete={handleDeleteLead} userSession={userSession} teamMembers={teamMembers} onClientCreated={onClientCreated}
          onTarefaCreated={(tarefa) => setTarefas(prev => [...prev, tarefa])}
        />
      )}
      {showNewLead && (
        <NewLeadModal onClose={() => setShowNewLead(false)} onSave={handleNewLead} userSession={userSession} teamMembers={teamMembers} />
      )}

      {/* Task Alarm Popups */}
      <div className="pointer-events-none" style={{ position: 'fixed', inset: 0, zIndex: 998 }}>
      <AnimatePresence>
        {alarmTarefas.map((tarefa, i) => {
          const lead = leads.find(l => l.id === tarefa.lead_id);
          return (
            <div key={tarefa.id} style={{ top: `${24 + i * 320}px`, right: '24px', position: 'fixed', zIndex: 999 + i, pointerEvents: 'auto' }} className="pointer-events-auto">
              <TaskAlarmPopup
                tarefa={tarefa}
                lead={lead}
                onDismiss={() => dismissAlarm(tarefa.id)}
                onOpenLead={lead ? () => setSelectedLead(lead) : undefined}
                onComplete={(imageUrl: string) => completeAlarm(tarefa.id, imageUrl)}
                onReschedule={(novaData: string) => rescheduleAlarm(tarefa.id, novaData)}
              />
            </div>
          );
        })}
      </AnimatePresence>
      </div>
    </div>
  );
}
