import React from 'react';
import { fmtBRL } from '../../shared/lib/formatters';
import { Empty } from './ui/Empty';

interface AnunciosTabProps {
  data: any;
}

export function AnunciosTab({ data }: AnunciosTabProps) {
  const funil: any[] = Array.isArray(data?.funil) ? data.funil
    : data?.funil ? [data.funil] : [];
  const custos = data?.custos;

  // Color scale per column threshold
  const txColor = (pct: any, threshold: number) => {
    const v = parseFloat(pct ?? 0);
    if (v >= threshold)            return 'bg-green-700/60 text-green-200';
    if (v >= threshold * 0.75)     return 'bg-yellow-700/60 text-yellow-200';
    if (v >= threshold * 0.50)     return 'bg-orange-700/60 text-orange-200';
    return 'bg-red-800/60 text-red-300';
  };

  return (
    <div className="space-y-4">
      {/* KPIs de custo */}
      {custos && (
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Verba Mídia',    value: fmtBRL(custos.verba_midia) },
            { label: 'CPL',            value: fmtBRL(custos.cpl) },
            { label: 'Custo MQL',      value: fmtBRL(custos.custo_mql) },
            { label: 'Custo RM (CRM)', value: fmtBRL(custos.custo_rm) },
            { label: 'Custo RR (CRR)', value: fmtBRL(custos.custo_rr) },
            { label: 'CAC',            value: fmtBRL(custos.cac) },
          ].map(k => (
            <div key={k.label} className="glass-card p-4 text-center space-y-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-brand-primary">{k.label}</p>
              <p className="text-lg font-black text-white">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabela funil por anúncio */}
      <div className="glass-card p-6 overflow-x-auto">
        <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-4">Performance dos Anúncios</h3>
        {funil.length === 0 ? <Empty /> : (
          <table className="w-full text-xs min-w-[1100px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5 min-w-[140px]">Anúncio</th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">Leads</th>
                <th className="text-center py-2 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">Tx(%)</th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">MQL</th>
                <th className="text-center py-2 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">Tx(%)</th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">RM</th>
                <th className="text-center py-2 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">Tx(%)</th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">RR</th>
                <th className="text-center py-2 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">Tx(%)</th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">Vendas</th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">Contrato</th>
                <th className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/5">CC</th>
              </tr>
            </thead>
            <tbody>
              {funil.map((row: any, i: number) => (
                <React.Fragment key={i}>
                  {/* Linha 1: funil */}
                  <tr className="hover:bg-white/5 transition-colors">
                    <td rowSpan={2} className="py-2 px-3 font-medium text-gray-200 border-b border-white/10 align-middle max-w-[160px]">
                      <span className="block truncate">{row.anuncio}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center text-blue-300 font-bold">{row.leads ?? '—'}</td>
                    <td className="py-1.5 px-1 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${txColor(row.tx_mql, 30)}`}>{row.tx_mql ? `${parseFloat(row.tx_mql).toFixed(2)}%` : '—'}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center">{row.mqls ?? '—'}</td>
                    <td className="py-1.5 px-1 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${txColor(row.tx_rm, 40)}`}>{row.tx_rm ? `${parseFloat(row.tx_rm).toFixed(2)}%` : '—'}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center">{row.rm ?? '—'}</td>
                    <td className="py-1.5 px-1 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${txColor(row.tx_rr, 40)}`}>{row.tx_rr ? `${parseFloat(row.tx_rr).toFixed(2)}%` : '—'}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center">{row.rr ?? '—'}</td>
                    <td className="py-1.5 px-1 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${txColor(row.tx_venda, 20)}`}>{row.tx_venda ? `${parseFloat(row.tx_venda).toFixed(2)}%` : '—'}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center text-brand-primary font-bold">{row.vendas ?? '—'}</td>
                    <td className="py-1.5 px-2 text-center text-white">{row.total_contrato ? fmtBRL(row.total_contrato) : '—'}</td>
                    <td className="py-1.5 px-2 text-center text-white">{row.total_cc ? fmtBRL(row.total_cc) : '—'}</td>
                  </tr>
                  {/* Linha 2: custos */}
                  <tr className="border-b border-white/10">
                    <td className="py-1 px-2 text-center text-[10px] text-gray-500">
                      {row.custo_lead ? <span className="text-yellow-600">CPL: {fmtBRL(row.custo_lead)}</span> : <span className="text-gray-700">—</span>}
                    </td>
                    <td />
                    <td className="py-1 px-2 text-center text-[10px] text-gray-500">
                      {row.custo_mql ? <span className="text-yellow-600">C.MQL: {fmtBRL(row.custo_mql)}</span> : <span className="text-gray-700">—</span>}
                    </td>
                    <td />
                    <td className="py-1 px-2 text-center text-[10px] text-gray-500">
                      {row.custo_rm ? <span className="text-yellow-600">C.RM: {fmtBRL(row.custo_rm)}</span> : <span className="text-gray-700">—</span>}
                    </td>
                    <td />
                    <td className="py-1 px-2 text-center text-[10px] text-gray-500">
                      {row.custo_rr ? <span className="text-yellow-600">C.RR: {fmtBRL(row.custo_rr)}</span> : <span className="text-gray-700">—</span>}
                    </td>
                    <td />
                    <td className="py-1 px-2 text-center text-[10px] text-gray-500">
                      {row.cac ? <span className="text-yellow-400 font-bold">CAC: {fmtBRL(row.cac)}</span> : <span className="text-gray-700">—</span>}
                    </td>
                    <td />
                    <td />
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
