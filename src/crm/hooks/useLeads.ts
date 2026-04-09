import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../shared/lib/supabase';
import type { CRMLead, CRMTarefa } from '../../shared/types';

export function useLeads(
  userSession: any,
  setTarefas: React.Dispatch<React.SetStateAction<CRMTarefa[]>>,
) {
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [etapaSort, setEtapaSort] = useState<Record<string, 'newest' | 'oldest' | 'more_time' | 'less_time'>>({});
  const LEADS_PER_PAGE = 20;
  const [etapaVisible, setEtapaVisible] = useState<Record<string, number>>({});
  const [filtroResponsavel, setFiltroResponsavel] = useState(userSession?.name || 'Todos');
  const [filtroTag, setFiltroTag] = useState('');
  const [filtroScore, setFiltroScore] = useState('Todos');

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
        // Tenta buscar a mesma faixa em lotes menores para isolar o registro corrompido
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

    // Deduplica por id — merge-duplicates no Supabase pode gerar duplicatas
    const seen = new Set<string>();
    const unique = allLeads.filter(l => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });

    // Load all tasks (only for active leads) + cleanup orphaned tasks
    const { data: t } = await supabase.from('crm_tarefas').select('*');

    setLeads(unique);

    const activeLeadIds = new Set(unique.map(l => l.id));
    const orphanIds = (t ?? []).filter(task => !activeLeadIds.has(task.lead_id)).map(task => task.id);
    if (orphanIds.length > 0) {
      await supabase.from('crm_tarefas').delete().in('id', orphanIds);
    }
    setTarefas((t ?? []).filter(task => activeLeadIds.has(task.lead_id) && !task.concluida));
    setLoading(false);
  }, [setTarefas]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch(import.meta.env.VITE_SYNC_CRM_WEBHOOK ?? 'https://webhook.m2black.com/webhook/sync-crm-leads', { method: 'POST' });
      await new Promise(r => setTimeout(r, 3000));
      await loadLeads();
    } catch (e) { console.error(e); }
    setSyncing(false);
  };

  return {
    leads, setLeads,
    loading, syncing,
    search, setSearch,
    etapaSort, setEtapaSort,
    LEADS_PER_PAGE,
    etapaVisible, setEtapaVisible,
    filtroResponsavel, setFiltroResponsavel,
    filtroTag, setFiltroTag,
    filtroScore, setFiltroScore,
    loadLeads,
    handleSync,
  };
}
