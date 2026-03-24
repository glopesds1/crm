import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './lib/supabase';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, RefreshCw, Search, Phone, Building2, DollarSign,
  User, X, ChevronRight, Loader2, MapPin, Clock,
  PhoneCall, Users, FileText, Calendar, CheckCircle2,
  ChevronDown, Trash2, Bell, Volume2
} from 'lucide-react';
import type { TeamMember } from './types';
import { DEFAULT_ONBOARDING_ITEMS } from './constants';

// ── Helpers ───────────────────────────────────────────────────
// datetime-local retorna "2026-03-24T18:00" sem timezone.
// Ao criar new Date() o browser interpreta como local, mas ao enviar
// a string crua pro Supabase (timestamptz) ele interpreta como UTC.
// Esta função adiciona o offset local para preservar o horário correto.
function localDatetimeToISO(dt: string): string {
  if (!dt) return dt;
  const d = new Date(dt);
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const mm = String(Math.abs(offset) % 60).padStart(2, '0');
  return `${dt}:00${sign}${hh}:${mm}`;
}

// ── Types ─────────────────────────────────────────────────────
interface CRMLead {
  id: string;
  lead_externo_id?: string;
  nome: string;
  telefone?: string;
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
  const fmtDate = (d: string) => { try { return format(new Date(d), 'dd/MM HH:mm'); } catch { return '—'; } };
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`bg-bg-card border ${etapa?.color ?? 'border-white/10'} border-l-2 rounded-xl p-3 cursor-pointer hover:bg-white/5 transition-colors space-y-2`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-white leading-tight line-clamp-1">{lead.nome}</p>
        <ChevronRight size={12} className="text-gray-600 flex-shrink-0 mt-0.5" />
      </div>
      {lead.telefone && <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><Phone size={9} className="text-gray-600" />{lead.telefone}</div>}
      {lead.area && <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><MapPin size={9} className="text-gray-600" /><span className="truncate">{lead.area}</span></div>}
      {lead.faturamento && <div className="flex items-center gap-1.5 text-[10px] text-gray-500"><DollarSign size={9} className="text-gray-600" />{lead.faturamento}</div>}
      {lead.responsavel && <div className="flex items-center gap-1.5 text-[10px] text-gray-500"><User size={9} className="text-gray-600" />{lead.responsavel}</div>}
      {lead.programa_apresentado && <div className={`text-[10px] ${getProgramaStyle(lead.programa_apresentado)}`}>{lead.programa_apresentado}</div>}
      {lead.valor_contrato != null && lead.valor_contrato > 0 && (
        <div className="text-[10px] font-bold text-brand-primary">Contrato: R$ {Number(lead.valor_contrato).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
      )}
      {lead.valor_cc != null && lead.valor_cc > 0 && (
        <div className="text-[10px] font-bold text-blue-400">Cash Collect: R$ {Number(lead.valor_cc).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
      )}
      {lead.etapa === 'rm_marcada' && lead.proxima_reuniao && (
        <div className="flex items-center gap-1.5 text-[10px] text-yellow-400 bg-yellow-900/20 rounded-lg px-2 py-1">
          <Calendar size={9} />
          <span>R1 - {fmtDate(lead.proxima_reuniao)}</span>
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
      <div className="text-[9px] text-gray-700 pt-1 border-t border-white/5">
        {lead.created_at ? new Date(lead.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '—'}
      </div>
    </motion.div>
  );
}

// ── Nova Atividade Form ────────────────────────────────────────
function NovaAtividadeForm({ lead: leadObj, leadId, leadName, userSession, onSaved, onCancel, onLeadUpdated, onClientCreated, onTarefaCreated }: {
  lead?: CRMLead; leadId: string; leadName: string; userSession: any; onSaved: (a: CRMAtividade) => void; onCancel: () => void; onLeadUpdated?: (upd: Partial<CRMLead>) => void; onClientCreated?: () => void;
  onTarefaCreated?: (tarefa: CRMTarefa) => void;
}) {
  const [tipo, setTipo] = useState<'ligacao' | 'reuniao'>('ligacao');
  const [statusChamada, setStatusChamada] = useState<'Atendeu' | 'Não atendeu' | null>(null);
  const [touchpoint, setTouchpoint] = useState('');
  const [agendou, setAgendou] = useState(false);
  const [statusReuniao, setStatusReuniao] = useState<'Compareceu' | 'Não compareceu' | null>(null);
  const [resultado, setResultado] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tituloTarefa, setTituloTarefa] = useState('');
  const [dataAgendada, setDataAgendada] = useState('');
  const [saving, setSaving] = useState(false);
  const [erroMotivo, setErroMotivo] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  // Reunião extra fields
  const [valorContrato, setValorContrato] = useState('');
  const [valorCc, setValorCc] = useState('');
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
  const [motivoPerda, setMotivoPerda] = useState('');
  // Ligação extra fields
  const [resumoLigacao, setResumoLigacao] = useState('');
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [nomeLeadConfirmado, setNomeLeadConfirmado] = useState('');
  const [motivoNaoAtendeu, setMotivoNaoAtendeu] = useState('');

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

  const handleSave = async () => {
    if (resultado === 'Perdido' && !motivoPerda.trim()) { setErroMotivo(true); return; }
    setSaving(true);
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
      if (nomeLeadConfirmado) extras.nome_lead_confirmado = nomeLeadConfirmado;
      if (dataAgendamento) extras.data_agendamento = dataAgendamento;
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
      realizado_por: userSession?.name ?? '',
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
      // Auto-create task + move to rm_marcada when agendou
      if (agendou && dataAgendamento) {
        try {
          const { data: newTask } = await supabase.from('crm_tarefas').insert({
            lead_id: leadId,
            titulo: `Reunião - ${leadName}`,
            data_agendada: localDatetimeToISO(dataAgendamento),
            responsavel: userSession?.name ?? '',
            concluida: false,
            created_at: now,
          }).select().single();
          if (newTask) onTarefaCreated?.(newTask);
        } catch (err) {
          console.error('Failed to create scheduled meeting task:', err);
        }
        // Move lead to rm_marcada
        try {
          const leadUpd: Partial<CRMLead> = {
            etapa: 'rm_marcada',
            etapa_desde: now,
            proxima_reuniao: localDatetimeToISO(dataAgendamento),
            updated_at: now,
          };
          await supabase.from('crm_leads').update(leadUpd).eq('id', leadId);
          onLeadUpdated?.(leadUpd);
        } catch (err) {
          console.error('Failed to update lead to rm_marcada:', err);
        }
      }
    } else if (tipo === 'reuniao') {
      try {
        if (resultado === 'Venda') {
          await supabase.from('crm_leads').update({
            etapa: 'fechado', status: 'ganho',
            valor_contrato: valorContrato ? parseFloat(valorContrato) : null,
            valor_cc: valorCc ? parseFloat(valorCc) : null,
            valor_mrr: prazoMeses && valorContrato ? parseFloat(valorContrato) / parseInt(prazoMeses) : null,
            updated_at: now, etapa_desde: now,
          }).eq('id', leadId);

          // Auto-create client
          try {
            const parsedContrato = valorContrato ? parseFloat(valorContrato) : 0;
            const parsedMrr = prazoMeses && valorContrato ? parseFloat(valorContrato) / parseInt(prazoMeses) : 0;
            const dur = parsedMrr ? Math.round(parsedContrato / parsedMrr) : 12;
            const entryDate = new Date().toISOString().split('T')[0];
            const clienteData = {
              id: Date.now().toString(),
              name: leadName,
              responsible: leadObj?.responsavel ?? '',
              plan: leadObj?.programa_apresentado === 'Pro' ? 'Pro' : leadObj?.programa_apresentado === 'Lite' ? 'Lite' : 'Basic',
              status: 'Onboarding',
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

          // Notify Juliana via n8n (fire-and-forget)
          try {
            fetch('https://webhook.m2black.com/webhook/venda-fechada', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nome: leadName,
                telefone: leadObj?.telefone,
                programa: leadObj?.programa_apresentado,
                valor_contrato: valorContrato ? parseFloat(valorContrato) : null,
                valor_cc: valorCc ? parseFloat(valorCc) : null,
                valor_mrr: prazoMeses && valorContrato ? parseFloat(valorContrato) / parseInt(prazoMeses) : null,
                responsavel: leadObj?.responsavel,
                razao_social: razaoSocial,
                cnpj: cpfCnpj,
                responsavel_empresa: nomeResponsavel,
              }),
            }).catch(e => console.warn('Webhook venda-fechada (CORS em dev):', e.message));
          } catch (e) { console.warn('Webhook venda-fechada:', e); }
        } else if (resultado === 'Perdido') {
          await supabase.from('crm_leads').update({
            etapa: 'perdido', status: 'perdido',
            motivo_perda: motivoPerda || null,
            updated_at: now, etapa_desde: now,
          }).eq('id', leadId);
        }
      } catch (err) {
        console.error('Failed to update lead after reunião:', err);
      }

      // Auto-create task for R2+ / Reagendou
      if ((resultado === 'Marcou R2+' || resultado === 'Reagendou') && proximaReuniao) {
        try {
          const { data: r2Task } = await supabase.from('crm_tarefas').insert({
            lead_id: leadId,
            titulo: `R2+ - ${leadName}`,
            data_agendada: localDatetimeToISO(proximaReuniao),
            responsavel: userSession?.name ?? '',
            concluida: false,
            created_at: now,
          }).select().single();
          if (r2Task) onTarefaCreated?.(r2Task);
        } catch (err) {
          console.error('Failed to create R2+ task:', err);
        }
      }
    }

    // Mirror to comercial_tasks (fire-and-forget)
    try {
      const taskData = {
        id: crypto.randomUUID(),
        type: tipo === 'ligacao' ? 'PreVendas' : 'Vendas',
        category: tipo === 'ligacao' ? 'Ligação' : 'Reunião',
        collaborator: userSession?.name ?? '',
        answered: tipo === 'ligacao' ? statusChamada : null,
        touchpoint: tipo === 'ligacao' && touchpoint ? parseInt(touchpoint) : null,
        scheduled: tipo === 'ligacao' ? agendou : false,
        meeting_status: tipo === 'reuniao' ? statusReuniao : null,
        sale_status: tipo === 'reuniao' ? resultado || null : null,
        contract_value: tipo === 'reuniao' && valorContrato ? parseFloat(valorContrato) : null,
        cash_collect: tipo === 'reuniao' && valorCc ? parseFloat(valorCc) : null,
        next_meeting_date: tipo === 'reuniao' && proximaReuniao ? localDatetimeToISO(proximaReuniao) : (tipo === 'ligacao' && agendou && dataAgendamento ? localDatetimeToISO(dataAgendamento) : null),
        loss_reason: tipo === 'reuniao' && motivoPerda ? motivoPerda : (tipo === 'ligacao' && statusChamada === 'Não atendeu' && motivoNaoAtendeu ? motivoNaoAtendeu : null),
        company_name: tipo === 'reuniao' && razaoSocial ? razaoSocial : null,
        responsible_name: tipo === 'reuniao' && nomeResponsavel ? nomeResponsavel : null,
        completion_time: format(new Date(), 'dd/MM/yyyy HH:mm'),
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
          <button key={t} onClick={() => setTipo(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tipo === t ? 'bg-brand-primary text-black' : 'bg-white/5 text-gray-400 hover:text-white'}`}
          >
            {t === 'ligacao' ? '📞 Ligação' : '🤝 Reunião'}
          </button>
        ))}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Touchpoint</label>
              <input type="number" value={touchpoint} onChange={e => setTouchpoint(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
              />
            </div>
            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={agendou} onChange={e => setAgendou(e.target.checked)} className="w-4 h-4 accent-brand-primary" />
                <span className="text-xs text-gray-400">Marcou reunião</span>
              </label>
            </div>
          </div>

          {/* Resumo da ligação */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Resumo da ligação</label>
            <textarea value={resumoLigacao} onChange={e => setResumoLigacao(e.target.value)} rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-primary resize-none"
              placeholder="O que foi conversado..."
            />
          </div>

          {/* Agendou — dados do agendamento */}
          {agendou && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Data/hora da reunião</label>
                <input type="datetime-local" value={dataAgendamento} onChange={e => setDataAgendamento(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-brand-primary"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Nome confirmado</label>
                <input value={nomeLeadConfirmado} onChange={e => setNomeLeadConfirmado(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                  placeholder="Nome do lead"
                />
              </div>
            </div>
          )}

          {/* Não atendeu — motivo */}
          {statusChamada === 'Não atendeu' && (
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Motivo</label>
              <select value={motivoNaoAtendeu} onChange={e => setMotivoNaoAtendeu(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
              >
                <option value="" className="bg-bg-main">Selecionar...</option>
                {['Não atendeu', 'Caixa postal', 'Número errado', 'Bloqueou', 'Outro'].map(m => <option key={m} value={m} className="bg-bg-main">{m}</option>)}
              </select>
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
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Resultado</label>
            <select value={resultado} onChange={e => setResultado(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
            >
              <option value="" className="bg-bg-main">Selecionar...</option>
              {['Venda', 'Marcou R2+', 'Reagendou', 'Perdido', 'Pendente'].map(r => <option key={r} value={r} className="bg-bg-main">{r}</option>)}
            </select>
          </div>

          {/* Campos base reunião */}
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
          {(resultado === 'Marcou R2+' || resultado === 'Reagendou') && (
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Próxima Reunião</label>
              <input type="datetime-local" value={proximaReuniao} onChange={e => setProximaReuniao(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-brand-primary"
              />
            </div>
          )}

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
        </>
      )}

      <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2}
        placeholder="Observações sobre a atividade..."
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-primary resize-none"
      />

      {/* Upload de print */}
      <div>
        <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Print da tela (opcional)</label>
        <input type="file" accept="image/*" onChange={handleImageChange}
          className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-white/10 file:text-gray-300 hover:file:bg-white/20 file:cursor-pointer file:transition-colors"
        />
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

      {/* Agendar próxima atividade */}
      <div className="border-t border-white/5 pt-3 space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600">Agendar próxima atividade</p>
        <div className="grid grid-cols-2 gap-2">
          <input value={tituloTarefa} onChange={e => setTituloTarefa(e.target.value)}
            placeholder="Título da tarefa"
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-700 focus:outline-none focus:border-brand-primary"
          />
          <input type="datetime-local" value={dataAgendada} onChange={e => setDataAgendada(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand-primary"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl bg-white/5 text-xs text-gray-400 hover:text-white transition-colors">Cancelar</button>
        <button onClick={handleSave} disabled={saving}
          className="flex-1 py-2 rounded-xl bg-brand-primary text-black text-xs font-bold hover:bg-brand-primary/80 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          Registrar
        </button>
      </div>
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
  const [showAgendarTarefa, setShowAgendarTarefa] = useState(false);
  const [agTitulo, setAgTitulo] = useState('');
  const [agData, setAgData] = useState('');
  const [agResponsavel, setAgResponsavel] = useState('');
  const [agSaving, setAgSaving] = useState(false);
  const [tab, setTab] = useState<'info' | 'timeline' | 'tarefas'>('info');
  // Reunião Realizada section (rm_marcada)
  const [reuniaoRealizada, setReuniaoRealizada] = useState(false);
  const [rrStatusReuniao, setRrStatusReuniao] = useState<'Compareceu' | 'Não compareceu' | null>(null);
  const [rrResultado, setRrResultado] = useState('');
  const [rrValorContrato, setRrValorContrato] = useState('');
  const [rrValorCc, setRrValorCc] = useState('');
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
    setSaving(false);
  };

  const handleAtivSaved = (a: CRMAtividade) => {
    setAtividades(prev => [a, ...prev]);
    setShowAtivForm(false);
    setTab('timeline');
  };

  const handleLeadUpdated = (upd: Partial<CRMLead>) => {
    onSave(upd);
    if (upd.etapa) setEtapa(upd.etapa);
  };

  const handleAgendarTarefa = async () => {
    setAgSaving(true);
    try {
      const now = new Date().toISOString();
      const { data } = await supabase.from('crm_tarefas').insert({
        lead_id: lead.id,
        titulo: agTitulo.trim(),
        data_agendada: localDatetimeToISO(agData),
        responsavel: agResponsavel || (userSession?.name ?? ''),
        concluida: false,
        created_at: now,
      }).select().single();
      if (data) { setTarefas(prev => [...prev, data]); onTarefaCreated?.(data); }
      // Update proxima_reuniao if this task is sooner
      const agDate = new Date(agData);
      if (agDate > new Date() && (!lead.proxima_reuniao || agDate < new Date(lead.proxima_reuniao))) {
        await supabase.from('crm_leads').update({ proxima_reuniao: localDatetimeToISO(agData) }).eq('id', lead.id);
        onSave({ proxima_reuniao: localDatetimeToISO(agData) });
      }
      setShowAgendarTarefa(false);
      setAgTitulo(''); setAgData(''); setAgResponsavel('');
      setTab('tarefas');
    } catch (err) { console.error('Failed to schedule task:', err); }
    setAgSaving(false);
  };

  const handleSaveReuniao = async () => {
    if (!rrImageFile) { setRrImageError(true); return; }
    if (rrResultado === 'Perdido' && !rrMotivoPerda.trim()) { setRrErroMotivo(true); return; }
    setRrSaving(true);
    const now = new Date().toISOString();

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
          responsible: lead.responsavel ?? '',
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

      // Notify Juliana via n8n (fire-and-forget)
      try {
        fetch('https://webhook.m2black.com/webhook/venda-fechada', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome: lead.nome,
            telefone: lead.telefone,
            programa: lead.programa_apresentado,
            valor_contrato: rrValorContrato ? parseFloat(rrValorContrato) : null,
            valor_cc: rrValorCc ? parseFloat(rrValorCc) : null,
            valor_mrr: computedMrr,
            responsavel: lead.responsavel,
            razao_social: rrRazaoSocial,
            cnpj: rrCpfCnpj,
            responsavel_empresa: rrNomeResponsavel,
          }),
        }).catch(e => console.warn('Webhook venda-fechada (CORS em dev):', e.message));
      } catch (e) { console.warn('Webhook venda-fechada:', e); }
    }

    // 3. comercial_tasks
    try {
      const taskData2 = {
        id: crypto.randomUUID(), type: 'Vendas', category: 'Reunião',
        collaborator: userSession?.name ?? '', meeting_status: rrStatusReuniao,
        sale_status: rrResultado || null,
        contract_value: rrValorContrato ? parseFloat(rrValorContrato) : null,
        cash_collect: rrValorCc ? parseFloat(rrValorCc) : null,
        next_meeting_date: rrProximaReuniao ? localDatetimeToISO(rrProximaReuniao) : null, loss_reason: rrMotivoPerda || null,
        image_url: uploadedUrl || '', completion_time: format(new Date(), 'dd/MM/yyyy HH:mm'),
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
      try {
        const { data: rrTask } = await supabase.from('crm_tarefas').insert({
          lead_id: lead.id, titulo: `R2+ - ${lead.nome}`,
          data_agendada: localDatetimeToISO(rrProximaReuniao), responsavel: userSession?.name ?? '',
          concluida: false, created_at: now,
        }).select().single();
        if (rrTask) onTarefaCreated?.(rrTask);
      } catch (err) { console.error('R2+ task failed:', err); }
    }

    // 5. Update local state
    if (ativData) setAtividades(prev => [ativData, ...prev]);
    if (leadUpd.etapa) setEtapa(leadUpd.etapa);
    if (leadUpd.valor_contrato != null) setValorContrato(leadUpd.valor_contrato);
    if (leadUpd.valor_cc != null) setValorCc(leadUpd.valor_cc);
    if (leadUpd.valor_mrr != null) setValorMrr(leadUpd.valor_mrr);
    setReuniaoRealizada(false);
    setRrSaving(false);
    setTab('timeline');
  };

  const toggleTarefa = async (t: CRMTarefa) => {
    await supabase.from('crm_tarefas').update({ concluida: !t.concluida }).eq('id', t.id);
    setTarefas(prev => prev.map(x => x.id === t.id ? { ...x, concluida: !x.concluida } : x));
  };

  const etapaObj = ETAPA_MAP[etapa];

  const fmtAtivDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });

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
              {[
                { label: 'Telefone', value: lead.telefone },
                { label: 'Empresa', value: lead.empresa },
                { label: 'Origem', value: lead.anuncio ?? lead.origem },
              ].filter(f => f.value).map(f => (
                <div key={f.label}>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-0.5">{f.label}</p>
                  <p className="text-xs text-gray-300">{f.value}</p>
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

            {/* Reunião Realizada (rm_marcada only) */}
            {lead.etapa === 'rm_marcada' && !atividades.some(a => a.tipo === 'reuniao' && a.status_reuniao === 'Compareceu') && (
              <div className="border-t border-white/5 pt-3 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={reuniaoRealizada} onChange={e => setReuniaoRealizada(e.target.checked)} className="w-4 h-4 accent-brand-primary" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-brand-primary">Registrar Reunião Realizada</span>
                </label>

                {reuniaoRealizada && (
                  <div className="space-y-3 bg-white/3 rounded-xl p-3 border border-white/5">
                    {/* Print obrigatório */}
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Print da reunião *</label>
                      <input type="file" accept="image/*" onChange={handleRrImageChange}
                        className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-white/10 file:text-gray-300 hover:file:bg-white/20 file:cursor-pointer file:transition-colors"
                      />
                      {rrImagePreview && (
                        <div className="mt-2 relative">
                          <img src={rrImagePreview} alt="Preview" className="w-full max-h-32 object-contain rounded-lg border border-white/10" />
                          <button onClick={() => { setRrImageFile(null); setRrImagePreview(null); }}
                            className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-gray-300 hover:text-white transition-colors"
                          ><X size={12} /></button>
                        </div>
                      )}
                      {rrImageError && <p className="text-[10px] text-red-400 mt-1">Print obrigatório</p>}
                    </div>

                    {/* Status */}
                    <div className="flex gap-2">
                      {(['Compareceu', 'Não compareceu'] as const).map(s => (
                        <button key={s} onClick={() => setRrStatusReuniao(s)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${rrStatusReuniao === s ? (s === 'Compareceu' ? 'bg-brand-primary/20 border-brand-primary text-brand-primary' : 'bg-red-900/30 border-red-500 text-red-400') : 'bg-white/5 border-white/10 text-gray-500'}`}
                        >{s}</button>
                      ))}
                    </div>

                    {/* Programa Apresentado */}
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Programa Apresentado</label>
                      <select value={programaApresentado} onChange={e => setProgramaApresentado(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
                      >
                        <option value="" className="bg-bg-main">Selecionar...</option>
                        <option value="Basic" className="bg-bg-main">Basic</option>
                        <option value="Lite" className="bg-bg-main">Lite</option>
                        <option value="Pro" className="bg-bg-main">Pro</option>
                      </select>
                    </div>

                    {/* Resultado */}
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Resultado</label>
                      <select value={rrResultado} onChange={e => setRrResultado(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
                      >
                        <option value="" className="bg-bg-main">Selecionar...</option>
                        {['Venda', 'Marcou R2+', 'Reagendou', 'Perdido'].map(r => <option key={r} value={r} className="bg-bg-main">{r}</option>)}
                      </select>
                    </div>

                    {/* Financeiros */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Contrato (R$)</label>
                        <input type="number" value={rrValorContrato} onChange={e => setRrValorContrato(e.target.value)}
                          disabled={rrStatusReuniao !== 'Compareceu'}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary disabled:opacity-40" placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Cash Collect (R$)</label>
                        <input type="number" value={rrValorCc} onChange={e => setRrValorCc(e.target.value)}
                          disabled={rrStatusReuniao !== 'Compareceu'}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary disabled:opacity-40" placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Prazo (meses)</label>
                        <input type="number" value={rrPrazoMeses} onChange={e => setRrPrazoMeses(e.target.value)}
                          disabled={rrStatusReuniao !== 'Compareceu'}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary disabled:opacity-40" placeholder="0"
                        />
                      </div>
                    </div>
                    {rrMrr != null && !isNaN(rrMrr) && (
                      <div className="text-[10px] text-gray-400">MRR calculado: <span className="text-brand-primary font-bold">R$ {rrMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                    )}

                    {/* Venda — dados do cliente */}
                    {rrResultado === 'Venda' && (
                      <div className="border-t border-white/5 pt-3 space-y-3">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-brand-primary">Dados do Cliente</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Razão Social</label>
                            <input value={rrRazaoSocial} onChange={e => setRrRazaoSocial(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Tipo de Pessoa</label>
                            <select value={rrTipoPessoa} onChange={e => setRrTipoPessoa(e.target.value as 'PF' | 'PJ')}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
                            >
                              <option value="PJ" className="bg-bg-main">Pessoa Jurídica (CNPJ)</option>
                              <option value="PF" className="bg-bg-main">Pessoa Física (CPF)</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">CPF / CNPJ</label>
                          <input value={rrCpfCnpj} onChange={e => setRrCpfCnpj(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                            placeholder={rrTipoPessoa === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Endereço Completo</label>
                          <input value={rrEndereco} onChange={e => setRrEndereco(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Email de Contato</label>
                            <input type="email" value={rrEmailContato} onChange={e => setRrEmailContato(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Telefone</label>
                            <input value={rrTelefoneContato} onChange={e => setRrTelefoneContato(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Nome do Responsável</label>
                          <input value={rrNomeResponsavel} onChange={e => setRrNomeResponsavel(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Forma de Pagamento</label>
                            <select value={rrFormaPagamento} onChange={e => setRrFormaPagamento(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
                            >
                              <option value="" className="bg-bg-main">Selecionar...</option>
                              {['À vista', '2x', '3x', '6x', '12x', 'Boleto mensal', 'Cartão recorrente'].map(f => <option key={f} value={f} className="bg-bg-main">{f}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Data do 1º Vencimento</label>
                            <input type="date" value={rrDataPrimeiroVencimento} onChange={e => setRrDataPrimeiroVencimento(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-brand-primary"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Perdido */}
                    {rrResultado === 'Perdido' && (
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Motivo de perda <span className="text-red-400">*</span></label>
                        <textarea value={rrMotivoPerda} onChange={e => { setRrMotivoPerda(e.target.value); setRrErroMotivo(false); }} rows={2}
                          className={`w-full bg-white/5 border rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-primary resize-none ${rrErroMotivo ? 'border-red-500' : 'border-white/10'}`}
                        />
                        {rrErroMotivo && <p className="text-[10px] text-red-400 mt-1">Motivo de perda obrigatório</p>}
                      </div>
                    )}

                    {/* R2+ / Reagendou */}
                    {(rrResultado === 'Marcou R2+' || rrResultado === 'Reagendou') && (
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Próxima reunião</label>
                        <input type="datetime-local" value={rrProximaReuniao} onChange={e => setRrProximaReuniao(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-brand-primary"
                        />
                      </div>
                    )}

                    {/* Resumo */}
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Resumo da reunião</label>
                      <textarea value={rrResumo} onChange={e => setRrResumo(e.target.value)} rows={2}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-brand-primary resize-none"
                        placeholder="O que foi discutido..."
                      />
                    </div>

                    <button onClick={handleSaveReuniao} disabled={rrSaving}
                      className="w-full py-2 rounded-xl bg-brand-primary text-black text-xs font-bold hover:bg-brand-primary/80 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                    >
                      {rrSaving && <Loader2 size={12} className="animate-spin" />}
                      Salvar Reunião
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Nova Atividade + Agendar Tarefa inline */}
            <div className="border-t border-white/5 pt-3">
              {showAtivForm ? (
                <NovaAtividadeForm lead={lead} leadId={lead.id} leadName={lead.nome} userSession={userSession} onSaved={handleAtivSaved} onCancel={() => setShowAtivForm(false)} onLeadUpdated={handleLeadUpdated} onClientCreated={onClientCreated} onTarefaCreated={onTarefaCreated} />
              ) : showAgendarTarefa ? (
                <div className="space-y-3 bg-white/[0.02] border border-white/10 rounded-xl p-4">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-brand-primary">Agendar Tarefa</p>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Título da tarefa <span className="text-red-400">*</span></label>
                    <input value={agTitulo} onChange={e => setAgTitulo(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-primary"
                      placeholder="Ex: Reunião de follow-up"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Data e hora <span className="text-red-400">*</span></label>
                    <input type="datetime-local" value={agData} onChange={e => setAgData(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Responsável</label>
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
                    <button onClick={() => setShowAgendarTarefa(false)}
                      className="flex-1 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white transition-colors"
                    >Cancelar</button>
                    <button onClick={handleAgendarTarefa} disabled={agSaving || !agTitulo.trim() || !agData}
                      className="flex-1 py-1.5 rounded-xl bg-brand-primary text-black text-xs font-bold hover:bg-brand-primary/80 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                    >
                      {agSaving && <Loader2 size={12} className="animate-spin" />}
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <button onClick={() => { setShowAtivForm(true); setTab('timeline'); }}
                      className="w-full py-2 rounded-xl border border-dashed border-white/15 text-xs text-gray-500 hover:text-brand-primary hover:border-brand-primary/40 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={13} /> Registrar atividade
                    </button>
                    <p className="text-[9px] text-gray-700 text-center mt-1">Para atividades já realizadas</p>
                  </div>
                  <div className="flex-1">
                    <button onClick={() => setShowAgendarTarefa(true)}
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
              <button onClick={() => setShowAtivForm(!showAtivForm)}
                className="w-full py-2 rounded-xl bg-brand-primary/10 border border-brand-primary/30 text-xs text-brand-primary hover:bg-brand-primary/20 transition-all flex items-center justify-center gap-2"
              >
                <Plus size={13} /> Registrar atividade
              </button>
              {showAtivForm && <NovaAtividadeForm lead={lead} leadId={lead.id} leadName={lead.nome} userSession={userSession} onSaved={handleAtivSaved} onCancel={() => setShowAtivForm(false)} onLeadUpdated={handleLeadUpdated} onClientCreated={onClientCreated} onTarefaCreated={onTarefaCreated} />}
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
                          {a.tipo === 'ligacao' ? 'Ligação' : a.tipo === 'reuniao' ? 'Reunião' : a.tipo}
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
              {tarefas.length === 0 && <div className="py-12 text-center text-xs text-gray-600">Nenhuma tarefa agendada.</div>}
              {tarefas.map(t => (
                <div key={t.id} onClick={() => toggleTarefa(t)}
                  className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${t.concluida ? 'bg-white/3 opacity-50' : 'bg-white/5 hover:bg-white/8'}`}
                >
                  <CheckCircle2 size={16} className={t.concluida ? 'text-brand-primary mt-0.5' : 'text-gray-600 mt-0.5'} />
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${t.concluida ? 'line-through text-gray-600' : 'text-white'}`}>{t.titulo}</p>
                    {t.data_agendada && <p className="text-[10px] text-gray-500 mt-0.5">{new Date(t.data_agendada).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}</p>}
                    {t.responsavel && <p className="text-[9px] text-gray-700">{t.responsavel}</p>}
                  </div>
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
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    await onSave({ ...form, etapa: 'base', status: 'ativo', origem: 'manual' });
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
            <button onClick={handleSave} disabled={saving || !form.nome.trim()}
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
function TaskAlarmPopup({ tarefa, lead, onDismiss, onOpenLead, onComplete }: {
  tarefa: CRMTarefa; lead?: CRMLead; onDismiss: () => void; onOpenLead?: () => void; onComplete: () => void;
}) {
  const fmtDate = (d: string) => { try { return format(new Date(d), 'dd/MM/yyyy HH:mm'); } catch { return d; } };

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
                  <span className="text-gray-400">{lead.telefone}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          {onOpenLead && lead && (
            <button onClick={() => { onOpenLead(); onDismiss(); }}
              className="flex-1 py-2.5 rounded-xl bg-brand-primary/10 border border-brand-primary/30 text-xs font-bold text-brand-primary hover:bg-brand-primary/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ChevronRight size={14} /> Abrir Lead
            </button>
          )}
          <button onClick={onComplete}
            className="flex-1 py-2.5 rounded-xl bg-green-500/10 border border-green-500/30 text-xs font-bold text-green-400 hover:text-white hover:bg-green-500/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 size={14} /> Concluir
          </button>
          <button onClick={onDismiss}
            className="py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            Depois
          </button>
        </div>
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
        const agendada = new Date(t.data_agendada);
        if (agendada > now) return false;
        // Show for task responsible or lead responsible
        const lead = leads.find(l => l.id === t.lead_id);
        const isTaskResponsavel = (t.responsavel ?? '').toLowerCase() === userName.toLowerCase();
        const isLeadResponsavel = (lead?.responsavel ?? '').toLowerCase() === userName.toLowerCase();
        return isAdmin || isTaskResponsavel || isLeadResponsavel;
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

  const completeAlarm = async (tarefaId: string) => {
    await supabase.from('crm_tarefas').update({ concluida: true }).eq('id', tarefaId);
    setTarefas(prev => prev.map(t => t.id === tarefaId ? { ...t, concluida: true } : t));
    setAlarmTarefas(prev => prev.filter(t => t.id !== tarefaId));
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
    setLeads(unique);

    // Load all tasks (only for active leads) + cleanup orphaned tasks
    const { data: t } = await supabase.from('crm_tarefas').select('*');
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
    const { data, error } = await supabase.from('crm_leads').insert({ ...lead, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select().single();
    if (error) { console.error(error); return; }
    if (data) setLeads(prev => [data, ...prev]);
  };

  const proximaTarefaByLead = Object.fromEntries(
    tarefas.map(t => [t.lead_id, t]).filter(([, t]) => !(t as CRMTarefa).concluida)
  );

  const responsaveis = [...new Set(leads.map(l => l.responsavel).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const filteredLeads = leads
    .filter(l => {
      if (filtroResponsavel && l.responsavel !== filtroResponsavel) return false;
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
      if (order === 'newest')    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (order === 'oldest')    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (order === 'more_time') return new Date(a.etapa_desde ?? a.updated_at).getTime() - new Date(b.etapa_desde ?? b.updated_at).getTime();
      if (order === 'less_time') return new Date(b.etapa_desde ?? b.updated_at).getTime() - new Date(a.etapa_desde ?? a.updated_at).getTime();
      return 0;
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
        <div className="flex gap-3 min-w-max">
          {ETAPAS.map(etapa => {
            const etapaLeads = leadsByEtapa[etapa.id] ?? [];
            return (
              <div key={etapa.id} className="w-56 flex-shrink-0">
                <div className={`flex items-center justify-between mb-2 px-3 py-2 rounded-xl bg-white/3 border-l-2 ${etapa.color}`}>
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
                  <AnimatePresence>
                    {etapaLeads.map(lead => (
                      <LeadCard key={lead.id} lead={lead}
                        proximaTarefa={proximaTarefaByLead[lead.id] as CRMTarefa | undefined}
                        onClick={() => setSelectedLead(lead)}
                      />
                    ))}
                  </AnimatePresence>
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
                onComplete={() => completeAlarm(tarefa.id)}
              />
            </div>
          );
        })}
      </AnimatePresence>
      </div>
    </div>
  );
}
