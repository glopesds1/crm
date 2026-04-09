const WEBHOOK_BASE = (import.meta.env.VITE_WEBHOOK_BASE ?? 'https://webhook.m2black.com/webhook/dashboard').replace('/webhook/dashboard', '');

export function syncPostgres(leadExternoId: string | undefined | null, fields: Record<string, unknown>) {
  if (!leadExternoId) return;
  const clean: Record<string, unknown> = { lead_externo_id: leadExternoId };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) clean[k] = v;
  }
  fetch(`${WEBHOOK_BASE}/webhook/crm-sync-etapa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clean),
  }).catch(e => console.warn('[syncPostgres]', e.message));
}

export { WEBHOOK_BASE };
