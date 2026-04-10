import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Plus, RefreshCw, Search, Loader2, ChevronDown, Calendar, FileText
} from 'lucide-react';
import { supabase } from '../shared/lib/supabase';
import { fmtDateSP, fmtDateSmartSP, parseDateSP, localDatetimeToISO, SP_TZ } from '../shared/lib/dateHelpers';
import { syncPostgres } from '../shared/lib/webhooks';
import { getLeadScore } from '../shared/lib/leadScore';
import type { CRMLead, CRMTarefa, CRMDemandaVenda, TeamMember } from '../shared/types';
import { ETAPAS, CRM_ALL_TAGS } from '../shared/constants';
import { LeadCard } from './components/LeadCard';
import { LeadModal } from './components/LeadModal';
import { NewLeadModal } from './components/NewLeadModal';
import { TaskAlarmPopup, playAlarmSound } from './components/TaskAlarmPopup';

export default function CRMPage({ userSession, teamMembers, openLeadByName, onLeadOpened, onClientCreated }: { userSession: any; teamMembers: TeamMember[]; openLeadByName?: string; onLeadOpened?: () => void; onClientCreated?: () => void }) {
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
  const [filtroResponsavel, setFiltroResponsavel] = useState(userSession?.name || 'Todos');
  const [filtroTag, setFiltroTag] = useState('');
  const [filtroScore, setFiltroScore] = useState('Todos');
  const isAdmin = (userSession?.role ?? '').toLowerCase() === 'admin';

  // ── Demandas pendentes ──────────────────────────────────────
  const [demandasPendentes, setDemandasPendentes] = useState<(CRMDemandaVenda & { lead_nome: string; lead_id: string; closer: string })[]>([]);

  const refreshDemandas = useCallback(async () => {
    const role = (userSession?.role ?? '').toLowerCase();
    if (role !== 'admin' && role !== 'comercial') return;
    if (leads.length === 0) return;
    const { data: demandas } = await supabase.from('crm_demandas_venda').select('*');
    if (!demandas) return;
    const pendentes = demandas.filter((d: any) => {
      const vendaOk = (d.contrato_assinado && d.sinal_pago) || d.entrada_paga;
      const processoOk = d.onboarding_agendado && d.grupo_criado && d.membros_adicionados && d.mensagem_saudacao;
      return !vendaOk || !processoOk;
    });
    const enriched = pendentes.map((d: any) => {
      const lead = leads.find(l => l.id === d.lead_id);
      if (!lead) return null;
      return { ...d, lead_nome: lead.nome, closer: lead.closer_responsavel ?? '' };
    }).filter(Boolean as any).filter((d: any) => {
      if ((userSession?.role ?? '').toLowerCase() === 'admin') return true;
      const lead = leads.find(l => l.id === d.lead_id);
      return d.closer === userSession?.name || lead?.sdr_responsavel === userSession?.name;
    });
    setDemandasPendentes(enriched);
  }, [leads, userSession]);

  useEffect(() => { refreshDemandas(); }, [refreshDemandas]);

  const minhasTarefasPendentes = tarefas.filter(t => {
    if (t.concluida) return false;
    const lead = leads.find(l => l.id === t.lead_id);
    const isResponsavelTarefa = t.responsavel === userSession?.name;
    const isResponsavelLead = (lead?.closer_responsavel === userSession?.name) || (lead?.sdr_responsavel === userSession?.name);
    return isResponsavelTarefa || isResponsavelLead;
  });
  console.log('[debug tarefas]', { total: tarefas.length, userName: userSession?.name, pendentes: minhasTarefasPendentes.length });

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
        const lead = leads.find(l => l.id === t.lead_id);
        const isTaskResponsavel = (t.responsavel ?? '').toLowerCase() === userName.toLowerCase();
        const isLeadResponsavel = (lead?.closer_responsavel ?? '').toLowerCase() === userName.toLowerCase()
          || (lead?.sdr_responsavel ?? '').toLowerCase() === userName.toLowerCase();
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
      await supabase.from('crm_atividades').insert({
        lead_id: tarefa.lead_id, tipo: 'tarefa', descricao,
        imagem_url: imageUrl || null,
        data_atividade: now, realizado_por: userSession?.name ?? '', created_at: now,
      });
      const collaborator = tarefa.responsavel || lead?.closer_responsavel || lead?.sdr_responsavel || userSession?.name || '';
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
    const lead = leads.find(l => l.id === tarefa.lead_id);
    if (lead) {
      await supabase.from('crm_leads').update({ proxima_reuniao: novaDataISO, updated_at: new Date().toISOString() }).eq('id', lead.id);
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, proxima_reuniao: novaDataISO } : l));
    }
    try {
      const webhookBase = import.meta.env.VITE_WEBHOOK_BASE?.replace('/webhook/dashboard', '') ?? 'https://webhook.m2black.com';
      await fetch(`${webhookBase}/webhook/agendar-reuniao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_nome: lead?.nome ?? '',
          lead_telefone: lead?.telefone ?? '',
          lead_externo_id: lead?.lead_externo_id ?? lead?.id ?? '',
          closer: tarefa.responsavel || lead?.closer_responsavel || '',
          sdr: lead?.sdr_responsavel || userSession?.name || '',
          tipo_reuniao: tarefa.titulo?.includes('R2') ? 'R2' : 'R1',
          data_hora: new Date(novaData).toISOString(),
          duracao_min: 60,
          reagendamento: true,
          bant: { sdr: lead?.sdr_responsavel || userSession?.name || '' },
        }),
      }).catch(() => null);
    } catch { /* fire-and-forget */ }
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
        closer: tarefa.responsavel || lead.closer_responsavel || null,
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
      const query = supabase.from('crm_leads').select('*').is('deletado_em', null).order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
      const { data, error } = await query;
      if (error) {
        console.warn('[crm_leads] Erro na página', from, '— tentando em lotes menores:', error.message);
        let smallFrom = from;
        const smallEnd = from + PAGE_SIZE;
        while (smallFrom < smallEnd) {
          const smallQuery = supabase.from('crm_leads').select('*').is('deletado_em', null).order('created_at', { ascending: false }).range(smallFrom, smallFrom + SMALL_PAGE - 1);
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

    const seen = new Set<string>();
    const unique = allLeads.filter(l => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });

    const { data: t } = await supabase.from('crm_tarefas').select('*');

    setLeads(unique);

    const activeLeadIds = new Set(unique.map(l => l.id));
    const orphanIds = (t ?? []).filter(task => !activeLeadIds.has(task.lead_id)).map(task => task.id);
    if (orphanIds.length > 0) {
      await supabase.from('crm_tarefas').delete().in('id', orphanIds);
    }
    setTarefas((t ?? []).filter(task => activeLeadIds.has(task.lead_id) && !task.concluida));
    setLoading(false);
  }, []);

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
        closer: updated.closer_responsavel ?? leadData.closer_responsavel,
        sdr: updated.sdr_responsavel ?? leadData.sdr_responsavel,
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

  const handleDeleteLead = async (leadId: string) => {
    await supabase.from('crm_demandas_venda').delete().eq('lead_id', leadId);
    setLeads(prev => prev.filter(l => l.id !== leadId));
    setTarefas(prev => prev.filter(t => t.lead_id !== leadId));
    setAlarmTarefas(prev => prev.filter(t => t.lead_id !== leadId));
    setDemandasPendentes(prev => prev.filter(d => d.lead_id !== leadId));
    setSelectedLead(null);
  };

  const handleNewLead = async (lead: Partial<CRMLead>) => {
    const { data, error } = await supabase
      .from('crm_leads')
      .insert({ ...lead, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) { console.error(error); return; }

    let leadFinal = data;
    if (data) {
      try {
        const webhookBase = import.meta.env.VITE_WEBHOOK_BASE?.replace('/webhook/dashboard', '')
          ?? 'https://webhook.m2black.com';
        console.log('[criar-lead-manual] payload:', JSON.stringify({nome: lead.nome, telefone: lead.telefone, sdr: lead.sdr_responsavel}));
        const res = await fetch(`${webhookBase}/webhook/criar-lead-manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: lead.nome,
            email: lead.email ?? '',
            telefone: lead.telefone ?? '',
            area: lead.area ?? '',
            faturamento: lead.faturamento ?? '',
            sdr: lead.sdr_responsavel ?? '',
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

  const responsaveis = [...new Set(leads.flatMap(l => [l.closer_responsavel, l.sdr_responsavel]).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const filteredLeads = leads
    .filter(l => {
      if (filtroResponsavel === '__sem__' && (l.closer_responsavel || l.sdr_responsavel)) return false;
      if (filtroResponsavel && filtroResponsavel !== 'Todos' && filtroResponsavel !== '__sem__' && l.closer_responsavel !== filtroResponsavel && l.sdr_responsavel !== filtroResponsavel) return false;
      if (filtroTag && !(l.tags ?? []).includes(filtroTag)) return false;
      if (filtroScore !== 'Todos') {
        const { grade } = getLeadScore(l);
        if (grade !== filtroScore) return false;
      }
      if (!search) return true;
      const q = search.toLowerCase();
      return l.nome.toLowerCase().includes(q) ||
        (l.telefone ?? '').includes(q) ||
        (l.empresa ?? '').toLowerCase().includes(q) ||
        (l.area ?? '').toLowerCase().includes(q) ||
        (l.closer_responsavel ?? '').toLowerCase().includes(q) ||
        (l.sdr_responsavel ?? '').toLowerCase().includes(q);
    });

  const sortLeads = (list: CRMLead[], order: 'newest' | 'oldest' | 'more_time' | 'less_time') => {
    return [...list].sort((a, b) => {
      let diff = 0;
      if (order === 'newest')    diff = new Date(b.created_at || (b as any).data || 0).getTime() - new Date(a.created_at || (a as any).data || 0).getTime();
      else if (order === 'oldest')    diff = new Date(a.created_at || (a as any).data || 0).getTime() - new Date(b.created_at || (b as any).data || 0).getTime();
      else if (order === 'more_time') diff = new Date(a.etapa_desde ?? a.updated_at).getTime() - new Date(b.etapa_desde ?? b.updated_at).getTime();
      else if (order === 'less_time') diff = new Date(b.etapa_desde ?? b.updated_at).getTime() - new Date(a.etapa_desde ?? a.updated_at).getTime();
      if (diff !== 0) return diff;
      const aExt = Number(a.lead_externo_id);
      const bExt = Number(b.lead_externo_id);
      if (!isNaN(aExt) && !isNaN(bExt) && aExt !== bExt) {
        return (order === 'oldest' || order === 'more_time') ? aExt - bExt : bExt - aExt;
      }
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
          <select value={filtroResponsavel} onChange={e => setFiltroResponsavel(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-brand-primary appearance-none"
          >
            <option value="Todos" className="bg-bg-main">Todos os responsáveis</option>
            <option value="__sem__" className="bg-bg-main">Sem responsável</option>
            {responsaveis.map(r => <option key={r} value={r} className="bg-bg-main">{r}</option>)}
          </select>
          <select value={filtroTag} onChange={e => setFiltroTag(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-brand-primary appearance-none"
          >
            <option value="" className="bg-bg-main">Todas as etiquetas</option>
            {CRM_ALL_TAGS.map(t => <option key={t} value={t} className="bg-bg-main">{t}</option>)}
          </select>
          <select value={filtroScore} onChange={e => setFiltroScore(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-400 focus:outline-none focus:border-brand-primary appearance-none"
          >
            <option value="Todos" className="bg-bg-main">Todos os scores</option>
            <option value="A" className="bg-bg-main">A (70+)</option>
            <option value="B" className="bg-bg-main">B (45-69)</option>
            <option value="C" className="bg-bg-main">C (20-44)</option>
            <option value="D" className="bg-bg-main">D (0-19)</option>
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

      {/* ── Painel Pendências + Tarefas ── */}
      {((userSession?.role ?? '').toLowerCase() === 'admin' || (userSession?.role ?? '').toLowerCase() === 'comercial') && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Lado esquerdo: Pendências de Venda */}
          <div className="bg-[#1a1f2e] rounded-2xl p-4 border border-white/5 max-h-52 overflow-y-auto">
            <p className="text-[9px] font-bold uppercase tracking-widest text-yellow-500 mb-3 flex items-center gap-2">
              <FileText size={12} /> Pendências de Venda ({demandasPendentes.length})
            </p>
            {demandasPendentes.length === 0 ? (
              <p className="text-xs text-gray-600">Nenhuma pendência</p>
            ) : (
              <div className="space-y-2">
                {demandasPendentes.map(d => {
                  const itens = [
                    !d.contrato_feito && 'Contrato',
                    d.contrato_feito && !d.contrato_assinado && 'Assinatura',
                    !d.sinal_pago && 'Sinal',
                    !d.entrada_paga && 'Entrada',
                    !d.onboarding_agendado && 'Onboarding',
                    !d.grupo_criado && 'Grupo',
                    !d.membros_adicionados && 'Membros',
                    !d.mensagem_saudacao && 'Saudação',
                  ].filter(Boolean);
                  const total = 8;
                  const feitos = total - itens.length;
                  return (
                    <div key={d.id}
                      onClick={() => {
                        const lead = leads.find(l => l.id === d.lead_id);
                        if (lead) setSelectedLead(lead);
                      }}
                      className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-yellow-500/30 cursor-pointer transition-all"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-white truncate max-w-[60%]">{d.lead_nome}</span>
                        <span className="text-[9px] text-gray-500">{feitos}/{total}</span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-white/10 mb-1.5">
                        <div className="h-1 rounded-full bg-brand-primary transition-all" style={{ width: `${(feitos/total)*100}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {itens.map((item, i) => (
                          <span key={i} className="text-[8px] px-1.5 py-0.5 rounded-full bg-yellow-900/30 text-yellow-500 border border-yellow-500/20">{item}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lado direito: Tarefas Agendadas */}
          <div className="bg-[#1a1f2e] rounded-2xl p-4 border border-white/5 max-h-52 overflow-y-auto">
            <p className="text-[9px] font-bold uppercase tracking-widest text-blue-400 mb-3 flex items-center gap-2">
              <Calendar size={12} /> Tarefas Agendadas ({minhasTarefasPendentes.length})
            </p>
            {minhasTarefasPendentes.length === 0 ? (
              <p className="text-xs text-gray-600">Nenhuma tarefa pendente</p>
            ) : (
              <div className="space-y-2">
                {minhasTarefasPendentes
                  .sort((a, b) => new Date(a.data_agendada ?? 0).getTime() - new Date(b.data_agendada ?? 0).getTime())
                  .map(t => {
                    const lead = leads.find(l => l.id === t.lead_id);
                    const isOverdue = t.data_agendada && parseDateSP(t.data_agendada) < new Date();
                    return (
                      <div key={t.id}
                        onClick={() => { if (lead) setSelectedLead(lead); }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${isOverdue ? 'bg-red-900/10 border-red-500/30 hover:border-red-500/50' : 'bg-white/5 border-white/10 hover:border-blue-500/30'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-white truncate max-w-[60%]">{t.titulo}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${t.tipo === 'ligacao' ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}`}>
                            {t.tipo === 'ligacao' ? 'Ligação' : 'Follow-up'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-500">{lead?.nome ?? '—'}</span>
                          <span className={`text-[10px] ${isOverdue ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
                            {t.data_agendada ? fmtDateSmartSP(t.data_agendada) : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

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
        <LeadModal lead={selectedLead} onClose={() => { setSelectedLead(null); refreshDemandas(); }}
          onSave={handleSaveLead} onDelete={handleDeleteLead} userSession={userSession} teamMembers={teamMembers} onClientCreated={onClientCreated}
          onTarefaCreated={(tarefa: CRMTarefa) => setTarefas(prev => [...prev, tarefa])}
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
