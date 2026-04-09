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
  
  return Math.min(score, 100); // máximo 100 pontos
};

export const getScoreBadgeColor = (score: number): string => {
  if (score >= 80) return 'bg-green-500/20 text-green-400 border-green-500/30';     // 🟢 Quente
  if (score >= 60) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';  // 🟡 Morno
  if (score >= 40) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';  // 🟠 Frio
  return 'bg-red-500/20 text-red-400 border-red-500/30';                            // 🔴 Muito frio
};

export const getScoreBadgeIcon = (score: number): string => {
  if (score >= 80) return '🔥';
  if (score >= 60) return '⚡';
  if (score >= 40) return '❄️';
  return '❌';
};