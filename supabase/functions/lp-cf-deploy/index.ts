import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CF_BASE = 'https://api.cloudflare.com/client/v4';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { offerId, projectName, repoFullName, productionBranch = 'main' } = await req.json();

    if (!offerId || !projectName || !repoFullName) {
      return Response.json({ error: 'offerId, projectName e repoFullName são obrigatórios' }, { status: 400, headers: corsHeaders });
    }

    const cfToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    if (!cfToken || !accountId) {
      return Response.json({ error: 'CLOUDFLARE_API_TOKEN ou CLOUDFLARE_ACCOUNT_ID não configurados' }, { status: 500, headers: corsHeaders });
    }

    const [owner, repoName] = repoFullName.split('/');

    const cfRes = await fetch(`${CF_BASE}/accounts/${accountId}/pages/projects`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        production_branch: productionBranch,
        source: {
          type: 'github',
          config: {
            owner,
            repo_name: repoName,
            production_branch: productionBranch,
            pr_comments_enabled: false,
            deployments_enabled: true,
          },
        },
        build_config: {
          build_command: '',
          destination_dir: '',
          root_dir: '/',
        },
      }),
    });

    const cfData = await cfRes.json();
    if (!cfData.success) {
      const msg = cfData.errors?.map((e: { message: string }) => e.message).join(', ') || 'Erro Cloudflare';
      return Response.json({ error: msg }, { status: 400, headers: corsHeaders });
    }

    const project = cfData.result;
    const deployUrl = `https://${project.subdomain}`;

    // Atualizar lp_offers
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase
      .from('lp_offers')
      .update({
        cf_project: project.name,
        deploy_url: deployUrl,
        status: 'no_ar',
        updated_at: new Date().toISOString(),
      })
      .eq('id', offerId);

    return Response.json({
      ok: true,
      projectName: project.name,
      subdomain: project.subdomain,
      deployUrl,
    }, { headers: corsHeaders });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
});
