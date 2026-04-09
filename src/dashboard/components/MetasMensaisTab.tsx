import React, { useState, useEffect } from 'react';
import { supabase } from '../../shared/lib/supabase';
import { fmt, fmtBRL, fmtPct } from '../../shared/lib/formatters';
import { Empty } from './ui/Empty';
import { DashTable } from './ui/DashTable';
import type { DateRange } from '../../shared/types';

interface MetasMensaisTabProps {
  data: any;
  userSession: any;
  range: DateRange;
}

export function MetasMensaisTab({ data, userSession, range }: MetasMensaisTabProps) {
  const m       = data?.realizado;
  const closers: any[] = Array.isArray(data?.closers) ? data.closers : data?.closers ? [data.closers] : [];
  const sdrs:    any[] = Array.isArray(data?.sdrs)    ? data.sdrs    : data?.sdrs    ? [data.sdrs]    : [];
  const vendasLista: any[] = Array.isArray(data?.vendas_lista) ? data.vendas_lista : data?.vendas_lista ? [data.vendas_lista] : [];
  console.log('[perf vendas]', closers);
  console.log('[perf prevendas]', sdrs);

  const [metasEdit, setMetasEdit] = useState({ meta_contrato: 0, meta_cc: 0, meta_rm: 0, meta_rr: 0, meta_vendas: 0 });
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const isAdmin = (userSession?.role ?? '').toLowerCase() === 'admin';

  // Negociando — leads em negociação no período selecionado (Supabase)
  const [negociando, setNegociando] = useState<{ contrato: number; cc: number; mrr: number }>({ contrato: 0, cc: 0, mrr: 0 });
  useEffect(() => {
    supabase.from('crm_leads')
      .select('valor_contrato,valor_cc,valor_mrr')
      .in('etapa', ['rm_realizada', 'fup_ativa'])
      .is('deletado_em', null)
      .gte('etapa_desde', range.inicio)
      .lte('etapa_desde', range.fim)
      .then(({ data: leads }) => {
        if (!leads) return;
        const contrato = leads.reduce((acc, l: any) => acc + (parseFloat(l.valor_contrato) || 0), 0);
        const cc = leads.reduce((acc, l: any) => acc + (parseFloat(l.valor_cc) || 0), 0);
        const mrr = leads.reduce((acc, l: any) => acc + (parseFloat(l.valor_mrr) || 0), 0);
        setNegociando({ contrato, cc, mrr });
      });
  }, [range.inicio, range.fim]);

  // Carrega metas do Supabase (fonte de verdade), não do webhook
  useEffect(() => {
    Promise.all([
      supabase.from('metas_mensais').select('*').eq('id', 1).single(),
      supabase.from('dashboard_metas').select('*').eq('id', 1).single(),
    ]).then(([fin, perf]) => {
      setMetasEdit(prev => ({
        ...prev,
        meta_contrato: fin.data?.meta_contrato ?? prev.meta_contrato,
        meta_cc:       fin.data?.meta_cc       ?? prev.meta_cc,
        meta_rm:       perf.data?.meta_rm      ?? prev.meta_rm,
        meta_rr:       perf.data?.meta_rr      ?? prev.meta_rr,
        meta_vendas:   perf.data?.meta_vendas  ?? prev.meta_vendas,
      }));
    }).catch(() => {});
  }, []);

  const saveMeta = async (key: string, val: string) => {
    const n = parseFloat(val) || 0;
    const updated = { ...metasEdit, [key]: n };
    setMetasEdit(updated);
    const table = ['meta_contrato', 'meta_cc'].includes(key) ? 'metas_mensais' : 'dashboard_metas';
    await supabase.from(table).upsert({ id: 1, [key]: n, updated_at: new Date().toISOString() });
    setEditKey(null);
  };

  if (!m) return <Empty />;

  const MetaProgressCard = ({ label, metaKey, realizado }: { label: string; metaKey: string; realizado: number }) => {
    const meta = (metasEdit as any)[metaKey] ?? 0;
    const pct = meta > 0 ? Math.min((realizado / meta) * 100, 100) : 0;
    return (
      <div className="glass-card p-6 space-y-3 text-center">
        <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary">{label}</h3>
        {editKey === metaKey ? (
          <div className="flex items-center justify-center gap-2">
            <input
              autoFocus
              type="number"
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onBlur={() => saveMeta(metaKey, editVal)}
              onKeyDown={e => e.key === 'Enter' && saveMeta(metaKey, editVal)}
              className="w-36 bg-white/10 border border-brand-primary rounded-2xl px-4 py-2 text-xl text-white text-center focus:outline-none font-black"
            />
          </div>
        ) : (
          <div
            onClick={() => isAdmin ? (setEditKey(metaKey), setEditVal(String(meta))) : null}
            className={`inline-block bg-white/10 border border-white/10 rounded-2xl px-6 py-2 ${isAdmin ? 'cursor-pointer hover:border-brand-primary/40 transition-colors' : ''}`}
            title={isAdmin ? 'Clique para editar' : ''}
          >
            <span className="text-2xl font-black text-white">{fmtBRL(meta)}</span>
          </div>
        )}
        <div className="space-y-1">
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-brand-primary transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-[9px]" style={{ color: '#aaa' }}>
            <span>0%</span>
            <span className="font-bold text-brand-primary">{pct.toFixed(1)}%</span>
            <span>100%</span>
          </div>
          <p className="text-[10px]" style={{ color: '#aaa' }}>{fmtBRL(realizado)} realizado</p>
        </div>
      </div>
    );
  };

  // Meta editável | Conv. Meta % | Conv. Realizado % | Realizado
  const PerfRow = ({ label, metaKey, metaVal, realizado, convMeta, convReal }: {
    label: string; metaKey: string; metaVal: any; realizado: any;
    convMeta?: string; convReal?: string;
  }) => (
    <div className="grid grid-cols-4 items-center py-3 border-b border-white/5 last:border-0 gap-2">
      <span className="text-xs font-bold" style={{ color: '#aaa' }}>{label}</span>
      {/* Meta editável */}
      <div className="text-center">
        {metaKey && editKey === metaKey ? (
          <input
            autoFocus
            type="number"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onBlur={() => saveMeta(metaKey, editVal)}
            onKeyDown={e => e.key === 'Enter' && saveMeta(metaKey, editVal)}
            className="w-16 bg-white/10 border border-brand-primary rounded-xl px-2 py-1 text-sm text-white text-center focus:outline-none font-black"
          />
        ) : (
          <div
            onClick={() => isAdmin && metaKey ? (setEditKey(metaKey), setEditVal(String(metaVal))) : null}
            className={`inline-block bg-white/10 rounded-xl px-3 py-1 ${isAdmin && metaKey ? 'cursor-pointer hover:border hover:border-brand-primary/40 transition-all' : ''}`}
            title={isAdmin && metaKey ? 'Clique para editar' : ''}
          >
            <span className="text-lg font-black text-white">{metaVal}</span>
          </div>
        )}
      </div>
      {/* Conversão Meta % | Conversão Realizado % */}
      <div className="text-center space-y-1">
        {convMeta && <div className="text-xs font-bold" style={{ color: '#aaa' }}>{convMeta}</div>}
        {convReal && <div className="text-sm font-bold text-brand-primary">{convReal}</div>}
      </div>
      {/* Realizado */}
      <div className="text-center">
        <div className="inline-block bg-white/10 rounded-xl px-3 py-1">
          <span className="text-lg font-black text-white">{realizado}</span>
        </div>
      </div>
    </div>
  );

  const rateColor = (v: any, ref: number) => {
    const n = parseFloat(v ?? 0);
    if (n >= ref) return '#22c55e';
    if (n >= ref * 0.6) return '#d4af37';
    return '#ef4444';
  };

  return (
    <div className="space-y-4">

      {/* Topo: Metas Contrato + Cash Collect editáveis */}
      <div className="grid grid-cols-2 gap-4">
        <MetaProgressCard label="Contrato"    metaKey="meta_contrato" realizado={parseFloat(m.contrato_realizado ?? 0)} />
        <MetaProgressCard label="Cash Collect" metaKey="meta_cc"      realizado={parseFloat(m.cc_realizado ?? 0)} />
      </div>

      {/* Meio: Performance | Vendido & Negociando */}
      <div className="grid grid-cols-2 gap-4">

        {/* Performance */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-2">Performance</h3>
          <div className="grid grid-cols-4 text-center mb-1">
            <span />
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#aaa' }}>Meta</span>
            <div className="text-center space-y-0.5">
              <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#aaa' }}>Conv. Meta</div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-brand-primary">Conv. Real</div>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#aaa' }}>Realizado</span>
          </div>
          {(() => {
            const rmRealizado = parseInt(m.rm_realizado) || 0;
            const rrRealizado = parseInt(m.rr_realizado) || 0;
            const vendasRealizado = parseInt(m.vendas_realizado) || 0;
            console.log('[metas] rm_realizado:', m.rm_realizado, 'rr_realizado:', m.rr_realizado);
            return (
              <>
                <PerfRow
                  label="Reuniões Marcadas"
                  metaKey="meta_rm"
                  metaVal={fmt(metasEdit.meta_rm || m.meta_rm)}
                  realizado={fmt(rmRealizado)}
                />
                <PerfRow
                  label="Reuniões Realizadas"
                  metaKey="meta_rr"
                  metaVal={fmt(metasEdit.meta_rr || m.meta_rr)}
                  realizado={fmt(rrRealizado)}
                  convMeta={metasEdit.meta_rr > 0 && metasEdit.meta_rm > 0 ? `${((metasEdit.meta_rr / metasEdit.meta_rm) * 100).toFixed(1)}%` : undefined}
                  convReal={rmRealizado > 0 ? `${((rrRealizado / rmRealizado) * 100).toFixed(1)}%` : undefined}
                />
                <PerfRow
                  label="Vendas"
                  metaKey="meta_vendas"
                  metaVal={fmt(metasEdit.meta_vendas || m.meta_vendas)}
                  realizado={fmt(vendasRealizado)}
                  convMeta={metasEdit.meta_vendas > 0 && metasEdit.meta_rr > 0 ? `${((metasEdit.meta_vendas / metasEdit.meta_rr) * 100).toFixed(1)}%` : undefined}
                  convReal={rrRealizado > 0 ? `${((vendasRealizado / rrRealizado) * 100).toFixed(1)}%` : undefined}
                />
              </>
            );
          })()}
        </div>

        {/* Vendido & Negociando */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-2">Vendido &amp; Negociando</h3>
          <div className="grid grid-cols-3 text-center mb-1">
            <span />
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#aaa' }}>Vendido</span>
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#aaa' }}>Negociando</span>
          </div>
          {[
            { label: 'Contrato',     v: m.contrato_realizado, n: negociando.contrato },
            { label: 'Cash Collect', v: m.cc_realizado,       n: negociando.cc },
            { label: 'MRR',          v: m.mrr_realizado,      n: negociando.mrr },
          ].map(row => (
            <div key={row.label} className="grid grid-cols-3 items-center py-2 border-b border-white/5 last:border-0">
              <span className="text-xs font-bold" style={{ color: '#aaa' }}>{row.label}</span>
              <span className="text-center text-sm font-bold text-white">{fmtBRL(row.v)}</span>
              <span className="text-right text-sm font-bold text-yellow-400">{fmtBRL(row.n)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Baixo: Closer + SDR */}
      <div className="grid grid-cols-2 gap-4">
        {closers.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-4">Performance de Vendas</h3>
            {(() => {
              return (
                <DashTable
                  cols={['Closer', 'RM', 'Tx Show', 'RR', 'Tx Conv', 'Vendas', 'Contrato', 'CC']}
                  rows={closers.map((c, i) => [
                    `${i + 1}. ${c.closer}`,
                    c.rm,
                    <span style={{ color: rateColor(c.tx_show, 50) }}>{fmtPct(c.tx_show)}</span>,
                    c.rr,
                    <span style={{ color: rateColor(c.tx_fechamento, 20) }}>{fmtPct(c.tx_fechamento)}</span>,
                    c.vendas,
                    fmtBRL(c.total_contrato),
                    fmtBRL(c.total_cc),
                  ] as any)}
                />
              );
            })()}
          </div>
        )}
        {(() => {
          if (sdrs.length === 0) return null;
          return (
            <div className="glass-card p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-4">Performance de Pré-Vendas</h3>
              <DashTable
                cols={['SDR', 'RM', 'RR', 'Vendas', 'Show-rate']}
                rows={sdrs.map((s, i) => [
                  `${i + 1}. ${s.sdr}`, s.rm, s.rr, s.vendas,
                  <span style={{ color: rateColor(s.tx_show, 50) }}>{fmtPct(s.tx_show)}</span>,
                ] as any)}
              />
            </div>
          );
        })()}
      </div>

      {/* Vendas do Mês */}
      {vendasLista.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-4">
            Vendas do Mês ({vendasLista.length})
          </h3>
          <DashTable
            cols={['Data', 'Lead', 'Closer', 'Programa', 'Contrato', 'CC', 'Etapa']}
            rows={vendasLista.map(v => {
              const d = v.data_venda ? new Date(v.data_venda).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—';
              return [
                d,
                v.nome ?? '—',
                v.closer ?? '—',
                v.programa ?? '—',
                v.rs_contrato ? fmtBRL(v.rs_contrato) : '—',
                v.rs_cc ? fmtBRL(v.rs_cc) : '—',
                v.etapa ? <span className="inline-block bg-brand-primary/20 text-brand-primary text-[10px] font-bold px-2 py-0.5 rounded-full">{v.etapa}</span> : '—',
              ] as any;
            })}
          />
          <div className="flex justify-end gap-6 mt-3 pt-3 border-t border-white/10">
            <span className="text-xs text-gray-400">Total: <span className="text-white font-bold">{fmtBRL(vendasLista.reduce((s, v) => s + (parseFloat(v.rs_contrato) || 0), 0))}</span> em contrato</span>
            <span className="text-xs text-gray-400"><span className="text-white font-bold">{fmtBRL(vendasLista.reduce((s, v) => s + (parseFloat(v.rs_cc) || 0), 0))}</span> em CC</span>
          </div>
        </div>
      )}
    </div>
  );
}
