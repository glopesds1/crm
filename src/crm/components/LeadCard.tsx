import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Phone, Calendar, MapPin, DollarSign } from 'lucide-react';
import type { CRMLead, CRMTarefa } from '../../shared/types';
import { ETAPA_MAP, CRM_TAGS_CONFIG, GRADE_STYLE } from '../../shared/constants';
import { getLeadScore } from '../../shared/lib/leadScore';
import { fmtDateSP, fmtDateSmartSP } from '../../shared/lib/dateHelpers';
import { LeadScoreModal, calculateLeadScore, getScoreBadgeIcon } from '../../components/LeadScoreModal';
import { CallActivityButton } from '../../components/CallActivityButton';
import { saveLeadScore, getLeadScore as getStoredLeadScore, saveCallLog } from '../../lib/mvpStorage';

interface LeadCardProps {
  lead: CRMLead;
  proximaTarefa?: CRMTarefa;
  onClick: () => void;
}

export function LeadCard({ lead, proximaTarefa, onClick }: LeadCardProps) {
  const etapa = ETAPA_MAP[lead.etapa];
  const fmtDate = (d: string) => fmtDateSP(d);

  // Próxima reunião analysis
  const proxReuniao = (lead as any).proxima_reuniao;
  const proxDate = proxReuniao ? new Date(proxReuniao) : null;
  const agora = new Date();
  const isHoje = proxDate ? (proxDate.toDateString() === agora.toDateString()) : false;
  const isAtrasada = proxDate ? (proxDate < agora && !isHoje) : false;
  const tpAtual = (lead as any).tp_atual || '';
  const tpColor = tpAtual === 'R1' ? 'bg-white/10 text-gray-400' : tpAtual === 'R2' ? 'bg-amber-900/30 text-amber-400' : tpAtual ? 'bg-red-900/30 text-red-400' : '';

  // WhatsApp URL
  const waUrl = lead.telefone ? `https://api.whatsapp.com/send?phone=${lead.telefone.replace(/\D/g, '').replace(/^0/, '').replace(/^(?!55)/, '55')}` : '';

  // Lead score modal state
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [selectedLeadForScore, setSelectedLeadForScore] = useState<CRMLead | null>(null);

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={`bg-[#161b26] border border-white/8 rounded-xl p-3.5 cursor-pointer hover:bg-[#1a2030] transition-all duration-200 space-y-2 shadow-md shadow-black/20`}
      style={isHoje ? { borderLeft: '3px solid #d97706' } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-xs font-bold text-white leading-tight line-clamp-1">{lead.nome}</p>
          {tpAtual && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${tpColor}`}>{tpAtual}</span>}
          {(() => {
            const { score, grade } = getLeadScore(lead);
            if (score === 0) return null;
            const gs = GRADE_STYLE[grade] || GRADE_STYLE.D;
            return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, border: `1px solid ${gs.border}`, background: gs.background, color: gs.color, display: 'inline-block', flexShrink: 0 }}>{score} {grade}</span>;
          })()}
        </div>
        <ChevronRight size={12} className="text-gray-600 flex-shrink-0 mt-0.5" />
      </div>
      {/* Próxima reunião */}
      {proxDate && (
        <div className={`flex items-center gap-1.5 text-[10px] ${isAtrasada ? 'text-red-400' : isHoje ? 'text-amber-400' : 'text-gray-500'}`}>
          <Calendar size={9} className="flex-shrink-0" />
          {isAtrasada ? <span className="font-bold">Atrasada</span> : (
            <span>{proxDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {proxDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}</span>
          )}
        </div>
      )}
      {lead.telefone && (
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <Phone size={9} className="text-gray-600" />
          <a href={waUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="hover:text-brand-primary transition-colors">{lead.telefone}</a>
        </div>
      )}
      {lead.area && <div className="flex items-center gap-1.5 text-[10px] text-gray-400"><MapPin size={9} className="text-gray-600" /><span className="truncate">{lead.area}</span></div>}
      {lead.faturamento && <div className="flex items-center gap-1.5 text-[10px] text-gray-500"><DollarSign size={9} className="text-gray-600" />{lead.faturamento}</div>}
      {((lead.valor_contrato != null && lead.valor_contrato > 0) || (lead.valor_cc != null && lead.valor_cc > 0)) && (
        <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
          {lead.valor_contrato != null && lead.valor_contrato > 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contrato</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#d4af37' }}>R$ {Number(lead.valor_contrato).toLocaleString('pt-BR', { minimumFractionDigits: lead.valor_contrato % 1 ? 2 : 0 })}</div>
            </div>
          )}
          {lead.valor_cc != null && lead.valor_cc > 0 && (
            <div>
              <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cash Collect</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#60a5fa' }}>R$ {Number(lead.valor_cc).toLocaleString('pt-BR', { minimumFractionDigits: lead.valor_cc % 1 ? 2 : 0 })}</div>
            </div>
          )}
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
          {lead.tags.map(tag => <span key={tag} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${CRM_TAGS_CONFIG[tag] ?? 'bg-white/5 text-gray-500 border-white/10'}`}>{tag}</span>)}
        </div>
      )}
      <div className="text-[9px] text-gray-600 pt-1.5 mt-1 border-t border-white/8">
        {lead.created_at ? fmtDateSmartSP(lead.created_at, { year: true }) : '—'}
      </div>
    </motion.div>
  );
}
