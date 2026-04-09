import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function extractField(userData: Record<string, string>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const val = userData[k] || userData[k.toLowerCase()] || userData[k.toUpperCase()];
    if (val) return String(val).trim();
  }
  return undefined;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { pixelId, eventName = 'Lead', userData = {}, eventSourceUrl, offerId } = body;

    if (!pixelId) {
      return Response.json({ ok: false, error: 'pixelId é obrigatório' }, { headers: corsHeaders });
    }

    // Buscar access token do Supabase (por offerId ou direto no body)
    let accessToken = body.accessToken;

    if (!accessToken && offerId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      const { data } = await supabase
        .from('lp_offers')
        .select('meta_access_token')
        .eq('id', offerId)
        .single();
      accessToken = data?.meta_access_token;
    }

    if (!accessToken) {
      return Response.json({ ok: false, error: 'meta_access_token não configurado na oferta' }, { headers: corsHeaders });
    }

    // Hashear dados do usuário (LGPD/GDPR compliance)
    const email = extractField(userData, 'email');
    const phone = extractField(userData, 'phone', 'telefone', 'tel', 'celular', 'whatsapp');
    const firstName = extractField(userData, 'firstName', 'nome', 'name', 'first_name');
    const lastName = extractField(userData, 'lastName', 'sobrenome', 'last_name');

    const userDataHashed: Record<string, string> = {};
    if (email) userDataHashed.em = await sha256(email);
    if (phone) userDataHashed.ph = await sha256(phone.replace(/\D/g, ''));
    if (firstName) userDataHashed.fn = await sha256(firstName);
    if (lastName) userDataHashed.ln = await sha256(lastName);

    // Enviar para Meta Conversions API
    const payload = {
      data: [{
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: eventSourceUrl || '',
        action_source: 'website',
        user_data: {
          ...userDataHashed,
          client_ip_address: req.headers.get('x-forwarded-for') || '',
          client_user_agent: req.headers.get('user-agent') || '',
          fbp: extractField(userData, 'fbp', '_fbp'),
          fbc: extractField(userData, 'fbc', '_fbc'),
        },
      }],
    };

    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const metaData = await metaRes.json();
    console.log('[Meta CAPI] response:', JSON.stringify(metaData));

    if (!metaRes.ok) {
      return Response.json({ ok: false, error: metaData.error?.message || 'Erro Meta CAPI' }, { headers: corsHeaders });
    }

    // Salvar lead no Supabase (opcional)
    if (offerId && (email || phone)) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase.from('lp_leads').insert({
          offer_id: offerId,
          email: email || null,
          phone: phone || null,
          name: firstName ? `${firstName} ${lastName || ''}`.trim() : null,
          raw_data: userData,
          created_at: new Date().toISOString(),
        });
      } catch {
        // Tabela pode não existir ainda — não bloqueia o fluxo
      }
    }

    return Response.json({
      ok: true,
      eventsReceived: metaData.events_received,
      fbTraceId: metaData.fbtrace_id,
    }, { headers: corsHeaders });

  } catch (err) {
    console.error('[lp-meta-capi]', err);
    return Response.json({ ok: false, error: String(err) }, { headers: corsHeaders });
  }
});
