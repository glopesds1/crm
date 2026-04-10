import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, X, Loader2 } from 'lucide-react';
import { supabase } from '../../shared/lib/supabase';
import { localDatetimeToISO } from '../../shared/lib/dateHelpers';
import { syncPostgres, WEBHOOK_BASE } from '../../shared/lib/webhooks';
import { calcLeadScore } from '../../shared/lib/leadScore';
import type { CRMLead, CRMTarefa, CRMAtividade, TeamMember } from '../../shared/types';
import { CRM_TAGS_CONFIG, CRM_ALL_TAGS, ETAPAS } from '../../shared/constants';
import { SlotPicker } from './SlotPicker';

const SP_TZ = 'America/Sao_Paulo';

// ── Nova Atividade Form ────────────────────────────────────────
export function NovaAtividadeForm({ lead: leadObj, leadId, leadName, userSession, onSaved, onCancel, onLeadUpdated, onClientCreated, onTarefaCreated, teamMembers = [], initialTipo }: {
  lead?: CRMLead; leadId: string; leadName: string; userSession: any; onSaved: (a: CRMAtividade) => void; onCancel: () => void; onLeadUpdated?: (upd: Partial<CRMLead>) => void; onClientCreated?: () => void;
  onTarefaCreated?: (tarefa: CRMTarefa) => void; teamMembers?: TeamMember[]; initialTipo?: 'ligacao' | 'reuniao';
}) {
  const [responsavelAtividade, setResponsavelAtividade] = useState(
    (['base', 'triagem'].includes(leadObj?.etapa ?? '') ? leadObj?.sdr_responsavel : leadObj?.closer_responsavel) ?? userSession?.name ?? ''
  );
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

    if (tipo === 'ligacao') {
      if (!statusChamada) { setValidationMsg('Selecione se atendeu ou não'); return; }
      if (!touchpoint) { setValidationMsg('Preencha o touchpoint'); return; }
      if (statusChamada === 'Atendeu') {
        if (agendou) {
          if (!bantDataHora) { setValidationMsg('Preencha a data/hora da reunião'); return; }
          if (!bantCloser) { setValidationMsg('Selecione o closer responsável'); return; }
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
              sdr: userSession?.name || '',
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
            sdr: userSession?.name || '',
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
        // Move lead to rm_marcada + update closer_responsavel (and keep sdr_responsavel)
        try {
          const leadUpd: any = {
            etapa: 'rm_marcada',
            etapa_desde: now,
            proxima_reuniao: localDatetimeToISO(bantDataHora),
            faturamento: bantFaturamento || undefined,
            closer_responsavel: bantCloser,
            sdr_responsavel: leadObj?.sdr_responsavel || responsavelAtividade || userSession?.name || '',
            tp_atual: 'R1',
            updated_at: now,
          };
          await supabase.from('crm_leads').update(leadUpd).eq('id', leadId);
          onLeadUpdated?.(leadUpd);
          // Track responsavel change in timeline
          if (bantCloser && bantCloser !== (leadObj?.closer_responsavel ?? '')) {
            await supabase.from('crm_atividades').insert({
              lead_id: leadId,
              tipo: 'alteracao',
              data_atividade: now,
              realizado_por: responsavelAtividade || userSession?.name || '',
              descricao: JSON.stringify({
                campo: 'closer_responsavel',
                de: leadObj?.closer_responsavel || '(sem responsável)',
                para: bantCloser,
                obs: 'Alteração via registro de ligação',
              }),
              created_at: now,
            });
          }
        } catch (err) {
          console.error('Failed to update lead to rm_marcada:', err);
        }
      }

      // Bloco 1: Criar t
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
            etapa: 'fup_ativa', status: 'venda_pendente',
            programa_apresentado: vendaPrograma,
            valor_contrato: vendaContrato,
            valor_cc: vendaCc,
            valor_mrr: vendaMrr,
            updated_at: now, etapa_desde: now,
          }).eq('id', leadId);
          onLeadUpdated?.({ etapa: 'fup_ativa', status: 'venda_pendente', programa_apresentado: vendaPrograma ?? undefined, valor_contrato: vendaContrato ?? undefined, valor_cc: vendaCc ?? undefined, valor_mrr: vendaMrr ?? undefined } as Partial<CRMLead>);

          // Criar registro de demandas da venda
          await supabase.from('crm_demandas_venda').upsert({
            lead_id: leadId,
            contrato_feito: false, contrato_assinado: false,
            sinal_pago: false, entrada_paga: false,
            onboarding_agendado: false, grupo_criado: false,
            membros_adicionados: false, mensagem_saudacao: false,
          }, { onConflict: 'lead_id' });


        } else if (resultado === 'Perdido') {
          await supabase.from('crm_leads').update({
            etapa: 'perdido', status: 'perdido',
            motivo_perda: motivoPerda || null,
            updated_at: now, etapa_desde: now,
          }).eq('id', leadId);
          onLeadUpdated?.({ etapa: 'perdido', status: 'perdido' });
        } else if (resultado === 'Marcou R2+' || resultado === 'Reagendou') {
          // Bloco 3: Atualizar lead para rm_realizada com tp_atual
          const tpMap_upd: Record<string, string> = {'': 'R1', 'R1': 'R2', 'R2': 'R3', 'R3': 'R4+'};
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
              closer: responsavelAtividade || leadObj?.closer_responsavel || '',
              data_hora: new Date(proximaReuniao).toISOString(),
              tipo_reuniao: webhookTipoReuniao_naf,
              duracao_min: 60,
              bant: { sdr: userSession?.name || '' },
              reagendamento: resultado === 'Reagendou',
            }),
          }).catch(e => { console.warn('[agendar-reuniao R2+ NAF]', e.message); return null; });
        } catch (err) { console.error('Failed to send agendar-reuniao webhook (NAF):', err); }
      }

      // Sync Postgres → Railway via n8n (fire-and-forget)
      {
        const hoje = new Date().toISOString().split('T')[0];
        const closer = responsavelAtividade || leadObj?.closer_responsavel || null;
        const currentTP = resolvedTP;

        if (statusReuniao === 'Não compareceu') {
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
              sdr: userSession?.name || '',
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
                closer: responsavelAtividade || leadObj?.closer_responsavel || '',
                data_hora: new Date(dataReagendamento).toISOString(),
                tipo_reuniao: currentTP,
                duracao_min: 60,
                bant: { sdr: userSession?.name || '' },
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
            // Atualizar crm_leads — reagendou: rm_marcada + tag No-show
            const tagsReag = [...(leadObj?.tags ?? [])];
            if (!tagsReag.includes('No-show')) tagsReag.push('No-show');
            try {
              await supabase.from('crm_leads').update({
                etapa: 'rm_marcada', proxima_reuniao: localDatetimeToISO(dataReagendamento), tags: tagsReag, updated_at: now,
              }).eq('id', leadId);
              onLeadUpdated?.({ etapa: 'rm_marcada', tags: tagsReag });
            } catch { /* silent */ }
          } else {
            // Sem reagendamento: apenas No-show → permanece rm_marcada + tag No-show
            syncPostgres(leadObj?.lead_externo_id, {
              reuniao_action: 'resultado',
              crm_lead_id: leadId,
              reuniao_tp: currentTP,
              reuniao_status: 'No-show',
              reuniao_resultado: 'No-show',
              closer,
            });
            const tagsNoShow = [...(leadObj?.tags ?? [])];
            if (!tagsNoShow.includes('No-show')) tagsNoShow.push('No-show');
            try {
              await supabase.from('crm_leads').update({ tags: tagsNoShow, updated_at: now }).eq('id', leadId);
              onLeadUpdated?.({ tags: tagsNoShow });
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
                sdr: userSession?.name || '',
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
                sdr: userSession?.name || '',
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
        collaborator: responsavelAtividade || leadObj?.closer_responsavel || userSession?.name || '',
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
            const tpMap: Record<string, string> = {'': 'R1', 'R1': 'R2', 'R2': 'R3', 'R3': 'R4+'};
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

      {/* Upload de print (opcional) */}
      <div>
        <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">
          Print da tela (opcional)
        </label>
        <input type="file" accept="image/*" onChange={e => { handleImageChange(e); setImageError(false); }}
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
