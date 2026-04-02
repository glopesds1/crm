const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { url, metaPixelId, clarityId } = await req.json();

    if (!url) {
      return Response.json({ ok: false, error: 'url é obrigatória' }, { headers: corsHeaders });
    }

    // Buscar o HTML da página no ar
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; M2BlackBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return Response.json({
        ok: false,
        error: `Página retornou status ${res.status}. Verifique se o deploy está ativo.`,
      }, { headers: corsHeaders });
    }

    const html = await res.text();

    // Verificar Meta Pixel
    const metaResult = (() => {
      if (!metaPixelId) return { checked: false, found: false };
      const hasInit = html.includes(`fbq('init','${metaPixelId}')`) ||
                      html.includes(`fbq('init', '${metaPixelId}')`) ||
                      html.includes(`fbq("init","${metaPixelId}")`) ||
                      html.includes(`fbq("init", "${metaPixelId}")`);
      const hasScript = html.includes('connect.facebook.net') || html.includes('fbevents.js');
      return { checked: true, found: hasInit && hasScript, hasScript, hasInit };
    })();

    // Verificar Clarity
    const clarityResult = (() => {
      if (!clarityId) return { checked: false, found: false };
      const hasId = html.includes(`clarity.ms/tag/${clarityId}`) ||
                    html.includes(`"${clarityId}"`);
      const hasScript = html.includes('clarity.ms') || html.includes('"clarity"');
      return { checked: true, found: hasId && hasScript, hasScript, hasId };
    })();

    // Verificar CAPI
    const hasCapi = html.includes('lp-meta-capi');

    return Response.json({
      ok: true,
      url,
      meta: metaResult,
      clarity: clarityResult,
      capi: { found: hasCapi },
      htmlSize: html.length,
    }, { headers: corsHeaders });

  } catch (err) {
    console.error('[lp-check-pixel]', err);
    const msg = String(err);
    const isTimeout = msg.includes('timed out') || msg.includes('timeout');
    return Response.json({
      ok: false,
      error: isTimeout ? 'Página demorou para responder (timeout 10s)' : msg,
    }, { headers: corsHeaders });
  }
});
