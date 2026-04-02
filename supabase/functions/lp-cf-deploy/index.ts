import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CF_BASE = 'https://api.cloudflare.com/client/v4';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { offerId, projectName, repoFullName, productionBranch = 'main', triggerCommit = true } = await req.json();

    if (!offerId || !projectName || !repoFullName) {
      return Response.json({ ok: false, error: 'offerId, projectName e repoFullName são obrigatórios' }, { headers: corsHeaders });
    }

    const cfToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    if (!cfToken || !accountId) {
      return Response.json({ ok: false, error: 'CLOUDFLARE_API_TOKEN ou CLOUDFLARE_ACCOUNT_ID não configurados' }, { headers: corsHeaders });
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
          destination_dir: '/',
          root_dir: '/',
        },
      }),
    });

    const cfData = await cfRes.json();
    console.log('[CF Deploy] status:', cfRes.status, cfData.success);

    if (!cfData.success) {
      const msg = cfData.errors?.map((e: { message: string }) => e.message).join(', ') || 'Erro Cloudflare';
      return Response.json({ ok: false, error: msg }, { headers: corsHeaders });
    }

    const project = cfData.result;
    // Usar nome do projeto para montar URL de produção (não o subdomain com hash)
    const deployUrl = `https://${project.name}.pages.dev`;

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

    // ── Disparar primeiro deploy: fazer um commit no GitHub para triggar o CF ──
    let commitTriggered = false;
    if (triggerCommit) {
      try {
        const ghToken = Deno.env.get('GITHUB_TOKEN');
        const [owner, repoName] = repoFullName.split('/');

        // Verificar se já existe index.html no repo
        const existsRes = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/contents/index.html`,
          { headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } }
        );

        if (existsRes.ok) {
          const existing = await existsRes.json();
          // Fazer um commit vazio (atualizar o mesmo arquivo) para triggar o CF
          const updateRes = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/contents/index.html`,
            {
              method: 'PUT',
              headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
              body: JSON.stringify({
                message: 'chore: trigger Cloudflare Pages deploy',
                content: existing.content.replace(/\n/g, ''), // mesmo conteúdo, sem quebras
                sha: existing.sha,
              }),
            }
          );
          commitTriggered = updateRes.ok;
          console.log('[GitHub trigger commit] status:', updateRes.status);
        }
      } catch (e) {
        console.error('[trigger commit error]', e);
        // Não bloqueia — o deploy no CF pode ser feito manualmente depois
      }
    }

    return Response.json({
      ok: true,
      projectName: project.name,
      deployUrl,
      commitTriggered,
    }, { headers: corsHeaders });

  } catch (err) {
    console.error('[lp-cf-deploy]', err);
    return Response.json({ ok: false, error: String(err) }, { headers: corsHeaders });
  }
});
