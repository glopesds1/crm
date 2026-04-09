import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, TrendingUp } from 'lucide-react';

export interface LeadScoreCriteria {
  faturamento?: number;     // 0-30 pontos
  urgencia?: number;         // 0-25 pontos
  autoridade?: number;       // 0-20 pontos
  necessidade?: number;      // 0-15 pontos
  timeline?: number;         // 0-10 pontos
}

export const calculateLeadScore = (criteria: LeadScoreCriteria): number => {
  const score = (criteria.faturamento || 0) +
                (criteria.urgencia || 0) +
                (criteria.autoridade || 0) +
                (criteria.necessidade || 0) +
                (criteria.timeline || 0);
  return Math.min(score, 100);
};

export const getScoreBadgeColor = (score: number): string => {
  if (score >= 80) return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (score >= 60) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  if (score >= 40) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
};

export const getScoreBadgeIcon = (score: number): string => {
  if (score >= 80) return '🔥';
  if (score >= 60) return '⚡';
  if (score >= 40) return '❄️';
  return '❌';
};

interface LeadScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadName: string;
  leadId?: string;
  currentCriteria?: LeadScoreCriteria;
  onSave: (criteria: LeadScoreCriteria) => void;
}

export const LeadScoreModal: React.FC<LeadScoreModalProps> = ({
  isOpen,
  onClose,
  leadName,
  currentCriteria,
  onSave,
}) => {
  const [criteria, setCriteria] = useState<LeadScoreCriteria>(currentCriteria || {});
  const score = calculateLeadScore(criteria);

  const handleSave = () => {
    onSave(criteria);
    onClose();
  };

  const criteriaConfig = [
    {
      key: 'faturamento' as const,
      label: '💰 Faturamento Anual',
      max: 30,
      description: 'Quanto maior o faturamento, maior o potencial',
      hints: ['< R$ 10k', 'R$ 10k-50k', 'R$ 50k-150k', '> R$ 150k'],
    },
    {
      key: 'urgencia' as const,
      label: '⏰ Urgência/Pressão',
      max: 25,
      description: 'Quanto maior a pressão para resolver, melhor',
      hints: ['Nenhuma', 'Baixa', 'Média', 'Alta', 'Crítica'],
    },
    {
      key: 'autoridade' as const,
      label: '👤 Autoridade de Decisão',
      max: 20,
      description: 'Está falando com quem toma decisão?',
      hints: ['Ninguém', 'Influencia', 'Decisor +1', 'Decisor único'],
    },
    {
      key: 'necessidade' as const,
      label: '🎯 Necessidade Real',
      max: 15,
      description: 'Há um problema identificado?',
      hints: ['Nenhuma', 'Baixa', 'Média', 'Alta'],
    },
    {
      key: 'timeline' as const,
      label: '📅 Timeline de Compra',
      max: 10,
      description: 'Quando pretendem começar?',
      hints: ['Indefinido', '6+ meses', '3-6 meses', '< 30 dias'],
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <TrendingUp size={24} className="text-brand-primary" />
                  Lead Score
                </h2>
                <p className="text-gray-400 text-sm mt-1">{leadName}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Score Display */}
            <div className={`mb-8 p-6 rounded-xl border transition-all ${getScoreBadgeColor(score)}`}>
              <p className="text-sm text-gray-300 mb-2">Score Final</p>
              <div className="flex items-center gap-4">
                <p className="text-5xl font-bold">
                  {getScoreBadgeIcon(score)}
                </p>
                <div>
                  <p className="text-4xl font-bold">{score}/100</p>
                  <p className="text-sm text-gray-300 mt-1">
                    {score >= 80 ? '🔥 Quente' : score >= 60 ? '⚡ Morno' : score >= 40 ? '❄️ Frio' : '❌ Muito frio'}
                  </p>
                </div>
              </div>
            </div>

            {/* Critérios */}
            <div className="space-y-6 mb-8">
              {criteriaConfig.map(({ key, label, max, description, hints }) => (
                <div key={key} className="bg-white/5 p-5 rounded-xl border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-white">{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-brand-primary">
                        {criteria[key] || 0}
                      </p>
                      <p className="text-xs text-gray-500">de {max}</p>
                    </div>
                  </div>

                  {/* Slider */}
                  <input
                    type="range"
                    min="0"
                    max={max}
                    value={criteria[key] || 0}
                    onChange={(e) =>
                      setCriteria({ ...criteria, [key]: parseInt(e.target.value) })
                    }
                    className="w-full accent-brand-primary cursor-pointer h-2 rounded-full appearance-none bg-white/10"
                  />

                  {/* Hints */}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {hints.map((hint, i) => {
                      const val = Math.round((i / (hints.length - 1)) * max);
                      const isActive = (criteria[key] || 0) >= val && (criteria[key] || 0) < val + Math.round(max / (hints.length - 1));
                      return (
                        <button
                          key={i}
                          onClick={() => setCriteria({ ...criteria, [key]: val })}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                            isActive
                              ? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-300'
                          }`}
                        >
                          {hint}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Breakdown */}
            <div className="bg-white/5 rounded-xl p-5 border border-white/10 mb-8">
              <p className="text-sm font-bold text-gray-300 mb-3">Distribuição</p>
              <div className="space-y-2">
                {criteriaConfig.map(({ key, label, max }) => {
                  const val = criteria[key] || 0;
                  const percent = (val / max) * 100;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-400">{label}</span>
                        <span className="text-brand-primary font-bold">{val}/{max}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-primary rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 rounded-lg hover:bg-white/10 transition-colors text-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 rounded-lg bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary border border-brand-primary/50 flex items-center gap-2 transition-all font-bold"
              >
                <Save size={18} />
                Salvar Score
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};