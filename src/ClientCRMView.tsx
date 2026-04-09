import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Plus, Phone, Mail, DollarSign, User, Tag,
  ChevronDown, X, MessageSquare, Clock, Search, Building2, Trash2, Download,
  Filter, SortAsc, CalendarDays, FileText, CheckCircle2, AlertCircle,
  PhoneCall, Video, Image as ImageIcon, Upload, Bell, Volume2,
  Briefcase, MapPin, Target, TrendingUp, Save, MoreHorizontal,
  Mic, Square, Loader2, ThumbsUp, AlertTriangle, ChevronRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type {
  CrmClientTenant, CrmClientStage, CrmClientLead,
  CrmClientLeadActivity, CrmClientTarefa, Client,
} from './types';
import {
  getAllTenants, getStagesByTenant, getClientLeads,
  createClientLead, updateClientLead, deleteClientLead,
  getLeadActivities, createLeadActivity, deleteTenant,
  getClientTarefas, createClientTarefa, updateClientTarefa, deleteClientTarefa,
} from './lib/database';
import { supabase } from './lib/supabase';

// ── Helpers ─────────────────────────────────────────────────
const SP_TZ = 'America/Sao_Paulo';
const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (iso: string) => {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: SP_TZ }).format(new Date(iso));
};
const fmtDateTime = (iso: string) => {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: SP_TZ }).format(new Date(iso));
};
const localDatetimeToISO = (dt: string) => dt ? dt + ':00-03:00' : '';

const PLAN_COLORS: Record<string, string> = { Pro: '#00FF88', Lite: '#3B82F6', Basic: '#8B5CF6' };

// ── Lead Score do Cliente ─────────────────────────────────
const LEAD_SCORE_GRADE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  B: { bg: 'rgba(212,175,55,0.12)', text: '#d4af37', border: 'rgba(212,175,55,0.3)' },
  C: { bg: 'rgba(96,165,250,0.12)', text: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
  D: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
};

type LeadScoreRespostas = {
  credito_aprovado: string;   // 'sim' | 'nao' | ''
  recurso_proprio: string;    // 'sim' | 'nao' | ''
  renda_familiar: string;     // '1k_3k' | '3k_6k' | '6k_9k' | '9k_12k' | '12k_mais' | ''
  tem_terreno: string;        // 'sim' | 'nao' | ''
  prazo_construir: string;    // '1_mes' | '3_meses' | '6_meses' | '1_ano_mais' | ''
};

const LEAD_SCORE_EMPTY: LeadScoreRespostas = {
  credito_aprovado: '', recurso_proprio: '', renda_familiar: '',
  tem_terreno: '', prazo_construir: '',
};

function calcClientLeadScore(respostas: LeadScoreRespostas): { score: number; grade: string; breakdown: { credito: number; recurso: number; renda: number; terreno: number; prazo: number } } {
  let credito = 0, recurso = 0, renda = 0, terreno = 0, prazo = 0;

  // CRÉDITO APROVADO (0 ou 25)
  if (respostas.credito_aprovado === 'sim') credito = 25;

  // RECURSO PRÓPRIO (0 ou 15)
  if (respostas.recurso_proprio === 'sim') recurso = 15;

  // RENDA FAMILIAR (0-25)
  if (respostas.renda_familiar === '12k_mais') renda = 25;
  else if (respostas.renda_familiar === '9k_12k') renda = 20;
  else if (respostas.renda_familiar === '6k_9k') renda = 15;
  else if (respostas.renda_familiar === '3k_6k') renda = 8;
  else if (respostas.renda_familiar === '1k_3k') renda = 3;

  // TEM TERRENO (0 ou 20)
  if (respostas.tem_terreno === 'sim') terreno = 20;

  // PRAZO (0-15)
  if (respostas.prazo_construir === '1_mes') prazo = 15;
  else if (respostas.prazo_construir === '3_meses') prazo = 12;
  else if (respostas.prazo_construir === '6_meses') prazo = 7;
  else if (respostas.prazo_construir === '1_ano_mais') prazo = 3;

  const score = credito + recurso + renda + terreno + prazo;
  const grade = score >= 70 ? 'A' : score >= 45 ? 'B' : score >= 20 ? 'C' : 'D';
  return { score, grade, breakdown: { credito, recurso, renda, terreno, prazo } };
}

// Helpers pra salvar/ler score por lead (localStorage, chave por tenant)
function getLeadScoreRespostas(tenantId: string, leadId: string): LeadScoreRespostas {
  try {
    const all = JSON.parse(localStorage.getItem(`m2_ls_${tenantId}`) || '{}');
    return all[leadId] || { ...LEAD_SCORE_EMPTY };
  } catch { return { ...LEAD_SCORE_EMPTY }; }
}

function saveLeadScoreRespostas(tenantId: string, leadId: string, respostas: LeadScoreRespostas) {
  try {
    const all = JSON.parse(localStorage.getItem(`m2_ls_${tenantId}`) || '{}');
    all[leadId] = respostas;
    localStorage.setItem(`m2_ls_${tenantId}`, JSON.stringify(all));
  } catch { /* silent */ }
}

const playAlarmSound = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880; osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
  } catch { /* silent */ }
};

// ── Props ───────────────────────────────────────────────────
type Props = {
  clients?: Client[];
  selectedTenantId?: string | null;
  onBack?: () => void;
  tenantId?: string;
  userName?: string;
};

// ── Main Component ──────────────────────────────────────────
export default function ClientCRMView({ clients, selectedTenantId, onBack, tenantId, userName }: Props) {
  const isClientView = !!tenantId;
  const [tenants, setTenants] = useState<CrmClientTenant[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(tenantId ?? selectedTenantId ?? null);
  const [stages, setStages] = useState<CrmClientStage[]>([]);
  const [leads, setLeads] = useState<CrmClientLead[]>([]);
  const [tarefas, setTarefas] = useState<CrmClientTarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterResponsavel, setFilterResponsavel] = useState('');
  const [filterEtiqueta, setFilterEtiqueta] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'value'>('recent');
  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<CrmClientLead | null>(null);
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [alarmTarefa, setAlarmTarefa] = useState<CrmClientTarefa | null>(null);
  const dismissedAlarms = useRef(new Set<string>());

  // ── Load tenants ─────
  useEffect(() => {
    if (!activeTenantId && !isClientView) {
      setLoading(true);
      getAllTenants().then(setTenants).catch(console.error).finally(() => setLoading(false));
    }
  }, [activeTenantId, isClientView]);

  // ── Load stages + leads + tarefas ─────
  useEffect(() => {
    if (!activeTenantId) return;
    setLoading(true);
    Promise.all([
      getStagesByTenant(activeTenantId),
      getClientLeads(activeTenantId),
      getClientTarefas(activeTenantId),
    ])
      .then(([s, l, t]) => { setStages(s); setLeads(l); setTarefas(t); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTenantId]);

  // ── Task alarm check ─────
  useEffect(() => {
    if (!activeTenantId || tarefas.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const pending = tarefas.find(t =>
        !t.concluida &&
        !dismissedAlarms.current.has(t.id) &&
        new Date(t.dataAgendada).getTime() <= now
      );
      if (pending) {
        setAlarmTarefa(pending);
        playAlarmSound();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [tarefas, activeTenantId]);

  // ── Client lookup ─────
  const clientMap = useMemo(() => {
    const m = new Map<string, Client>();
    (clients ?? []).forEach(c => m.set(c.id, c));
    return m;
  }, [clients]);

  const activeClient = useMemo(() => {
    if (!activeTenantId) return null;
    const t = tenants.find(t => t.id === activeTenantId);
    return t ? clientMap.get(t.clientId) ?? null : null;
  }, [activeTenantId, tenants, clientMap]);

  // ── Unique values for filters ─────
  const uniqueResponsaveis = useMemo(() => [...new Set(leads.map(l => l.responsavel).filter(Boolean))], [leads]);
  const uniqueEtiquetas = useMemo(() => [...new Set(leads.flatMap(l => l.etiquetas))], [leads]);

  // ── Filtered + sorted leads ─────
  const filteredLeads = useMemo(() => {
    let result = leads;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.nome.toLowerCase().includes(q) || l.telefone.includes(q) ||
        l.email.toLowerCase().includes(q) || l.empresa.toLowerCase().includes(q)
      );
    }
    if (filterResponsavel) result = result.filter(l => l.responsavel === filterResponsavel);
    if (filterEtiqueta) result = result.filter(l => l.etiquetas.includes(filterEtiqueta));

    // Sort
    if (sortBy === 'oldest') result = [...result].sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime());
    else if (sortBy === 'value') result = [...result].sort((a, b) => b.ticketEstimado - a.ticketEstimado);
    else result = [...result].sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());

    return result;
  }, [leads, searchQuery, filterResponsavel, filterEtiqueta, sortBy]);

  const leadsByStage = useMemo(() => {
    const m = new Map<string, CrmClientLead[]>();
    stages.forEach(s => m.set(s.id, []));
    filteredLeads.forEach(l => { m.get(l.stageId)?.push(l); });
    return m;
  }, [filteredLeads, stages]);

  const tarefasByLead = useMemo(() => {
    const m = new Map<string, CrmClientTarefa[]>();
    tarefas.forEach(t => {
      if (!m.has(t.leadId)) m.set(t.leadId, []);
      m.get(t.leadId)!.push(t);
    });
    return m;
  }, [tarefas]);

  // ── Handlers ─────
  const handleOpenTenant = (id: string) => setActiveTenantId(id);
  const handleBackToList = () => { setActiveTenantId(null); setStages([]); setLeads([]); setTarefas([]); setSearchQuery(''); onBack?.(); };

  const handleCreateLead = async (data: Omit<CrmClientLead, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    const newLead = await createClientLead(data);
    setLeads(prev => [newLead, ...prev]);
    setShowNewLeadModal(false);
  };

  const handleUpdateLead = async (lead: CrmClientLead) => {
    const updated = await updateClientLead(lead);
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
    setSelectedLead(updated);
  };

  const handleDeleteLead = async (id: string) => {
    await deleteClientLead(id);
    setLeads(prev => prev.filter(l => l.id !== id));
    setSelectedLead(null);
  };

  const handleCreateTarefa = async (t: Omit<CrmClientTarefa, 'id' | 'criadoEm'>) => {
    const newT = await createClientTarefa(t);
    setTarefas(prev => [...prev, newT]);
    return newT;
  };

  const handleUpdateTarefa = async (t: CrmClientTarefa) => {
    const updated = await updateClientTarefa(t);
    setTarefas(prev => prev.map(x => x.id === updated.id ? updated : x));
    return updated;
  };

  // ── Loading ─────
  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  // ══════════════════════════════════════════════════════════
  // MODE 1: Tenant List (admin M2 only)
  // ══════════════════════════════════════════════════════════
  if (!activeTenantId) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold text-white">Área do Cliente</h1>
        {tenants.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg">Nenhum CRM ativo</p>
            <p className="text-sm mt-1">Ative o CRM para um cliente na aba de configurações.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tenants.map(tenant => {
              const client = clientMap.get(tenant.clientId);
              const planColor = client ? PLAN_COLORS[client.plan] ?? '#6B7280' : '#6B7280';
              return (
                <motion.div key={tenant.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-[#0d1117]/80 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white truncate">{client?.name ?? tenant.slug}</h3>
                      {client && <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: planColor + '20', color: planColor }}>{client.plan}</span>}
                    </div>
                    <button onClick={e => { e.stopPropagation(); setDeletingTenantId(tenant.id); }} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all" title="Excluir CRM"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-white/50 mb-4"><User className="w-4 h-4" /><span>{client?.responsible ?? '—'}</span></div>
                  <div className="flex gap-2">
                    <button onClick={() => handleOpenTenant(tenant.id)} className="flex-1 bg-brand-primary text-black font-bold rounded-xl px-4 py-2 text-sm hover:brightness-110 transition-all">Abrir CRM</button>
                    {!isClientView && (
                      <button onClick={async e => {
                        e.stopPropagation();
                        try {
                          const stgs = await getStagesByTenant(tenant.id);
                          const lds = await getClientLeads(tenant.id);
                          const stageMap = Object.fromEntries(stgs.map(st => [st.id, st.nome]));
                          const wb = XLSX.utils.book_new();
                          const rows = lds.map(l => ({ Nome: l.nome, Telefone: l.telefone, Email: l.email, Segmento: l.segmento, Empresa: l.empresa, 'Ticket Estimado': l.ticketEstimado, Responsável: l.responsavel, Etapa: stageMap[l.stageId] || '—', Contrato: l.valorContrato, 'Cash Collect': l.valorCc, MRR: l.valorMrr, Etiquetas: (l.etiquetas || []).join(', '), 'Criado em': l.criadoEm ? fmtDate(l.criadoEm) : '' }));
                          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Info: 'Nenhum lead' }]), 'Leads');
                          XLSX.writeFile(wb, `CRM_${(client?.name || tenant.slug || 'CRM').replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
                        } catch { alert('Erro ao exportar.'); }
                      }} className="bg-white/5 border border-white/10 text-white/50 rounded-xl px-3 py-2 hover:bg-white/10 hover:text-white transition-all" title="Exportar Excel"><Download size={16} /></button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Delete confirmation modal */}
        <AnimatePresence>
          {deletingTenantId && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => setDeletingTenantId(null)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center"><Trash2 size={20} className="text-red-400" /></div><div><h3 className="font-bold text-white">Excluir CRM</h3><p className="text-xs text-gray-500">Esta ação não pode ser desfeita</p></div></div>
                <p className="text-sm text-gray-400">Todos os dados deste CRM serão excluídos permanentemente.</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeletingTenantId(null)} className="flex-1 bg-white/5 text-gray-400 py-2.5 rounded-xl text-sm hover:bg-white/10">Cancelar</button>
                  <button onClick={async () => { try { await deleteTenant(deletingTenantId); setTenants(prev => prev.filter(t => t.id !== deletingTenantId)); setDeletingTenantId(null); } catch { alert('Erro ao excluir.'); } }} className="flex-1 bg-red-500/20 text-red-400 font-bold py-2.5 rounded-xl text-sm hover:bg-red-500/30">Excluir</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // MODE 2: Kanban View
  // ══════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5 flex-wrap">
        {!isClientView && <button onClick={handleBackToList} className="p-2 rounded-lg hover:bg-white/5"><ArrowLeft className="w-5 h-5 text-white/60" /></button>}
        <h1 className="text-xl font-bold text-white truncate">{activeClient?.name ?? 'CRM'}</h1>

        <div className="flex-1 max-w-sm relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input type="text" placeholder="Buscar leads..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-primary" />
        </div>

        {/* Filters */}
        <select value={filterResponsavel} onChange={e => setFilterResponsavel(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-brand-primary">
          <option value="">Todos os responsáveis</option>
          {uniqueResponsaveis.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <select value={filterEtiqueta} onChange={e => setFilterEtiqueta(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-brand-primary">
          <option value="">Todas as etiquetas</option>
          {uniqueEtiquetas.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-brand-primary">
          <option value="recent">Mais recentes</option>
          <option value="oldest">Mais antigos</option>
          <option value="value">Maior valor</option>
        </select>

        <button onClick={() => setShowNewLeadModal(true)} className="flex items-center gap-2 bg-brand-primary text-black font-bold rounded-xl px-4 py-2 text-sm hover:brightness-110">
          <Plus className="w-4 h-4" /> Novo Lead
        </button>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {stages.map(stage => {
            const stageLeads = leadsByStage.get(stage.id) ?? [];
            return (
              <div key={stage.id} className="w-72 bg-[#1a1f2e] rounded-2xl p-2.5 border border-white/5 flex flex-col" style={{ borderTopColor: stage.cor, borderTopWidth: 3 }}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-sm font-semibold text-white">{stage.nome}</h3>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: stage.cor + '20', color: stage.cor }}>{stageLeads.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                  {stageLeads.map((lead, idx) => {
                    const leadTarefas = tarefasByLead.get(lead.id) ?? [];
                    const nextTask = leadTarefas.find(t => !t.concluida);
                    return (
                      <React.Fragment key={lead.id}>
                        {idx > 0 && <div className="flex justify-center py-1"><ChevronDown size={14} className="text-white/20" /></div>}
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
                          onClick={() => setSelectedLead(lead)} className="bg-[#161b26] border border-white/8 rounded-xl p-3 cursor-pointer hover:border-white/15 transition-colors space-y-1.5">
                          <p className="text-sm font-semibold text-white truncate">{lead.nome}</p>
                          {/* Lead Score badge */}
                          {(() => {
                            const respostas = getLeadScoreRespostas(activeTenantId!, lead.id);
                            const hasScore = Object.values(respostas).some(v => v !== '');
                            if (!hasScore) return null;
                            const ls = calcClientLeadScore(respostas);
                            const gs = LEAD_SCORE_GRADE_STYLE[ls.grade] || LEAD_SCORE_GRADE_STYLE.D;
                            return (
                              <div className="flex items-center gap-1.5 mt-0.5 mb-0.5">
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: gs.bg, color: gs.text, border: `1px solid ${gs.border}` }}>
                                  {ls.grade} ({ls.score})
                                </span>
                              </div>
                            );
                          })()}
                          {lead.empresa && <div className="flex items-center gap-1.5 text-xs text-white/40"><Building2 className="w-3 h-3" /><span className="truncate">{lead.empresa}</span></div>}
                          {lead.telefone && <div className="flex items-center gap-1.5 text-xs text-white/50"><Phone className="w-3 h-3" /><span className="truncate">{lead.telefone}</span></div>}
                          {lead.responsavel && <div className="flex items-center gap-1.5 text-xs text-white/40"><User className="w-3 h-3" /><span>{lead.responsavel}</span></div>}
                          {(lead.valorContrato > 0 || lead.ticketEstimado > 0) && (
                            <div className="flex items-center gap-1.5 text-xs text-brand-primary font-semibold"><DollarSign className="w-3 h-3" /><span>{fmtBRL(lead.valorContrato || lead.ticketEstimado)}</span></div>
                          )}
                          {lead.valorCc > 0 && <div className="text-xs text-yellow-400">CC: {fmtBRL(lead.valorCc)}</div>}
                          {lead.etiquetas.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">{lead.etiquetas.map(tag => <span key={tag} className="px-1.5 py-0.5 text-[10px] rounded-md bg-white/5 text-white/50 border border-white/10">{tag}</span>)}</div>
                          )}
                          {nextTask && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-400 mt-1"><CalendarDays className="w-3 h-3" /><span className="truncate">{nextTask.titulo} - {fmtDateTime(nextTask.dataAgendada)}</span></div>
                          )}
                          <div className="text-[9px] text-gray-600 pt-1 mt-1 border-t border-white/5">{fmtDate(lead.criadoEm)}</div>
                        </motion.div>
                      </React.Fragment>
                    );
                  })}
                  {stageLeads.length === 0 && <div className="text-center py-8 text-white/20 text-xs">Sem leads</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lead Modal */}
      <AnimatePresence>
        {selectedLead && (
          <LeadModal lead={selectedLead} stages={stages} tenantId={activeTenantId} tarefas={tarefasByLead.get(selectedLead.id) ?? []}
            onClose={() => setSelectedLead(null)} onUpdate={handleUpdateLead} onDelete={handleDeleteLead}
            onCreateTarefa={handleCreateTarefa} onUpdateTarefa={handleUpdateTarefa}
            onImageClick={url => setLightboxUrl(url)} userName={userName} />
        )}
      </AnimatePresence>

      {/* New Lead Modal */}
      <AnimatePresence>
        {showNewLeadModal && <NewLeadModal tenantId={activeTenantId} stages={stages} onClose={() => setShowNewLeadModal(false)} onCreate={handleCreateLead} />}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-8 cursor-pointer" onClick={() => setLightboxUrl(null)}>
            <img src={lightboxUrl} alt="Preview" className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Alarm */}
      <AnimatePresence>
        {alarmTarefa && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-[300] bg-[#0d1117] border-2 border-amber-500 rounded-2xl p-5 w-96 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center"><Bell size={20} className="text-amber-400" /></div>
              <div><h3 className="font-bold text-white text-sm">Tarefa Agendada</h3><p className="text-xs text-amber-400">{fmtDateTime(alarmTarefa.dataAgendada)}</p></div>
            </div>
            <p className="text-sm text-white/80 mb-4">{alarmTarefa.titulo}</p>
            <div className="flex gap-2">
              <button onClick={() => { dismissedAlarms.current.add(alarmTarefa.id); setAlarmTarefa(null); }} className="flex-1 bg-white/5 text-gray-400 py-2 rounded-xl text-sm hover:bg-white/10">Depois</button>
              <button onClick={() => {
                const lead = leads.find(l => l.id === alarmTarefa.leadId);
                if (lead) { setSelectedLead(lead); }
                dismissedAlarms.current.add(alarmTarefa.id);
                setAlarmTarefa(null);
              }} className="flex-1 bg-brand-primary text-black font-bold py-2 rounded-xl text-sm hover:brightness-110">Abrir Lead</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// LeadModal — 3 tabs: Info | Timeline | Tarefas
// ══════════════════════════════════════════════════════════════
type LeadModalProps = {
  lead: CrmClientLead; stages: CrmClientStage[]; tenantId: string;
  tarefas: CrmClientTarefa[];
  onClose: () => void; onUpdate: (l: CrmClientLead) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCreateTarefa: (t: Omit<CrmClientTarefa, 'id' | 'criadoEm'>) => Promise<CrmClientTarefa>;
  onUpdateTarefa: (t: CrmClientTarefa) => Promise<CrmClientTarefa>;
  onImageClick: (url: string) => void;
  userName?: string;
};

function LeadModal({ lead, stages, tenantId, tarefas, onClose, onUpdate, onDelete, onCreateTarefa, onUpdateTarefa, onImageClick, userName }: LeadModalProps) {
  const [activeTab, setActiveTab] = useState<'detalhes' | 'leadscore' | 'atendimentos' | 'tarefas' | 'demandas' | 'notas'>('detalhes');
  const [nota, setNota] = useState(lead.observacoes || '');
  const [form, setForm] = useState({ ...lead });
  const [saving, setSaving] = useState(false);
  const [activities, setActivities] = useState<CrmClientLeadActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Activity form
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [actType, setActType] = useState<'ligacao' | 'reuniao'>('ligacao');
  const [actSubtype, setActSubtype] = useState('');
  const [actContent, setActContent] = useState('');
  const [actImage, setActImage] = useState<File | null>(null);
  const [actImagePreview, setActImagePreview] = useState('');
  const [sendingActivity, setSendingActivity] = useState(false);

  // Audio recording
  const [showRecPanel, setShowRecPanel] = useState(false);
  const [recState, setRecState] = useState<'idle' | 'recording' | 'processing' | 'done'>('idle');
  const [recSeconds, setRecSeconds] = useState(0);
  const [recResult, setRecResult] = useState<any>(null);
  const [recError, setRecError] = useState('');
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg' });
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start(1000);
      mediaRecRef.current = mr;
      setRecState('recording');
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch { setRecError('Não foi possível acessar o microfone.'); }
  };

  const stopAndAnalyze = async () => {
    if (!mediaRecRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setRecState('processing');
    mediaRecRef.current.stop();
    mediaRecRef.current.stream.getTracks().forEach(t => t.stop());
    await new Promise<void>(res => { if (mediaRecRef.current) mediaRecRef.current.onstop = () => res(); setTimeout(res, 1500); });

    try {
      const blob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0]?.type || 'audio/webm' });
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
      const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
      const prompt = `Você é o Taleco, consultor comercial da M2 Black especializado em marketing para construção civil.
Analise este áudio de ligação/reunião e retorne JSON válido no formato:
{
  "transcricao": "transcrição fiel completa",
  "tipo_ligacao": "ligação" ou "reunião",
  "servico_identificado": "Ex: Reforma, Construção Financiada, Projetos ou Outro",
  "dor_encontrada": true/false,
  "momento_uau": true/false,
  "resumo": "resumo em 2-3 linhas",
  "nota_geral": número de 1 a 10,
  "acertos": ["acerto 1","acerto 2","acerto 3"],
  "melhorias": ["melhoria 1","melhoria 2","melhoria 3"],
  "proximos_passos": ["passo 1","passo 2"],
  "comentario_taleco": "comentário pessoal e direto do Taleco para o vendedor, no estilo mentor"
}
Retorne APENAS o JSON, sem markdown, sem explicação.`;

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: blob.type, data: base64 } }, { text: prompt }] }] }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'Erro Gemini');
      let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      raw = raw.replace(/```json|```/g, '').trim();
      const result = JSON.parse(raw);
      setRecResult({ ...result, duracao_segundos: recSeconds });

      // Salva em analises_ligacao com lead_id
      await supabase.from('analises_ligacao').insert({
        tenant_id: tenantId, lead_id: lead.id,
        duracao_segundos: recSeconds, tipo_ligacao: result.tipo_ligacao,
        servico_identificado: result.servico_identificado,
        dor_encontrada: result.dor_encontrada, momento_uau: result.momento_uau,
        resumo: result.resumo, acertos: result.acertos, melhorias: result.melhorias,
        proximos_passos: result.proximos_passos, nota_geral: result.nota_geral,
        comentario_taleco: result.comentario_taleco, transcricao: result.transcricao,
      });

      // Salva como atividade na timeline
      const act = await createLeadActivity({
        leadId: lead.id, tenantId, tipo: 'analise_audio',
        subtipo: result.tipo_ligacao,
        conteudo: `**${result.resumo}**\n\n✅ Acertos: ${(result.acertos || []).join(' • ')}\n⚠️ Melhorias: ${(result.melhorias || []).join(' • ')}\n\n💬 Taleco: ${result.comentario_taleco}`,
        autor: userName || 'Usuário',
        imagemUrl: '', dados: { analise: result },
      });
      setActivities(prev => [act, ...prev]);
      setRecState('done');
    } catch (err: any) {
      setRecError(err.message || 'Erro ao processar áudio.');
      setRecState('idle');
    }
  };

  const fmtRecTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // Task form
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDate, setTaskDate] = useState('');
  const [taskResponsavel, setTaskResponsavel] = useState('');

  // Completing task
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [taskCompleteImage, setTaskCompleteImage] = useState<File | null>(null);

  // Lead Score
  const [lsRespostas, setLsRespostas] = useState<LeadScoreRespostas>(() => getLeadScoreRespostas(tenantId, lead.id));
  const [showScoreForm, setShowScoreForm] = useState(false);

  const handleSaveScore = (respostas: LeadScoreRespostas) => {
    saveLeadScoreRespostas(tenantId, lead.id, respostas);
    setLsRespostas(respostas);
    setShowScoreForm(false);
  };

  // Checklist de pontos de contato (5 contatos)
  const touchStorageKey = `m2_touch_${lead.id}`;
  const [touchpoints, setTouchpoints] = useState<boolean[]>(() => {
    try { return JSON.parse(localStorage.getItem(`m2_touch_${lead.id}`) || '[false,false,false,false,false]'); } catch { return [false, false, false, false, false]; }
  });
  const toggleTouchpoint = (idx: number) => {
    const updated = [...touchpoints];
    updated[idx] = !updated[idx];
    setTouchpoints(updated);
    localStorage.setItem(touchStorageKey, JSON.stringify(updated));
  };

  // Modal de motivo de perda
  const [showPerdaModal, setShowPerdaModal] = useState(false);
  const [motivoPerda, setMotivoPerda] = useState(form.motivoPerda || '');

  // Demandas pós-venda (localStorage MVP)
  const demandasStorageKey = `m2_demandas_${lead.id}`;
  const [demandas, setDemandasLocal] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(`m2_demandas_${lead.id}`) || '{}'); } catch { return {}; }
  });
  const toggleDemanda = (key: string) => {
    const updated = { ...demandas, [key]: !demandas[key] };
    setDemandasLocal(updated);
    localStorage.setItem(demandasStorageKey, JSON.stringify(updated));
  };

  useEffect(() => { setForm({ ...lead }); }, [lead]);

  useEffect(() => {
    if (activeTab === 'atendimentos') {
      setLoadingActivities(true);
      getLeadActivities(lead.id).then(setActivities).catch(console.error).finally(() => setLoadingActivities(false));
    }
  }, [activeTab, lead.id]);

  const handleSave = async () => { setSaving(true); try { await onUpdate(form); } finally { setSaving(false); } };

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `crm-client/${tenantId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('comercial-prints').upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from('comercial-prints').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmitActivity = async () => {
    if (!actContent.trim() && !actImage) return;
    setSendingActivity(true);
    try {
      let imageUrl = '';
      if (actImage) imageUrl = await uploadImage(actImage);
      const activity = await createLeadActivity({
        leadId: lead.id, tenantId, tipo: actType, subtipo: actSubtype,
        conteudo: actContent.trim(), autor: userName || 'Usuário',
        imagemUrl: imageUrl, dados: {},
      });
      setActivities(prev => [activity, ...prev]);
      // Also register stage change if needed
      if (actType === 'reuniao' && actSubtype === 'realizada') {
        const rmRealizada = stages.find(s => s.nome.toLowerCase().includes('realizada'));
        if (rmRealizada && form.stageId !== rmRealizada.id) {
          const updated = { ...form, stageId: rmRealizada.id };
          setForm(updated);
          await onUpdate(updated);
        }
      }
      setShowActivityForm(false); setActContent(''); setActImage(null); setActImagePreview(''); setActSubtype('');
    } catch (err) { console.error('Erro:', err); alert('Erro ao registrar atividade.'); }
    finally { setSendingActivity(false); }
  };

  const handleCreateTask = async () => {
    if (!taskTitle.trim() || !taskDate) return;
    await onCreateTarefa({
      tenantId, leadId: lead.id, titulo: taskTitle.trim(),
      dataAgendada: localDatetimeToISO(taskDate),
      responsavel: taskResponsavel || userName || '',
      concluida: false, imagemUrl: '',
    });
    // Also create activity
    await createLeadActivity({
      leadId: lead.id, tenantId, tipo: 'tarefa', subtipo: 'agendada',
      conteudo: `Tarefa agendada: ${taskTitle.trim()}`, autor: userName || 'Usuário',
      imagemUrl: '', dados: {},
    });
    setShowTaskForm(false); setTaskTitle(''); setTaskDate(''); setTaskResponsavel('');
  };

  const handleCompleteTask = async (tarefa: CrmClientTarefa) => {
    try {
      let imageUrl = '';
      if (taskCompleteImage) imageUrl = await uploadImage(taskCompleteImage);
      await onUpdateTarefa({ ...tarefa, concluida: true, imagemUrl: imageUrl });
      await createLeadActivity({
        leadId: lead.id, tenantId, tipo: 'tarefa', subtipo: 'concluida',
        conteudo: `Tarefa concluída: ${tarefa.titulo}`, autor: userName || 'Usuário',
        imagemUrl: imageUrl, dados: {},
      });
      setCompletingTaskId(null); setTaskCompleteImage(null);
    } catch { alert('Erro ao concluir tarefa.'); }
  };

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-primary transition-colors';

  const TABS = [
    { id: 'detalhes' as const, label: 'Detalhes' },
    { id: 'leadscore' as const, label: 'Lead Score' },
    { id: 'atendimentos' as const, label: 'Atendimentos' },
    { id: 'tarefas' as const, label: 'Tarefas' },
    { id: 'demandas' as const, label: 'Checklist Vendas' },
    { id: 'notas' as const, label: 'Notas' },
  ];

  const TIPO_BADGES: Record<string, string> = {
    comentario: 'bg-blue-500/20 text-blue-400', ligacao: 'bg-green-500/20 text-green-400',
    reuniao: 'bg-purple-500/20 text-purple-400', tarefa: 'bg-amber-500/20 text-amber-400',
    email: 'bg-pink-500/20 text-pink-400', movimentacao: 'bg-cyan-500/20 text-cyan-400',
    analise_audio: 'bg-brand-primary/20 text-brand-primary',
  };

  const currentStage = stages.find(s => s.id === form.stageId);

  const handleMoveToStatus = async (status: 'ganho' | 'perdido' | 'congelado') => {
    const statusStage = stages.find(s => s.nome.toLowerCase().includes(status === 'ganho' ? 'fech' : status === 'perdido' ? 'perd' : 'conge'));
    const updated = { ...form, status, stageId: statusStage?.id ?? form.stageId };
    setForm(updated);
    await onUpdate(updated);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.97, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 16 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden shadow-2xl">

        {/* ── HEADER ── */}
        <div className="px-6 pt-5 pb-3 border-b border-white/5 flex-shrink-0">
          <div className="flex items-start gap-4">
            {/* Nome editável */}
            <input
              className="flex-1 bg-transparent text-xl font-bold text-white placeholder-white/30 border-b border-transparent focus:border-brand-primary focus:outline-none pb-1 transition-colors"
              value={form.nome}
              onChange={e => setForm({ ...form, nome: e.target.value })}
              onBlur={handleSave}
            />
            {/* Botões de status */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {form.telefone && (
                <>
                  <button onClick={async () => {
                    window.open(`tel:${form.telefone}`, '_blank');
                    const act = await createLeadActivity({
                      leadId: lead.id, tenantId, tipo: 'ligacao', subtipo: 'Iniciada',
                      conteudo: `Ligação iniciada para ${form.nome} (${form.telefone})`,
                      autor: userName || 'Usuário', imagemUrl: '', dados: {},
                    });
                    setActivities(prev => [act, ...prev]);
                  }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                    <PhoneCall className="w-3.5 h-3.5" /> Ligar
                  </button>
                  <button onClick={async () => {
                    const phone = (form.telefone || '').replace(/\D/g, '');
                    window.open(`https://wa.me/55${phone}`, '_blank');
                    const act = await createLeadActivity({
                      leadId: lead.id, tenantId, tipo: 'ligacao', subtipo: 'WhatsApp',
                      conteudo: `WhatsApp aberto para ${form.nome} (${form.telefone})`,
                      autor: userName || 'Usuário', imagemUrl: '', dados: {},
                    });
                    setActivities(prev => [act, ...prev]);
                  }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors">
                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                  </button>
                </>
              )}
              <button onClick={() => handleMoveToStatus('ganho')}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors">
                Ganho
              </button>
              <button onClick={() => handleMoveToStatus('congelado')}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                Congelar
              </button>
              <button onClick={() => setShowPerdaModal(true)}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                Perda
              </button>
              <button onClick={onClose} className="ml-2 p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Barra de etapas horizontal */}
          <div className="flex items-center gap-0 mt-4 overflow-x-auto pb-1">
            {stages.map((stage, i) => {
              const isCurrent = form.stageId === stage.id;
              const currentIdx = stages.findIndex(s => s.id === form.stageId);
              const isPast = i < currentIdx;
              return (
                <button key={stage.id} onClick={async () => { const updated = { ...form, stageId: stage.id }; setForm(updated); await onUpdate(updated); }}
                  className="flex items-center flex-shrink-0">
                  <div className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap transition-all ${
                    isCurrent ? 'text-black bg-brand-primary' :
                    isPast ? 'text-brand-primary/60 bg-brand-primary/10' :
                    'text-white/30 bg-white/5 hover:text-white/60'
                  } ${i === 0 ? 'rounded-l-lg' : ''} ${i === stages.length - 1 ? 'rounded-r-lg' : ''}`}>
                    {stage.nome}
                  </div>
                  {i < stages.length - 1 && (
                    <div className={`w-4 h-4 -mx-0.5 relative flex-shrink-0 ${isCurrent || isPast ? 'text-brand-primary/40' : 'text-white/10'}`}
                      style={{ clipPath: 'polygon(0 0, 75% 50%, 0 100%)', background: isCurrent ? 'rgba(0,255,136,0.15)' : isPast ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.03)' }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Sub-header: responsável + empresa */}
          <div className="flex items-center gap-6 mt-3 text-xs text-white/40">
            {form.responsavel && <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {form.responsavel}</span>}
            {form.empresa && <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {form.empresa}</span>}
            {form.telefone && <span className="flex items-center gap-1.5"><PhoneCall className="w-3.5 h-3.5" /> {form.telefone}</span>}
            {form.ticketEstimado > 0 && <span className="flex items-center gap-1.5 text-brand-primary/70"><DollarSign className="w-3.5 h-3.5" /> R$ {form.ticketEstimado.toLocaleString('pt-BR')}</span>}
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-0 px-6 border-b border-white/5 flex-shrink-0">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === tab.id ? 'border-brand-primary text-brand-primary' : 'border-transparent text-white/40 hover:text-white/70'}`}>
              {tab.label}
              {tab.id === 'tarefas' && tarefas.filter(t => !t.concluida).length > 0 && (
                <span className="ml-1.5 bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{tarefas.filter(t => !t.concluida).length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── DETALHES TAB ── */}
          {activeTab === 'detalhes' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-white/40 mb-1">Nome</label><input className={inputCls} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
                <div><label className="block text-xs text-white/40 mb-1">Etapa</label><select className={inputCls} style={{ backgroundColor: '#0d1117', color: '#e6e6e6' }} value={form.stageId} onChange={e => setForm({ ...form, stageId: e.target.value })}>{stages.map(s => <option key={s.id} value={s.id} style={{ backgroundColor: '#0d1117', color: '#e6e6e6' }}>{s.nome}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs text-white/40 mb-1">Telefone</label><input className={inputCls} value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></div>
                <div><label className="block text-xs text-white/40 mb-1">Email</label><input className={inputCls} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div><label className="block text-xs text-white/40 mb-1">Origem</label><input className={inputCls} value={form.origem} onChange={e => setForm({ ...form, origem: e.target.value })} /></div>

              {/* Financeiro */}
              <div className="border-t border-white/5 pt-4 mt-4">
                <h4 className="text-xs font-bold text-brand-primary uppercase mb-3">Financeiro</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="block text-xs text-white/40 mb-1">Contrato (R$)</label><input type="number" className={inputCls} value={form.valorContrato || ''} onChange={e => setForm({ ...form, valorContrato: +e.target.value })} /></div>
                  <div><label className="block text-xs text-white/40 mb-1">Entrada (R$)</label><input type="number" className={inputCls} value={form.valorCc || ''} onChange={e => setForm({ ...form, valorCc: +e.target.value })} /></div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Forma de Pagamento</label>
                    <select className={inputCls} style={{ backgroundColor: '#0d1117', color: '#e6e6e6' }} value={(form as any).formaPagamento || ''} onChange={e => setForm({ ...form, formaPagamento: e.target.value } as any)}>
                      <option value="" style={{ backgroundColor: '#0d1117', color: '#9ca3af' }}>Selecione...</option>
                      <option value="boleto" style={{ backgroundColor: '#0d1117', color: '#e6e6e6' }}>Boleto</option>
                      <option value="cartao" style={{ backgroundColor: '#0d1117', color: '#e6e6e6' }}>Cartão de Crédito</option>
                      <option value="financiamento" style={{ backgroundColor: '#0d1117', color: '#e6e6e6' }}>Financiamento</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Descrição / UTMs */}
              <div className="border-t border-white/5 pt-4 mt-4">
                <label className="block text-xs text-white/40 mb-1">Descrição <span className="text-white/20">— UTMs, tracking, observações gerais</span></label>
                <textarea rows={8} className={inputCls + ' resize-y font-mono text-xs'} placeholder="Cole aqui as UTMs, parâmetros de tracking, observações do lead..."
                  value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="bg-brand-primary text-black font-bold rounded-xl px-6 py-2 text-sm hover:brightness-110 disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
                <button onClick={() => { if (confirm('Excluir este lead?')) onDelete(lead.id); }} className="text-sm text-red-400 hover:text-red-300">Excluir lead</button>
              </div>
            </div>
          )}

          {/* ── LEAD SCORE TAB ── */}
          {activeTab === 'leadscore' && (() => {
            const hasScore = Object.values(lsRespostas).some(v => v !== '');
            const ls = calcClientLeadScore(lsRespostas);
            const gs = LEAD_SCORE_GRADE_STYLE[ls.grade] || LEAD_SCORE_GRADE_STYLE.D;
            const bars = [
              { label: 'Crédito Aprovado', value: ls.breakdown.credito, max: 25 },
              { label: 'Recurso Próprio', value: ls.breakdown.recurso, max: 15 },
              { label: 'Renda Familiar', value: ls.breakdown.renda, max: 25 },
              { label: 'Terreno', value: ls.breakdown.terreno, max: 20 },
              { label: 'Prazo', value: ls.breakdown.prazo, max: 15 },
            ];

            return (
              <div className="space-y-6">
                {/* Score visual */}
                {hasScore ? (
                  <div className="flex items-center gap-5 p-5 rounded-2xl" style={{ backgroundColor: gs.bg, border: `1px solid ${gs.border}` }}>
                    <div className="text-center min-w-[80px]">
                      <div className="text-4xl font-extrabold" style={{ color: gs.text }}>{ls.grade}</div>
                      <div className="text-lg font-bold" style={{ color: gs.text }}>{ls.score} pts</div>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-3">
                      {bars.map(b => (
                        <div key={b.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{b.label}</span>
                            <span className="text-xs font-bold" style={{ color: gs.text }}>{b.value}/{b.max}</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/5">
                            <div className="h-full rounded-full transition-all" style={{ width: `${b.max > 0 ? (b.value / b.max) * 100 : 0}%`, backgroundColor: gs.text }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-white/30">
                    <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nenhum Lead Score calculado ainda</p>
                    <p className="text-xs text-white/20 mt-1">Responda o formulário para gerar o score</p>
                  </div>
                )}

                {/* Botão de responder formulário */}
                {!showScoreForm && (
                  <button onClick={() => setShowScoreForm(true)}
                    className="w-full flex items-center justify-center gap-2 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 font-bold rounded-xl py-3 text-sm hover:bg-brand-primary/20 transition-colors">
                    <FileText className="w-4 h-4" />
                    {hasScore ? 'Alterar respostas' : 'Responder formulário'}
                  </button>
                )}

                {/* Formulário inline */}
                {showScoreForm && <LeadScoreFormInline respostas={lsRespostas} onSave={handleSaveScore} onCancel={() => setShowScoreForm(false)} />}
              </div>
            );
          })()}

          {/* ── ATENDIMENTOS TAB ── */}
          {activeTab === 'atendimentos' && (
            <div className="space-y-4">
              {/* Checklist de Pontos de Contato */}
              <div className="bg-white/[0.02] border border-white/8 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/40">Pontos de Contato</h4>
                  <span className="text-xs font-bold" style={{ color: touchpoints.filter(Boolean).length === 5 ? '#00FF88' : '#eab308' }}>
                    {touchpoints.filter(Boolean).length}/5
                  </span>
                </div>
                <div className="flex gap-3">
                  {touchpoints.map((done, idx) => (
                    <button key={idx} onClick={() => toggleTouchpoint(idx)}
                      className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                        done ? 'bg-brand-primary/10 border-brand-primary/30' : 'bg-white/[0.02] border-white/8 hover:border-white/15'
                      }`}>
                      <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                        done ? 'border-brand-primary bg-brand-primary/20' : 'border-white/15'
                      }`}>
                        {done ? <CheckCircle2 size={14} className="text-brand-primary" /> : <span className="text-xs text-white/30">{idx + 1}</span>}
                      </div>
                      <span className={`text-[10px] font-semibold ${done ? 'text-brand-primary' : 'text-white/30'}`}>
                        Contato {idx + 1}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex flex-wrap gap-2">
                <button onClick={async () => {
                  const phone = (form.telefone || lead.telefone || '').replace(/\D/g, '');
                  if (phone) {
                    window.open(`https://api.whatsapp.com/send?phone=55${phone}`, '_blank');
                    try {
                      const act = await createLeadActivity({
                        leadId: lead.id, tenantId, tipo: 'ligacao', subtipo: 'WhatsApp Call',
                        conteudo: `Ligação via WhatsApp para ${form.nome || lead.nome} (${form.telefone || lead.telefone})`,
                        autor: userName || 'Usuário', imagemUrl: '', dados: {},
                      });
                      setActivities(prev => [act, ...prev]);
                    } catch (err) { console.error('Erro ao registrar:', err); }
                  } else { alert('Lead sem telefone cadastrado.'); }
                }} className="flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-500/20">
                  <PhoneCall className="w-4 h-4" /> Ligar
                </button>
                <button onClick={() => { setShowActivityForm(true); setActType('reuniao'); setShowRecPanel(false); }} className="flex items-center gap-2 bg-purple-500/10 text-purple-400 px-4 py-2 rounded-xl text-sm font-medium hover:bg-purple-500/20">
                  <Video className="w-4 h-4" /> Registrar Reunião
                </button>
                <button onClick={() => { setShowRecPanel(p => !p); setShowActivityForm(false); setRecState('idle'); setRecResult(null); setRecError(''); }} className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-primary/20">
                  <Mic className="w-4 h-4" /> Gravar com IA
                </button>
              </div>

              {/* Recording Panel — manter exatamente como está */}
              <AnimatePresence>
                {showRecPanel && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="bg-white/3 border border-brand-primary/20 rounded-xl p-4 space-y-3 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img src="/consultor-avatar.jpg" alt="Taleco" className="w-6 h-6 rounded-full object-cover" />
                        <span className="text-sm font-bold text-white">Análise de Ligação com Taleco</span>
                      </div>
                      <button onClick={() => { setShowRecPanel(false); setRecState('idle'); setRecResult(null); setRecError(''); }} className="text-white/30 hover:text-white"><X size={16} /></button>
                    </div>
                    {recError && <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{recError}</p>}
                    {recState === 'idle' && (
                      <div className="text-center py-4 space-y-3">
                        <p className="text-xs text-white/40">Grave a ligação e o Taleco analisa o que foi bem e o que melhorar.</p>
                        <button onClick={startRecording} className="flex items-center gap-2 bg-brand-primary text-black font-bold rounded-xl px-6 py-2.5 text-sm mx-auto hover:brightness-110">
                          <Mic className="w-4 h-4" /> Iniciar Gravação
                        </button>
                      </div>
                    )}
                    {recState === 'recording' && (
                      <div className="text-center py-4 space-y-3">
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-2xl font-mono font-bold text-white">{fmtRecTime(recSeconds)}</span>
                        </div>
                        <p className="text-xs text-white/40">Gravando... fale normalmente</p>
                        <button onClick={stopAndAnalyze} className="flex items-center gap-2 bg-red-500/20 text-red-400 border border-red-500/30 font-bold rounded-xl px-6 py-2.5 text-sm mx-auto hover:bg-red-500/30">
                          <Square className="w-4 h-4" /> Finalizar e Analisar
                        </button>
                      </div>
                    )}
                    {recState === 'processing' && (
                      <div className="text-center py-6 space-y-2">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto" />
                        <p className="text-sm text-white/60">Taleco está analisando a ligação...</p>
                      </div>
                    )}
                    {recState === 'done' && recResult && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${recResult.nota_geral >= 7 ? 'bg-green-500/20 text-green-400' : recResult.nota_geral >= 5 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                              Nota {recResult.nota_geral}/10
                            </span>
                            {recResult.dor_encontrada && <span className="text-xs bg-brand-primary/10 text-brand-primary px-2 py-1 rounded-lg">Dor encontrada</span>}
                            {recResult.momento_uau && <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-1 rounded-lg">Momento UAU</span>}
                          </div>
                          <span className="text-xs text-white/30">{fmtRecTime(recResult.duracao_segundos)}</span>
                        </div>
                        <p className="text-xs text-white/60 bg-white/3 rounded-lg p-3">{recResult.resumo}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-green-500/5 border border-green-500/10 rounded-lg p-3">
                            <p className="text-xs font-bold text-green-400 mb-1.5 flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> Acertos</p>
                            {(recResult.acertos || []).map((a: string, i: number) => <p key={i} className="text-xs text-white/60 mb-1">• {a}</p>)}
                          </div>
                          <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
                            <p className="text-xs font-bold text-amber-400 mb-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Melhorias</p>
                            {(recResult.melhorias || []).map((m: string, i: number) => <p key={i} className="text-xs text-white/60 mb-1">• {m}</p>)}
                          </div>
                        </div>
                        <div className="bg-brand-primary/5 border border-brand-primary/10 rounded-lg p-3 flex gap-2">
                          <img src="/consultor-avatar.jpg" alt="Taleco" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-white/70 italic">{recResult.comentario_taleco}</p>
                        </div>
                        <p className="text-xs text-green-400 text-center">Análise salva na timeline</p>
                        <button onClick={() => { setRecState('idle'); setRecResult(null); }} className="w-full text-xs text-white/40 hover:text-white/60 py-1">Gravar outra</button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Activity Form — com Atendeu/Não atendeu + Observações */}
              <AnimatePresence>
                {showActivityForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="bg-white/3 border border-white/10 rounded-xl p-4 space-y-3 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white">{actType === 'ligacao' ? 'Ligação' : 'Reunião'}</h4>
                      <button onClick={() => setShowActivityForm(false)} className="text-white/30 hover:text-white"><X size={16} /></button>
                    </div>

                    {actType === 'ligacao' && (
                      <div>
                        <label className="block text-xs text-white/40 mb-2">Status da ligação</label>
                        <div className="flex gap-2">
                          {['Atendeu', 'Não atendeu'].map(opt => (
                            <button key={opt} onClick={() => setActSubtype(opt)}
                              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-all ${actSubtype === opt ? 'bg-brand-primary/15 border-brand-primary/40 text-brand-primary' : 'border-white/10 text-white/50 hover:border-white/20'}`}>{opt}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {actType === 'reuniao' && (
                      <div>
                        <label className="block text-xs text-white/40 mb-2">Status da reunião</label>
                        <div className="flex gap-2">
                          {['Realizada', 'Não compareceu', 'Remarcou'].map(opt => (
                            <button key={opt} onClick={() => setActSubtype(opt.toLowerCase())}
                              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-all ${actSubtype === opt.toLowerCase() ? 'bg-brand-primary/15 border-brand-primary/40 text-brand-primary' : 'border-white/10 text-white/50 hover:border-white/20'}`}>{opt}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-white/40 mb-1">Observações</label>
                      <textarea className={inputCls + ' resize-none'} rows={3} placeholder="O que foi conversado, próximos passos..." value={actContent} onChange={e => setActContent(e.target.value)} />
                    </div>

                    {/* Image upload — opcional */}
                    <div>
                      <label className="block text-xs text-white/20 mb-1">Print da tela (opcional)</label>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white/60 cursor-pointer hover:bg-white/10">
                          <Upload size={14} /> {actImage ? actImage.name : 'Selecionar imagem'}
                          <input type="file" accept="image/*" className="hidden" onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) { setActImage(f); setActImagePreview(URL.createObjectURL(f)); }
                          }} />
                        </label>
                        {actImagePreview && <img src={actImagePreview} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-white/10" />}
                      </div>
                    </div>

                    <button onClick={handleSubmitActivity} disabled={sendingActivity || (!actContent.trim() && !actImage)}
                      className="w-full bg-brand-primary text-black font-bold rounded-xl py-2.5 text-sm hover:brightness-110 disabled:opacity-50">
                      {sendingActivity ? 'Enviando...' : 'Registrar'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Activity list */}
              {loadingActivities ? (
                <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : activities.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-sm">Nenhuma atividade registrada</div>
              ) : (
                <div className="space-y-3">
                  {activities.map(act => (
                    <motion.div key={act.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-white/3 border border-white/5 rounded-xl p-3.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${TIPO_BADGES[act.tipo] ?? 'bg-white/10 text-white/50'}`}>{act.tipo}</span>
                        {act.subtipo && <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{act.subtipo}</span>}
                        <span className="text-xs text-white/30">{act.autor}</span>
                        <span className="text-xs text-white/20 ml-auto flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDateTime(act.criadoEm)}</span>
                      </div>
                      {act.tipo === 'analise_audio' && act.dados?.analise ? (
                        <div className="space-y-2 mt-1">
                          <p className="text-xs text-white/60">{act.dados.analise.resumo}</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {act.dados.analise.nota_geral && <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${act.dados.analise.nota_geral >= 7 ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>Nota {act.dados.analise.nota_geral}/10</span>}
                            {act.dados.analise.dor_encontrada && <span className="text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded">Dor</span>}
                            {act.dados.analise.momento_uau && <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded">UAU</span>}
                          </div>
                          {act.dados.analise.comentario_taleco && (
                            <div className="flex gap-2 bg-brand-primary/5 rounded-lg p-2">
                              <img src="/consultor-avatar.jpg" alt="Taleco" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                              <p className="text-[11px] text-white/60 italic">{act.dados.analise.comentario_taleco}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-white/70">{act.conteudo}</p>
                      )}
                      {act.imagemUrl && (
                        <img src={act.imagemUrl} alt="Print" onClick={() => onImageClick(act.imagemUrl)}
                          className="mt-2 w-24 h-16 object-cover rounded-lg border border-white/10 cursor-pointer hover:opacity-80 transition-opacity" />
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── NOTAS TAB ── */}
          {activeTab === 'notas' && (
            <div className="space-y-3">
              <p className="text-xs text-white/40">Anotações internas sobre esta oportunidade. Salvo automaticamente.</p>
              <textarea
                rows={14}
                className={inputCls + ' resize-none'}
                placeholder="Escreva suas notas aqui..."
                value={nota}
                onChange={e => setNota(e.target.value)}
                onBlur={async () => { const updated = { ...form, observacoes: nota }; setForm(updated); await onUpdate(updated); }}
              />
              <p className="text-xs text-white/20 text-right">Salvo ao perder o foco do campo</p>
            </div>
          )}

          {/* ── TAREFAS TAB ── */}
          {activeTab === 'tarefas' && (
            <div className="space-y-4">
              <button onClick={() => setShowTaskForm(true)} className="flex items-center gap-2 bg-amber-500/10 text-amber-400 px-4 py-2 rounded-xl text-sm font-medium hover:bg-amber-500/20">
                <Plus className="w-4 h-4" /> Agendar Tarefa
              </button>

              {/* Task Form */}
              <AnimatePresence>
                {showTaskForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="bg-white/3 border border-white/10 rounded-xl p-4 space-y-3 overflow-hidden">
                    <div className="flex items-center justify-between"><h4 className="text-sm font-bold text-white">Nova Tarefa</h4><button onClick={() => setShowTaskForm(false)} className="text-white/30 hover:text-white"><X size={16} /></button></div>
                    <input className={inputCls} placeholder="Título da tarefa *" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="datetime-local" className={inputCls} value={taskDate} onChange={e => setTaskDate(e.target.value)} />
                      <input className={inputCls} placeholder="Responsável" value={taskResponsavel} onChange={e => setTaskResponsavel(e.target.value)} />
                    </div>
                    <button onClick={handleCreateTask} disabled={!taskTitle.trim() || !taskDate} className="w-full bg-amber-500/20 text-amber-400 font-bold rounded-xl py-2 text-sm hover:bg-amber-500/30 disabled:opacity-50">Agendar</button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Task list */}
              {tarefas.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-sm">Nenhuma tarefa agendada</div>
              ) : (
                <div className="space-y-2">
                  {tarefas.sort((a, b) => +a.concluida - +b.concluida || new Date(a.dataAgendada).getTime() - new Date(b.dataAgendada).getTime()).map(tarefa => (
                    <div key={tarefa.id} className={`bg-white/3 border rounded-xl p-3.5 ${tarefa.concluida ? 'border-green-500/20 opacity-60' : 'border-white/10'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${tarefa.concluida ? 'border-green-500 bg-green-500' : 'border-white/20'}`}>
                          {tarefa.concluida && <CheckCircle2 size={12} className="text-black" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${tarefa.concluida ? 'text-white/40 line-through' : 'text-white'}`}>{tarefa.titulo}</p>
                          <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                            <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{fmtDateTime(tarefa.dataAgendada)}</span>
                            {tarefa.responsavel && <span className="flex items-center gap-1"><User className="w-3 h-3" />{tarefa.responsavel}</span>}
                          </div>
                        </div>
                        {!tarefa.concluida && (
                          <button onClick={() => setCompletingTaskId(tarefa.id)} className="bg-brand-primary/10 text-brand-primary px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-brand-primary/20">Concluir</button>
                        )}
                        {tarefa.imagemUrl && (
                          <img src={tarefa.imagemUrl} alt="Print" onClick={() => onImageClick(tarefa.imagemUrl)} className="w-10 h-10 rounded-lg object-cover border border-white/10 cursor-pointer" />
                        )}
                      </div>

                      {/* Complete task with image */}
                      {completingTaskId === tarefa.id && (
                        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                          <label className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white/60 cursor-pointer hover:bg-white/10">
                            <Upload size={14} /> {taskCompleteImage ? taskCompleteImage.name : 'Anexar print (obrigatório)'}
                            <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) setTaskCompleteImage(e.target.files[0]); }} />
                          </label>
                          <div className="flex gap-2">
                            <button onClick={() => { setCompletingTaskId(null); setTaskCompleteImage(null); }} className="flex-1 bg-white/5 text-gray-400 py-2 rounded-xl text-xs">Cancelar</button>
                            <button onClick={() => handleCompleteTask(tarefa)} disabled={!taskCompleteImage} className="flex-1 bg-brand-primary text-black font-bold py-2 rounded-xl text-xs disabled:opacity-50">Confirmar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CHECKLIST VENDAS (DEMANDAS PÓS-VENDA) TAB ── */}
          {activeTab === 'demandas' && (() => {
            const currentStageName = (stages.find(s => s.id === form.stageId)?.nome || '').toLowerCase();
            const isFechado = currentStageName.includes('fech') || currentStageName.includes('ganh') || form.status === 'ganho';

            const items = [
              { key: 'contrato_feito', label: 'Contrato elaborado' },
              { key: 'contrato_assinado', label: 'Contrato assinado' },
              { key: 'sinal_pago', label: 'Sinal pago' },
              { key: 'entrada_paga', label: 'Entrada paga' },
              { key: 'credito_aprovado', label: 'Crédito aprovado' },
              { key: 'onboarding_agendado', label: 'Onboarding agendado' },
              { key: 'grupo_criado', label: 'Grupo WhatsApp criado' },
              { key: 'membros_adicionados', label: 'Membros adicionados ao grupo' },
              { key: 'mensagem_saudacao', label: 'Mensagem de saudação enviada' },
            ];

            const completedCount = items.filter(i => demandas[i.key]).length;
            const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

            if (!isFechado) {
              return (
                <div className="flex flex-col items-center justify-center py-16 text-white/30">
                  <FileText className="w-12 h-12 mb-4 opacity-30" />
                  <p className="text-base font-medium">Checklist disponível para leads fechados</p>
                  <p className="text-sm mt-1">Mova o lead para "Fechado" ou "Ganho" para liberar.</p>
                </div>
              );
            }

            return (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white">Checklist Pós-Venda</h4>
                  <span className="text-sm font-extrabold" style={{ color: progress === 100 ? '#00FF88' : '#eab308' }}>
                    {completedCount}/{items.length} · {Math.round(progress)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/5">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: progress === 100 ? '#00FF88' : '#eab308' }} />
                </div>
                <div className="space-y-2">
                  {items.map(item => (
                    <button key={item.key} onClick={() => toggleDemanda(item.key)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                        demandas[item.key]
                          ? 'bg-brand-primary/5 border-brand-primary/20'
                          : 'bg-white/[0.02] border-white/8 hover:border-white/15'
                      }`}>
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        demandas[item.key] ? 'border-brand-primary bg-brand-primary/20' : 'border-white/15'
                      }`}>
                        {demandas[item.key] && <CheckCircle2 size={14} className="text-brand-primary" />}
                      </div>
                      <span className={`text-sm font-medium ${demandas[item.key] ? 'text-brand-primary' : 'text-white/80'}`}>
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
                {progress === 100 && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-primary/10 border border-brand-primary/20">
                    <CheckCircle2 size={20} className="text-brand-primary flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-brand-primary">Processo completo!</p>
                      <p className="text-xs text-white/40">Todas as demandas foram concluídas.</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Modal Motivo de Perda */}
        <AnimatePresence>
          {showPerdaModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center p-6 rounded-2xl" onClick={() => setShowPerdaModal(false)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                className="bg-[#0d1117] border border-red-500/20 rounded-2xl p-6 w-full max-w-md space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <AlertCircle size={20} className="text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Marcar como Perda</h3>
                    <p className="text-xs text-gray-500">Registre o motivo da perda deste lead</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Motivo da perda</label>
                  <textarea rows={4} className={inputCls + ' resize-none'} placeholder="Descreva por que o lead foi perdido..."
                    value={motivoPerda} onChange={e => setMotivoPerda(e.target.value)} />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowPerdaModal(false)}
                    className="flex-1 bg-white/5 text-gray-400 py-2.5 rounded-xl text-sm hover:bg-white/10">
                    Cancelar
                  </button>
                  <button onClick={async () => {
                    const statusStage = stages.find(s => s.nome.toLowerCase().includes('perd'));
                    const updated = { ...form, status: 'perdido', motivoPerda, stageId: statusStage?.id ?? form.stageId };
                    setForm(updated as any);
                    await onUpdate(updated as any);
                    // Registrar na timeline
                    try {
                      const act = await createLeadActivity({
                        leadId: lead.id, tenantId, tipo: 'movimentacao', subtipo: 'Perda',
                        conteudo: `Lead marcado como perdido. Motivo: ${motivoPerda || 'Não informado'}`,
                        autor: userName || 'Usuário', imagemUrl: '', dados: {},
                      });
                      setActivities(prev => [act, ...prev]);
                    } catch { /* silent */ }
                    setShowPerdaModal(false);
                  }}
                    className="flex-1 bg-red-500/20 text-red-400 font-bold py-2.5 rounded-xl text-sm hover:bg-red-500/30">
                    Confirmar Perda
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ── Formulário Lead Score inline ──────────────────────────
function LeadScoreFormInline({ respostas, onSave, onCancel }: {
  respostas: LeadScoreRespostas;
  onSave: (r: LeadScoreRespostas) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<LeadScoreRespostas>({ ...respostas });
  const preview = calcClientLeadScore(form);
  const gs = LEAD_SCORE_GRADE_STYLE[preview.grade] || LEAD_SCORE_GRADE_STYLE.D;

  const optBtnCls = (selected: boolean) =>
    `px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all ${
      selected
        ? 'bg-brand-primary/15 border-brand-primary/40 text-brand-primary'
        : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white/70'
    }`;

  const questions: { key: keyof LeadScoreRespostas; label: string; options: { value: string; label: string }[] }[] = [
    {
      key: 'credito_aprovado', label: 'Tem crédito aprovado?',
      options: [{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }],
    },
    {
      key: 'recurso_proprio', label: 'Tem recurso próprio?',
      options: [{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }],
    },
    {
      key: 'renda_familiar', label: 'Renda familiar',
      options: [
        { value: '1k_3k', label: 'R$1k a 3k' },
        { value: '3k_6k', label: 'R$3k a 6k' },
        { value: '6k_9k', label: 'R$6k a 9k' },
        { value: '9k_12k', label: 'R$9k a 12k' },
        { value: '12k_mais', label: '+ de R$12k' },
      ],
    },
    {
      key: 'tem_terreno', label: 'Tem terreno?',
      options: [{ value: 'sim', label: 'Sim' }, { value: 'nao', label: 'Não' }],
    },
    {
      key: 'prazo_construir', label: 'Quer construir pra quando?',
      options: [
        { value: '1_mes', label: '1 mês' },
        { value: '3_meses', label: '3 meses' },
        { value: '6_meses', label: '6 meses' },
        { value: '1_ano_mais', label: '1 ano ou mais' },
      ],
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-6">

      {/* Preview do score em tempo real */}
      <div className="flex items-center gap-4 p-4 rounded-xl" style={{ backgroundColor: gs.bg, border: `1px solid ${gs.border}` }}>
        <div className="text-center">
          <div className="text-3xl font-extrabold" style={{ color: gs.text }}>{preview.grade}</div>
          <div className="text-sm font-bold" style={{ color: gs.text }}>{preview.score} pts</div>
        </div>
        <div className="text-xs text-white/40">
          Score atualiza em tempo real conforme você responde
        </div>
      </div>

      {/* Perguntas */}
      {questions.map(q => (
        <div key={q.key}>
          <label className="block text-sm font-semibold text-white mb-3">{q.label}</label>
          <div className="flex flex-wrap gap-2">
            {q.options.map(opt => (
              <button key={opt.value} type="button"
                onClick={() => setForm(f => ({ ...f, [q.key]: f[q.key] === opt.value ? '' : opt.value }))}
                className={optBtnCls(form[q.key] === opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Ações */}
      <div className="flex gap-3 pt-2">
        <button onClick={() => onSave(form)}
          className="flex-1 bg-brand-primary text-black font-bold rounded-xl py-3 text-sm hover:brightness-110 transition-all">
          Salvar Lead Score
        </button>
        <button onClick={onCancel}
          className="px-6 bg-white/5 text-white/50 border border-white/10 font-medium rounded-xl py-3 text-sm hover:bg-white/10 transition-all">
          Cancelar
        </button>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════
// NewLeadModal
// ══════════════════════════════════════════════════════════════
type NewLeadModalProps = { tenantId: string; stages: CrmClientStage[]; onClose: () => void; onCreate: (data: Omit<CrmClientLead, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<void>; };

function NewLeadModal({ tenantId, stages, onClose, onCreate }: NewLeadModalProps) {
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', segmento: '', empresa: '', ticketEstimado: 0, responsavel: '', stageId: stages[0]?.id ?? '' });
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setCreating(true);
    try {
      await onCreate({
        tenantId, stageId: form.stageId, nome: form.nome.trim(), telefone: form.telefone.trim(),
        email: form.email.trim(), segmento: form.segmento.trim(), empresa: form.empresa.trim(),
        ticketEstimado: form.ticketEstimado, responsavel: form.responsavel.trim(),
        etiquetas: [], observacoes: '', faturamento: '', area: '', origem: '',
        valorContrato: 0, valorCc: 0, valorMrr: 0, status: '', motivoPerda: '', proximaReuniao: '',
      });
    } finally { setCreating(false); }
  };

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-primary';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()} className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5"><h2 className="text-lg font-bold text-white">Novo Lead</h2><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-5 h-5 text-white/50" /></button></div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div><label className="block text-xs text-white/40 mb-1">Nome *</label><input className={inputCls} placeholder="Nome do lead" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs text-white/40 mb-1">Empresa</label><input className={inputCls} placeholder="Nome da empresa" value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })} /></div>
            <div><label className="block text-xs text-white/40 mb-1">Segmento</label><input className={inputCls} placeholder="Ex: Construtora" value={form.segmento} onChange={e => setForm({ ...form, segmento: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs text-white/40 mb-1">Telefone</label><input className={inputCls} placeholder="(00) 00000-0000" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></div>
            <div><label className="block text-xs text-white/40 mb-1">Email</label><input type="email" className={inputCls} placeholder="email@exemplo.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-xs text-white/40 mb-1">Ticket estimado</label><input type="number" className={inputCls} placeholder="0,00" value={form.ticketEstimado || ''} onChange={e => setForm({ ...form, ticketEstimado: +e.target.value })} /></div>
            <div><label className="block text-xs text-white/40 mb-1">Responsável</label><input className={inputCls} placeholder="Nome" value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} /></div>
            <div><label className="block text-xs text-white/40 mb-1">Etapa inicial</label><select className={inputCls} value={form.stageId} onChange={e => setForm({ ...form, stageId: e.target.value })}>{stages.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>
          </div>
          <button type="submit" disabled={creating || !form.nome.trim()} className="w-full bg-brand-primary text-black font-bold rounded-xl px-4 py-2.5 text-sm hover:brightness-110 disabled:opacity-50">{creating ? 'Criando...' : 'Criar Lead'}</button>
        </form>
      </motion.div>
    </motion.div>
  );
}
