import { useState, useCallback, useRef, useEffect } from 'react';
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { supabase } from '../../shared/lib/supabase';
import type { DashboardPage, DateRange } from '../../shared/types';

export function useDashboardData(userSession: any) {
  const [page, setPage] = useState<DashboardPage>('overview');
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

  const fetchData = useCallback(async (p: DashboardPage, r: DateRange) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const di = r.inicio;
      const df = r.fim;
      const closerParam = ((userSession?.role ?? '').toLowerCase() === 'comercial' && userSession?.name) ? userSession.name : '';
      let result: any = {};

      if (p === 'overview') {
        const [kpis, vendas_mes, custos] = await Promise.all([
          supabase.rpc('dashboard_overview_kpis', { di, df }),
          supabase.rpc('dashboard_overview_vendas_mes', { di, df }),
          supabase.rpc('dashboard_overview_custos', { di, df }),
        ]);
        result = {
          kpis: kpis.data,
          vendas_mes: vendas_mes.data,
          custos: custos.data,
        };
      } else if (p === 'metas') {
        const [realizado, closers, sdrs, vendas_lista] = await Promise.all([
          supabase.rpc('dashboard_metas_realizado', { di, df }),
          supabase.rpc('dashboard_metas_closer', { di, df }),
          supabase.rpc('dashboard_metas_sdr', { di, df }),
          supabase.rpc('dashboard_metas_vendas_lista', { di, df }),
        ]);
        result = {
          realizado: realizado.data,
          closers: closers.data,
          sdrs: sdrs.data,
          vendas_lista: vendas_lista.data,
        };
      } else if (p === 'semanal') {
        const { data: semanal } = await supabase
          .from('view_producao_semanal_total')
          .select('*')
          .order('semana_inicio', { ascending: false })
          .limit(20);
        result = { semanal };
      } else if (p === 'reunioes') {
        console.log('[fetchData reunioes] di =', di, 'closer =', closerParam);
        const [dia, negociacao, disponibilidade] = await Promise.all([
          supabase.rpc('dashboard_reunioes_dia', { di, p_closer: closerParam }),
          supabase.rpc('dashboard_reunioes_negociacao', { di }),
          supabase.rpc('dashboard_disponibilidade', { di }),
        ]);
        result = {
          dia: dia.data,
          negociacao: negociacao.data,
          disponibilidade: disponibilidade.data,
        };
      } else if (p === 'analise') {
        const [etapa, programa, motivos, etapa_pizza, closers] = await Promise.all([
          supabase.rpc('dashboard_analise_etapa', { di, df }),
          supabase.rpc('dashboard_analise_programa', { di, df }),
          supabase.rpc('dashboard_analise_motivos', { di, df }),
          supabase.rpc('dashboard_analise_etapa', { di, df }),
          supabase.rpc('dashboard_kpi_closer', { di, df }),
        ]);
        result = {
          etapa: etapa.data,
          programa: programa.data,
          motivos: motivos.data,
          etapa_pizza: etapa_pizza.data,
          closers: closers.data,
        };
      } else if (p === 'anuncios') {
        const [funil, custos] = await Promise.all([
          supabase.rpc('dashboard_anuncios_funil', { di, df }),
          supabase.rpc('dashboard_overview_custos', { di, df }),
        ]);
        result = {
          funil: funil.data,
          custos: custos.data,
        };
      } else if (p === 'sdr') {
        const [producao, leads_semanal] = await Promise.all([
          supabase.rpc('dashboard_sdr_producao', { di, df }),
          supabase.rpc('dashboard_sdr_leads_semanal'),
        ]);
        result = {
          producao: producao.data,
          leads_semanal: leads_semanal.data,
        };
      }

      setData(result);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao buscar dados');
    } finally {
      setLoading(false);
    }
  }, [userSession]);

  // Período padrão por aba
  const periodoPadraoAba: Record<string, string> = {
    overview: 'ano', metas: 'mes', semanal: 'semanal', reunioes: 'hoje',
    anuncios: 'mes', analise: '90d', sdr: '90d',
  };
  const [periodo, setPeriodo] = useState(periodoPadraoAba[page] || 'mes');

  // Calcula range a partir de um período
  const calcRange = useCallback((p: string): DateRange => {
    const yearStart   = format(startOfYear(today),  'yyyy-MM-dd');
    const yearEnd     = format(endOfYear(today),    'yyyy-MM-dd');
    const monthStart  = format(startOfMonth(today), 'yyyy-MM-dd');
    const days90Start = format(subDays(today, 90),  'yyyy-MM-dd');
    if (p === 'ano')     return { inicio: yearStart,   fim: yearEnd };
    if (p === 'mes')     return { inicio: monthStart,  fim: fimMes };
    if (p === 'hoje')    return { inicio: todayStr,    fim: todayStr };
    if (p === '90d')     return { inicio: days90Start, fim: fimMes };
    if (p === 'semanal') return { inicio: monthStart,  fim: fimMes };
    return { inicio: monthStart, fim: fimMes };
  }, []); // eslint-disable-line

  // Ao trocar de aba: seta periodo padrão + range + fetch
  useEffect(() => {
    const p = periodoPadraoAba[page] || 'mes';
    setPeriodo(p);
    const r = calcRange(p);
    setRange(r);
    fetchData(page, r);
  }, [page]); // eslint-disable-line

  // Ao mudar range manualmente (date picker ou preset): fetch
  const prevRangeRef = useRef(range);
  useEffect(() => {
    if (prevRangeRef.current.inicio !== range.inicio || prevRangeRef.current.fim !== range.fim) {
      prevRangeRef.current = range;
      fetchData(page, range);
    }
  }, [range]); // eslint-disable-line

  return {
    page, setPage,
    loading, data, error,
    range, setRange,
    periodo, setPeriodo,
    calcRange, fetchData,
    periodoPadraoAba,
    fimMes,
  };
}
