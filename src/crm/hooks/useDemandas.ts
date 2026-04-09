import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../shared/lib/supabase';
import type { CRMLead, CRMDemandaVenda } from '../../shared/types';

type DemandaPendente = CRMDemandaVenda & { lead_nome: string; lead_id: string; closer: string };

export function useDemandas(leads: CRMLead[], userSession: any) {
  const [demandasPendentes, setDemandasPendentes] = useState<DemandaPendente[]>([]);

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

  return { demandasPendentes, setDemandasPendentes, refreshDemandas };
}
