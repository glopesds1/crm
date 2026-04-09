import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../shared/lib/supabase';
import { syncPostgres, WEBHOOK_BASE } from '../../shared/lib/webhooks';
import { fmtDateSP, fmtDateSmartSP, localDatetimeToISO, SP_TZ, parseDateSP } from '../../shared/lib/dateHelpers';
import { getLeadScore, calcLeadScore, getProgramaStyle } from '../../shared/lib/leadScore';
import { ETAPAS, ETAPA_MAP, CRM_TAGS_CONFIG, CRM_ALL_TAGS, GRADE_STYLE } from '../../shared/constants';
import { DEFAULT_ONBOARDING_ITEMS } from '../../shared/constants';
import type { CRMLead, CRMAtividade, CRMTarefa, CRMDemandaVenda, TeamMember } from '../../shared/types';
import { NovaAtividadeForm } from './NovaAtividadeForm';
import { SlotPicker } from './SlotPicker';
import { motion } from 'motion/react';
// All lucide-react icons used in LeadModal
import {
  X, Phone, Calendar, MapPin, DollarSign, User, CheckCircle2, ChevronDown, Trash2,
  Send, Video, Building2, FileText, Clock, PhoneCall, Users, ArrowRightLeft, Plus,
  Upload, Loader2, Bell, ChevronRight, RefreshCw, Search
} from 'lucide-react';

const TIPO_ICON: Record<string, any> = {
  ligacao: PhoneCall,
  reuniao: Users,
  nota:    FileText,
  tarefa:  Calendar,
  alteracao: ArrowRightLeft,
};

// ── Lead Modal ────────────────────────────────────────────────
export function LeadModal({ lead, onClose, onSave, onDelete, userSession, teamMembers, onClientCreated, onTarefaCreated }: {
  lead: CRMLead; onClose: () => void;
  onSave: (updated: Partial<CRMLead>) => Promise<void>;
  onDelete: (leadId: string) => void;
  userSession: any; teamMembers: TeamMember[]; onClientCreated?: () => void;
  onTarefaCreated?: (tarefa: CRMTarefa) => void;
}) {
  const isAdmin = (userSession?.role ?? '').toLowerCase() === 'admin';
  const [etapa, setEtapa] = useState(lead.etapa);
  const [closerResponsavel, setCloserResponsavel] = useState(lead.closer_responsavel ?? '');
  const [sdrResponsavel, setSdrResponsavel] = useState(lead.sdr_responsavel ?? '');
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
  const [agTipo, setAgTipo] = useState<'ligacao' | 'follow-up' | null>(null);
  const [agTitulo, setAgTitulo] = useState('');
  const [agData, setAgData] = useState('');
  const [agResponsavel, setAgResponsavel] = useState('');
  const [agSaving, setAgSaving] = useState(false);
  const [tab, setTab] = useState<'info' | 'timeline' | 'tarefas' | 'demandas'>('info');
  const [demandaVenda, setDemandaVenda] = useState<CRMDemandaVenda | null>(null);
  const [demandaSaving, setDemandaSaving] = useState(false);

  useEffect(() => {
    supabase.from('crm_demandas_venda').select('*').eq('lead_id', lead.id).maybeSingle()
      .then(({ data }) => { if (data) setDemandaVenda(data); });
  }, [lead.id]);

  const toggleDemanda = async (field: keyof CRMDemandaVenda) => {
    if (!demandaVenda || demandaSaving) return;
    const allComplete = demandaVenda.contrato_feito && demandaVenda.contrato_assinado &&
      demandaVenda.sinal_pago && demandaVenda.entrada_paga &&
      demandaVenda.onboarding_agendado && demandaVenda.grupo_criado &&
      demandaVenda.membros_adicionados && demandaVenda.mensagem_saudacao;
    if (allComplete) return;
    const newVal = !demandaVenda[field];
    setDemandaSaving(true);

    const updates: Partial<CRMDemandaVenda> = { [field]: newVal, updated_at: new Date().toISOString() };

    if (field === 'contrato_feito' && !newVal) {
      updates.contrato_assinado = false;
    }
    if (field === 'contrato_assinado' && newVal && !demandaVenda.contrato_feito) {
      updates.contrato_feito = true;
    }

    const updated = { ...demandaVenda, ...updates };
    setDemandaVenda(updated);

    await supabase.from('crm_demandas_venda').update(updates).eq('id', demandaVenda.id);

    const vendaValidada = (updated.contrato_assinado && updated.sinal_pago) || updated.entrada_paga;

    if (vendaValidada && etapa !== 'fechado') {
      const now = new Date().toISOString();
      await supabase.from('crm_leads').update({
        etapa: 'fechado', status: 'ganho', updated_at: now, etapa_desde: now,
      }).eq('id', lead.id);
      onSave({ etapa: 'fechado', status: 'ganho' });

      try {
        const parsedContrato = lead.valor_contrato ?? 0;
        const parsedMrr = lead.valor_mrr ?? 0;
        const dur = parsedMrr > 0 ? Math.round(parsedContrato / parsedMrr) : 12;
        const entryDate = new Date().toISOString().split('T')[0];
        const clienteData = {
          id: Date.now().toString(),
          name: lead.empresa || lead.nome,
          responsible: lead.closer_responsavel ?? '',
          plan: lead.programa_apresentado || 'Pro',
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
          razao_social: lead.empresa ?? '',
          tipo_pessoa: '',
          cpf_cnpj: '',
          endereco: '',
          email_contato: lead.email ?? '',
          telefone_contato: lead.telefone ?? '',
          nome_responsavel_financeiro: '',
          valor_contrato: parsedContrato,
          valor_cc: lead.valor_cc ?? 0,
          valor_mrr: parsedMrr,
          forma_pagamento: '',
          data_primeiro_vencimento: '',
        };
        const { error: clientErr } = await supabase.from('clients').insert(clienteData);
        if (!clientErr) onClientCreated?.();
      } catch (err) { console.error('Failed to create client on venda validation:', err); }

      syncPostgres(lead.lead_externo_id, {
        etapa: 'fechado', status: 'ganho',
        Data_Venda: now,
      });
      setEtapa('fechado');
    }

    if (!vendaValidada && etapa === 'fechado') {
      const now = new Date().toISOString();
      await supabase.from('crm_leads').update({
        etapa: 'fup_ativa', status: 'venda_pendente', updated_at: now, etapa_desde: now,
      }).eq('id', lead.id);
      onSave({ etapa: 'fup_ativa', status: 'venda_pendente' });
      setEtapa('fup_ativa');
    }

    setDemandaSaving(false);
  };
  // ── Agendar Reuniao (BANT) ──────────────────────────────────
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
          sdr: userSession?.name || '',
          observacoes: arObs,
        },
      };
      const webhookBase = import.meta.env.VITE_WEBHOOK_BASE?.replace('/webhook/dashboard', '') ?? 'https://webhook.m2black.com';
      const arResp = await fetch(`${webhookBase}/webhook/agendar-reuniao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // INSERT reuniao na tabela reunioes
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
          sdr: userSession?.name || '',
        });
      }
      const upd: Partial<CRMLead> = {
        etapa: 'rm_marcada',
        proxima_reuniao: new Date(arDataHora).toISOString(),
        faturamento: arFaturamento,
        closer_responsavel: arCloser,
        sdr_responsavel: lead.sdr_responsavel || userSession?.name || '',
        etapa_desde: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await onSave(upd);
      setEtapa('rm_marcada');
      setArSuccess(true);
      setTimeout(() => { setShowAgendarReuniao(false); setArSuccess(false); }, 2000);
    } catch (err) {
      console.error('Erro ao agendar reuniao:', err);
    }
    setArSaving(false);
  };

  // Reuniao Realizada section (rm_marcada)
  const [reuniaoRealizada, setReuniaoRealizada] = useState(false);
  const [rrStatusReuniao, setRrStatusReuniao] = useState<'Compareceu' | 'Nao compareceu' | null>(null);
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
      etapa, closer_responsavel: closerResponsavel, sdr_responsavel: sdrResponsavel, observacoes, faturamento, area, tags: localTags,
      programa_apresentado: programaApresentado || null,
      valor_contrato: valorContrato !== '' ? valorContrato : null,
      valor_cc: valorCc !== '' ? valorCc : null,
      valor_mrr: valorMrr !== '' ? valorMrr : null,
      updated_at: new Date().toISOString(),
    };
    if (etapa !== lead.etapa) upd.etapa_desde = new Date().toISOString();
    await onSave(upd);

    // Track closer_responsavel change in timeline
    if (closerResponsavel !== (lead.closer_responsavel ?? '')) {
      await supabase.from('crm_atividades').insert({
        lead_id: lead.id,
        tipo: 'alteracao',
        data_atividade: new Date().toISOString(),
        realizado_por: userSession?.name || '',
        descricao: JSON.stringify({
          campo: 'closer_responsavel',
          de: lead.closer_responsavel || '(sem responsavel)',
          para: closerResponsavel,
          obs: 'Alteracao manual de closer responsavel',
        }),
        created_at: new Date().toISOString(),
      });
      setAtividades(prev => [{
        id: `temp-${Date.now()}`,
        lead_id: lead.id,
        tipo: 'alteracao',
        data_atividade: new Date().toISOString(),
        realizado_por: userSession?.name || '',
        descricao: JSON.stringify({
          campo: 'closer_responsavel',
          de: lead.closer_responsavel || '(sem responsavel)',
          para: closerResponsavel,
          obs: 'Alteracao manual de closer responsavel',
        }),
        created_at: new Date().toISOString(),
      } as any, ...prev]);
    }
    // Track sdr_responsavel change in timeline
    if (sdrResponsavel !== (lead.sdr_responsavel ?? '')) {
      await supabase.from('crm_atividades').insert({
        lead_id: lead.id,
        tipo: 'alteracao',
        data_atividade: new Date().toISOString(),
        realizado_por: userSession?.name || '',
        descricao: JSON.stringify({
          campo: 'sdr_responsavel',
          de: lead.sdr_responsavel || '(sem responsavel)',
          para: sdrResponsavel,
          obs: 'Alteracao manual de SDR responsavel',
        }),
        created_at: new Date().toISOString(),
      });
      setAtividades(prev => [{
        id: `temp-${Date.now()}`,
        lead_id: lead.id,
        tipo: 'alteracao',
        data_atividade: new Date().toISOString(),
        realizado_por: userSession?.name || '',
        descricao: JSON.stringify({
          campo: 'sdr_responsavel',
          de: lead.sdr_responsavel || '(sem responsavel)',
          para: sdrResponsavel,
          obs: 'Alteracao manual de SDR responsavel',
        }),
        created_at: new Date().toISOString(),
      } as any, ...prev]);
    }

    // Sync closer → Railway quando responsavel muda (fire-and-forget)
    if (lead.lead_externo_id && closerResponsavel !== (lead.closer_responsavel ?? '')) {
      syncPostgres(lead.lead_externo_id, { closer: closerResponsavel, sdr: sdrResponsavel });
      fetch(`${WEBHOOK_BASE}/webhook/crm-sync-etapa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_externo_id: lead.lead_externo_id,
          closer: closerResponsavel,
          sdr: sdrResponsavel,
        }),
      }).catch(e => console.warn('[sync closer]', e));
    }

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
      if (closerResponsavel) infoFields.closer = closerResponsavel;
      if (sdrResponsavel) infoFields.sdr = sdrResponsavel;
      syncPostgres(lead.lead_externo_id, infoFields);
    }

    // Sync mudanca de etapa → Railway via n8n (fire-and-forget)
    // Pular rm_marcada: o syncPostgres correto (com Data_Reuniao_Marcada) ja e disparado pelo formulario de atividade
    if (lead.lead_externo_id && etapa !== lead.etapa && etapa !== 'rm_marcada') {
      syncPostgres(lead.lead_externo_id, { etapa, closer: closerResponsavel || null, sdr: sdrResponsavel || null });
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
    if (upd.closer_responsavel) setCloserResponsavel(upd.closer_responsavel);
    if (upd.sdr_responsavel) setSdrResponsavel(upd.sdr_responsavel);
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

    // Bloco 6: Auto-concluir tarefa de reuniao pendente do lead (match por tipo)
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
      leadUpd.etapa = 'fup_ativa'; leadUpd.status = 'venda_pendente';
    } else if (rrResultado === 'Perdido') {
      leadUpd.etapa = 'perdido'; leadUpd.status = 'perdido';
      leadUpd.motivo_perda = rrMotivoPerda || null;
    } else if (rrStatusReuniao === 'Não compareceu') {
      // No-show: permanece em rm_marcada, nao muda etapa
      delete leadUpd.etapa_desde;
    } else {
      leadUpd.etapa = 'rm_realizada';
    }
    // Add No-show tag inline to avoid stale-state race condition
    if (rrStatusReuniao === 'Não compareceu') {
      const tagsNoShow = [...(lead.tags ?? [])];
      if (!tagsNoShow.includes('No-show')) tagsNoShow.push('No-show');
      leadUpd.tags = tagsNoShow;
    }
    await supabase.from('crm_leads').update(leadUpd).eq('id', lead.id);
    await onSave(leadUpd);

    // Criar registro de demandas da venda (nao cria cliente ainda)
    if (rrResultado === 'Venda') {
      await supabase.from('crm_demandas_venda').upsert({
        lead_id: lead.id,
        contrato_feito: false, contrato_assinado: false,
        sinal_pago: false, entrada_paga: false,
        onboarding_agendado: false, grupo_criado: false,
        membros_adicionados: false, mensagem_saudacao: false,
      }, { onConflict: 'lead_id' });
    }

    // 3. comercial_tasks
    try {
      const taskData2 = {
        id: crypto.randomUUID(), type: 'Vendas', category: 'Reunião',
        collaborator: lead.closer_responsavel || userSession?.name || '', meeting_status: rrStatusReuniao,
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
            closer: closerResponsavel || userSession?.name || '',
            sdr: sdrResponsavel || userSession?.name || '',
            tipo_reuniao: webhookTipoReuniao,
            data_hora: new Date(rrProximaReuniao).toISOString(),
            duracao_min: 60,
            reagendamento: rrResultado === 'Reagendou',
            bant: { sdr: sdrResponsavel || userSession?.name || '' },
          }),
        }).catch(e => { console.warn('Webhook agendar-reuniao (CORS em dev):', e.message); return null; });
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
      const closer = closerResponsavel || null;
      const currentTP = resolvedTP_rr;

      if (rrStatusReuniao === 'Não compareceu') {
        // Bloco 6: UPDATE reuniao → No-show
        syncPostgres(lead.lead_externo_id, {
          reuniao_action: 'resultado',
          crm_lead_id: lead.id,
          reuniao_tp: currentTP,
          reuniao_status: 'No-show',
          reuniao_resultado: 'No-show',
          closer,
        });
      } else if (rrStatusReuniao === 'Compareceu') {
        if (rrResultado === 'Marcou R2+') {
          // Bloco 2: UPDATE reuniao atual → Compareceu + INSERT R2
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
              sdr: userSession?.name || '',
            });
          }
        } else if (rrResultado === 'Reagendou') {
          // Bloco 7: UPDATE Reagendou + INSERT mesma TP (atomico)
          if (rrProximaReuniao) {
            const horaReag = new Date(rrProximaReuniao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: SP_TZ });
            syncPostgres(lead.lead_externo_id, {
              reuniao_action: 'resultado_e_reagendar',
              crm_lead_id: lead.id,
              reuniao_tp: currentTP,
              reuniao_status: 'Reagendou',
              reuniao_resultado: 'Reagendou',
              closer,
              sdr: userSession?.name || '',
              nova_data_marcada: new Date(rrProximaReuniao).toISOString().split('T')[0],
              nova_hora_marcada: horaReag,
              novo_tp: currentTP,
            });
          }
        } else if (rrResultado === 'Venda') {
          // Bloco 3: UPDATE reuniao → Venda
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
          // Bloco 4: UPDATE reuniao → Perdido
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
          // Bloco 5: UPDATE reuniao → Pendente
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

    // Update local tags if No-show was added
    if (rrStatusReuniao === 'Não compareceu' && leadUpd.tags) {
      setLocalTags(leadUpd.tags);
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
      // Atualizar proxima_reuniao no lead se aplicavel
      const agDate = parseDateSP(reagendarData);
      if (agDate > new Date()) {
        await supabase.from('crm_leads').update({ proxima_reuniao: novaData, updated_at: new Date().toISOString() }).eq('id', lead.id);
        onSave({ proxima_reuniao: novaData });
      }
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
            closer: t.responsavel || lead.closer_responsavel || '',
            sdr: lead.sdr_responsavel || userSession?.name || '',
            tipo_reuniao: t.titulo?.includes('R2') ? 'R2' : 'R1',
            data_hora: new Date(reagendarData).toISOString(),
            duracao_min: 60,
            reagendamento: true,
            bant: { sdr: lead.sdr_responsavel || userSession?.name || '' },
          }),
        }).catch(() => null);
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
          closer: t.responsavel || lead.closer_responsavel || null,
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

    // 2. comercial_tasks (relatorio)
    const collaborator = t.responsavel || lead.closer_responsavel || lead.sdr_responsavel || userSession?.name || '';
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
                  // Remove tarefas associadas ao lead excluido
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
          {(() => {
            const tabs: [string, string][] = [['info','Informações'], ['timeline','Atividades'], ['tarefas','Tarefas']];
            if (demandaVenda) tabs.push(['demandas', 'Demandas da Venda']);
            return tabs;
          })().map(([id, label]) => (
            <button key={id} onClick={() => setTab(id as any)}
              className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors ${tab === id ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-500 hover:text-gray-300'}`}
            >{label} {id === 'timeline' && atividades.length > 0 && `(${atividades.length})`}</button>
          ))}
        </div>

        <div className="p-5 space-y-4">
          {/* ── TAB: INFORMACOES ─────────── */}
          {tab === 'info' && (<>
            {/* Dados basicos */}
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

            {/* Editaveis: Area + Faturamento */}
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

            {/* SDR Responsavel */}
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">SDR Responsável</label>
              {isAdmin ? (
                <select value={sdrResponsavel} onChange={e => setSdrResponsavel(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
                >
                  <option value="" className="bg-bg-main">Sem responsável</option>
                  {teamMembers.filter(m => ['admin','comercial'].includes((m.role ?? '').toLowerCase()))
                    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                    .map(m => <option key={m.id} value={m.name} className="bg-bg-main">{m.name}</option>)}
                </select>
              ) : <p className="text-sm text-gray-300">{sdrResponsavel || '—'}</p>}
            </div>

            {/* Closer Responsavel — visivel apenas a partir de rm_marcada */}
            {!['base', 'triagem'].includes(etapa) && (
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Closer Responsável</label>
                {isAdmin ? (
                  <select value={closerResponsavel} onChange={e => setCloserResponsavel(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
                  >
                    <option value="" className="bg-bg-main">Sem responsável</option>
                    {teamMembers.filter(m => ['admin','comercial'].includes((m.role ?? '').toLowerCase()))
                      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                      .map(m => <option key={m.id} value={m.name} className="bg-bg-main">{m.name}</option>)}
                  </select>
                ) : <p className="text-sm text-gray-300">{closerResponsavel || '—'}</p>}
              </div>
            )}

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

            {/* Info financeira pos-reuniao */}
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
                {CRM_ALL_TAGS.map(tag => {
                  const active = localTags.includes(tag);
                  return (
                    <button key={tag} onClick={() => setLocalTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                      className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-all ${active ? CRM_TAGS_CONFIG[tag] : 'bg-white/5 text-gray-600 border-white/10 hover:border-white/20'}`}
                    >{tag}</button>
                  );
                })}
              </div>
            </div>

            {/* Negociacao */}
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

            {/* Observacoes */}
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

            {/* Lead Score breakdown */}
            {(() => {
              const hasData = lead.faturamento || lead.investimento || lead.funcionarios || lead.area;
              if (!hasData && !(lead.lead_score && lead.lead_score > 0)) {
                return (
                  <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Lead Score</p>
                    <p className="text-xs text-gray-600 italic">Score não calculado — dados insuficientes</p>
                  </div>
                );
              }
              const result = getLeadScore(lead);
              const gs = GRADE_STYLE[result.grade] || GRADE_STYLE.D;
              const bd = result.breakdown || calcLeadScore(lead).breakdown;
              const bars: { label: string; value: number; max: number; hint: string }[] = [
                { label: 'Faturamento', value: bd.faturamento, max: 40, hint: lead.faturamento || '—' },
                { label: 'Investimento', value: bd.investimento, max: 30, hint: lead.investimento || '—' },
                { label: 'Funcionários', value: bd.funcionarios, max: 20, hint: lead.funcionarios || '—' },
                { label: 'Área', value: bd.area, max: 10, hint: lead.area || '—' },
              ];
              return (
                <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600">Lead Score</p>
                    <span style={{ fontSize: 13, fontWeight: 700, padding: '2px 10px', borderRadius: 6, border: `1px solid ${gs.border}`, background: gs.background, color: gs.color }}>{result.score} ({result.grade})</span>
                  </div>
                  <div className="space-y-1.5">
                    {bars.map(b => (
                      <div key={b.label} className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-500">{b.label}: {b.value}/{b.max}</span>
                          <span className="text-[10px] text-gray-600 truncate max-w-[140px]">{b.hint}</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${(b.value / b.max) * 100}%`, background: gs.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

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
                if (a.tipo === 'alteracao') {
                  let desc: any = {};
                  try { desc = typeof a.descricao === 'string' ? JSON.parse(a.descricao) : (a.descricao ?? {}); } catch { /* */ }
                  return (
                    <div key={a.id} className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center mt-0.5">
                        <ArrowRightLeft size={13} className="text-yellow-400" />
                      </div>
                      <div className="flex-1 bg-yellow-500/5 rounded-xl p-3 space-y-1 border-l-2 border-yellow-500/40">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-500">Alteração</span>
                          <span className="text-[9px] text-gray-700">{fmtAtivDate(a.created_at)}</span>
                        </div>
                        <p className="text-xs text-gray-300">Responsável alterado de <span className="font-bold text-red-400">{desc.de}</span> para <span className="font-bold text-brand-primary">{desc.para}</span></p>
                        {a.realizado_por && <p className="text-[9px] text-gray-600">por {a.realizado_por}{desc.obs ? ` — ${desc.obs}` : ''}</p>}
                      </div>
                    </div>
                  );
                }
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
              {/* Agendar proxima atividade */}
              {showAgendarTarefa ? (
                <div className="space-y-3 bg-white/[0.02] border border-white/10 rounded-xl p-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-brand-primary">Agendar Próxima Atividade</p>
                  {/* Tipo da atividade */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {([['ligacao', 'Ligação'], ['follow-up', 'Follow-up']] as const).map(([key, label]) => (
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

          {/* ── TAB: DEMANDAS DA VENDA ── */}
          {tab === 'demandas' && demandaVenda && (() => {
            const demandaCompleta = demandaVenda.contrato_feito && demandaVenda.contrato_assinado &&
              demandaVenda.sinal_pago && demandaVenda.entrada_paga &&
              demandaVenda.onboarding_agendado && demandaVenda.grupo_criado &&
              demandaVenda.membros_adicionados && demandaVenda.mensagem_saudacao;
            return (
            <div className="space-y-4">
              {demandaCompleta && (
                <div className="bg-green-900/30 text-green-400 border border-green-500/30 p-3 rounded-xl text-xs font-bold text-center mb-4">
                  Processo completo — todas as demandas foram atendidas
                </div>
              )}
              {/* Checklist que define a venda */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2">Validação da Venda</p>
                <p className="text-[9px] text-gray-500 mb-3">A venda só é contabilizada quando: (Contrato assinado + Sinal pago) ou (Entrada paga)</p>
                <div className="space-y-2">
                  {([
                    ['contrato_feito', 'Contrato feito (enviado ao cliente)'],
                    ['contrato_assinado', 'Contrato assinado'],
                    ['sinal_pago', 'Sinal pago'],
                    ['entrada_paga', 'Entrada paga (cash collect)'],
                  ] as const).map(([field, label]) => (
                    <label key={field} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      demandaVenda[field]
                        ? 'bg-brand-primary/10 border-brand-primary/30'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    } ${demandaCompleta ? 'opacity-60 pointer-events-none' : field === 'contrato_assinado' && !demandaVenda.contrato_feito ? 'opacity-40 pointer-events-none' : ''}`}>
                      <input type="checkbox" checked={demandaVenda[field]} onChange={() => toggleDemanda(field)}
                        disabled={demandaCompleta} className="w-4 h-4 rounded accent-brand-primary" />
                      <span className={`text-xs ${demandaVenda[field] ? 'text-brand-primary font-semibold' : 'text-gray-400'}`}>{label}</span>
                      {!demandaCompleta && field === 'contrato_assinado' && !demandaVenda.contrato_feito && (
                        <span className="text-[9px] text-gray-600 ml-auto">Faça o contrato primeiro</span>
                      )}
                    </label>
                  ))}
                </div>
                {/* Status da venda */}
                {(() => {
                  const v = (demandaVenda.contrato_assinado && demandaVenda.sinal_pago) || demandaVenda.entrada_paga;
                  return (
                    <div className={`mt-3 p-3 rounded-xl text-xs font-bold text-center ${v ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-yellow-900/20 text-yellow-500 border border-yellow-500/20'}`}>
                      {v ? 'Venda validada — contabilizada no dashboard' : 'Venda pendente de validação'}
                    </div>
                  );
                })()}
              </div>

              {/* Checklist de processo */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2">Processo de Ativação</p>
                <div className="space-y-2">
                  {([
                    ['onboarding_agendado', 'Onboarding agendado'],
                    ['grupo_criado', 'Grupo criado'],
                    ['membros_adicionados', 'Adicionou os membros'],
                    ['mensagem_saudacao', 'Enviou mensagem de saudação'],
                  ] as const).map(([field, label]) => (
                    <label key={field} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      demandaVenda[field]
                        ? 'bg-brand-primary/10 border-brand-primary/30'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    } ${demandaCompleta ? 'opacity-60 pointer-events-none' : ''}`}>
                      <input type="checkbox" checked={demandaVenda[field]} onChange={() => toggleDemanda(field)}
                        disabled={demandaCompleta} className="w-4 h-4 rounded accent-brand-primary" />
                      <span className={`text-xs ${demandaVenda[field] ? 'text-brand-primary font-semibold' : 'text-gray-400'}`}>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            );
          })()}
        </div>
      </motion.div>
    </div>
  );
}
