import { format } from 'date-fns';

export const fmt = (v: number | string | null | undefined, prefix = '') => {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return `${prefix}${n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const fmtBRL = (v: number | string | null | undefined) => {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  if (n == null || isNaN(n)) return '—';
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const fmtPct = (v: number | string | null | undefined) => {
  if (v == null) return '—';
  return `${parseFloat(v as string).toFixed(1)}%`;
};

export const fmtMes = (iso: string) => {
  const d = new Date(iso);
  return format(d, 'MMM/yy').replace('.', '');
};
