import type { CRMLead } from '../types';

export function calcLeadScore(lead: Partial<CRMLead>): {
  score: number;
  grade: string;
  breakdown: { faturamento: number; investimento: number; funcionarios: number; area: number };
} {
  let score = 0;
  let bFat = 0, bInv = 0, bFunc = 0, bArea = 0;
  const fat = (lead.faturamento || '').toLowerCase().replace(/[\s.]/g, '');
  const inv = (lead.investimento || '').toLowerCase();
  const func = (lead.funcionarios || '').toLowerCase();
  const area = (lead.area || '').toLowerCase();

  // FATURAMENTO (0-40)
  if (fat.includes('300') || fat.includes('151')) bFat = 40;
  else if (fat.includes('70') || fat.includes('r$70')) bFat = 35;
  else if (fat.includes('80000') || fat.includes('acima')) bFat = 30;
  else if (fat.includes('40') || fat.includes('r$40')) bFat = 25;
  else if (fat.includes('20') || fat.includes('r$20') || fat.includes('11') || fat.includes('r$11') || fat.includes('30')) bFat = 15;
  else if (fat.includes('10') && !fat.includes('100')) bFat = 8;
  else if (fat.includes('menos') || fat.includes('5000')) bFat = 3;
  else {
    const num = parseFloat(fat.replace(/[^0-9,.-]/g, '').replace(',', '.'));
    if (!isNaN(num)) {
      if (num >= 150000) bFat = 40;
      else if (num >= 70000) bFat = 35;
      else if (num >= 40000) bFat = 25;
      else if (num >= 20000) bFat = 15;
      else if (num >= 10000) bFat = 8;
      else bFat = 3;
    }
  }

  // INVESTIMENTO (0-30)
  if (inv.includes('todos')) bInv = 30;
  else if (inv.includes('agência') || inv.includes('agencia')) bInv = 25;
  else if (inv.includes('mentoria')) bInv = 20;
  else if (inv.includes('curso')) bInv = 15;
  else if (inv.includes('nenhum')) bInv = 5;

  // FUNCIONARIOS (0-20)
  if (func.includes('acima_de_10') || func.includes('acima de 10')) bFunc = 20;
  else if (func.includes('6_a_10') || func.includes('6 a 10')) bFunc = 18;
  else if (func.includes('4_a_6') || func.includes('4 a 6')) bFunc = 14;
  else if (func.includes('1_a_3') || func.includes('1 a 3')) bFunc = 8;
  else if (func.includes('somente_eu') || func.includes('somente eu')) bFunc = 4;

  // AREA BONUS (0-10)
  if (area.includes('engenheiro') && area.includes('construtora')) bArea = 10;
  else if (area.includes('engenheiro')) bArea = 6;
  else if (area.includes('construtor')) bArea = 6;
  else if (area.includes('arquiteto')) bArea = 4;

  score = bFat + bInv + bFunc + bArea;
  const grade = score >= 70 ? 'A' : score >= 45 ? 'B' : score >= 20 ? 'C' : 'D';
  return { score, grade, breakdown: { faturamento: bFat, investimento: bInv, funcionarios: bFunc, area: bArea } };
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
