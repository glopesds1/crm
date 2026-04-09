export const SP_TZ = 'America/Sao_Paulo';

// datetime-local retorna "2026-03-24T18:00" sem timezone.
// Anexa explicitamente -03:00 para que o Supabase (timestamptz) interprete
// como horário de São Paulo, independente do fuso do navegador.
export function localDatetimeToISO(dt: string): string {
  if (!dt) return dt;
  // Se já tem offset, não duplicar
  if (/[+-]\d{2}:\d{2}$/.test(dt) || dt.endsWith('Z')) return dt;
  // datetime-local dá "YYYY-MM-DDTHH:mm", pode ou não ter segundos
  const needsSec = (dt.match(/:/g) || []).length < 2;
  return `${dt}${needsSec ? ':00' : ''}-03:00`;
}

// Parse uma data do Supabase garantindo interpretação correta do fuso.
// timestamptz vem com +00:00; timestamp vem sem offset (tratar como SP).
export function parseDateSP(iso: string): Date {
  if (!iso) return new Date(NaN);
  if (!iso.includes('+') && !iso.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(iso)) {
    return new Date(iso + '-03:00');
  }
  return new Date(iso);
}

// Formata uma data ISO na timezone de São Paulo.
export function fmtDateSP(iso: string, opts?: { year?: boolean }): string {
  if (!iso) return '—';
  try {
    const d = parseDateSP(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
      timeZone: SP_TZ,
      day: '2-digit', month: '2-digit',
      ...(opts?.year ? { year: '2-digit' } : {}),
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

/** Formata data/hora, mas omite hora se for exatamente 00:00 (DATE sem hora). */
export function fmtDateSmartSP(iso: string, opts?: { year?: boolean }): string {
  if (!iso) return '—';
  try {
    const d = parseDateSP(iso);
    if (isNaN(d.getTime())) return '—';
    const h = Number(d.toLocaleString('pt-BR', { timeZone: SP_TZ, hour: '2-digit', hour12: false }));
    const m = Number(d.toLocaleString('pt-BR', { timeZone: SP_TZ, minute: '2-digit' }));
    if (h === 0 && m === 0) {
      return d.toLocaleDateString('pt-BR', { timeZone: SP_TZ, day: '2-digit', month: '2-digit', ...(opts?.year ? { year: '2-digit' } : {}) });
    }
    return fmtDateSP(iso, opts);
  } catch { return '—'; }
}
