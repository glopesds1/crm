const WEBHOOK_BASE = (import.meta.env.VITE_WEBHOOK_BASE ?? 'https://webhook.m2black.com/webhook/dashboard').replace('/webhook/dashboard', '');

export function syncPostgres(leadExternoId: string | undefined | null, fields: Record<string, unknown>) {
  // Railway eliminado — sync reverso desativado
  return;
}

export { WEBHOOK_BASE };
