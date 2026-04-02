const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CF_BASE = 'https://api.cloudflare.com/client/v4';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const projectName = url.searchParams.get('projectName');

    if (!projectName) {
      return Response.json({ error: 'projectName é obrigatório' }, { status: 400, headers: corsHeaders });
    }

    const cfToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    if (!cfToken || !accountId) {
      return Response.json({ error: 'Credenciais Cloudflare não configuradas' }, { status: 500, headers: corsHeaders });
    }

    const cfRes = await fetch(
      `${CF_BASE}/accounts/${accountId}/pages/projects/${projectName}`,
      {
        headers: { Authorization: `Bearer ${cfToken}` },
      }
    );

    const cfData = await cfRes.json();
    if (!cfData.success) {
      const msg = cfData.errors?.map((e: { message: string }) => e.message).join(', ') || 'Projeto não encontrado';
      return Response.json({ error: msg }, { status: 404, headers: corsHeaders });
    }

    const project = cfData.result;
    const latest = project.latest_deployment;

    return Response.json({
      ok: true,
      projectName: project.name,
      subdomain: project.subdomain,
      deployUrl: `https://${project.subdomain}`,
      latestDeployment: latest
        ? {
            id: latest.id,
            status: latest.latest_stage?.status || 'unknown',
            stageName: latest.latest_stage?.name || '',
            url: latest.url,
            createdAt: latest.created_on,
          }
        : null,
    }, { headers: corsHeaders });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
});
