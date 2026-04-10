import type { CRMLead } from '../types';

export function calcLeadScore(lead: Partial<CRMLead>): {
  score: number;
  grade: string;
  breakdown: { renda: number; terreno: number; projeto: number; credito: number };
} {
  let score = 0;
  let bRenda = 0, bTerreno = 0, bProjeto = 0, bCredito = 0;

  try {
    const scoreData = JSON.parse(localStorage.getItem(`lead_score_data_${lead.id}`) || '{}');

    // RENDA (0-40 pontos)
    const renda = scoreData.renda ? parseFloat(scoreData.renda) : 0;
    if (renda > 20000) bRenda = 40;
    else if (renda > 10000) bRenda = 30;
    else if (renda > 5000) bRenda = 15;

    // TERRENO (0-20 pontos)
    bTerreno = scoreData.terreno ? 20 : 0;

    // PROJETO (0-20 pontos)
    bProjeto = scoreData.projeto ? 20 : 0;

    // CRÉDITO (0-20 pontos)
    if (scoreData.credito === 'Aprovado') bCredito = 20;
    else if (scoreData.credito === 'Em análise') bCredito = 10;
  } catch (e) {
    // Se houver erro ao parsear, retorna score zero
  }

  score = bRenda + bTerreno + bProjeto + bCredito;
  const grade = score === 0 ? 'D' : score >= 50 ? 'A' : score >= 30 ? 'B' : 'C';
  return { score, grade, breakdown: { renda: bRenda, terreno: bTerreno, projeto: bProjeto, credito: bCredito } };
}

export function getLeadScore(lead: CRMLead) {
  return (lead.lead_score && lead.lead_score > 0)
    ? { score: lead.lead_score, grade: lead.lead_grade || 'D', breakdown: null }
    : calcLeadScore(lead);
}

export function getProgramaStyle(programa: string) {
  const p = (programa || '').toLowerCase();
  if (p === 'pro')   return 'text-yellow-400 font-bold';
  if (p === 'lite')  return 'text-gray-300 font-bold';
  if (p === 'basic') return 'text-blue-400 font-bold';
  return 'text-white font-bold';
}
