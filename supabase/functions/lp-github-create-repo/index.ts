import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { offerId, repoName, description } = await req.json();
    if (!offerId || !repoName) {
      return Response.json({ ok: false, error: 'offerId e repoName são obrigatórios' }, { headers: corsHeaders });
    }

    const token = Deno.env.get('GITHUB_TOKEN');
    const org = Deno.env.get('GITHUB_ORG');
    if (!token) return Response.json({ ok: false, error: 'GITHUB_TOKEN não configurado nos secrets' }, { headers: corsHeaders });

    const endpoint = org
      ? `https://api.github.com/orgs/${org}/repos`
      : 'https://api.github.com/user/repos';

    const ghRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        name: repoName,
        description: description || `Landing page — ${repoName}`,
        private: false,
        auto_init: true,
      }),
    });

    const ghData = await ghRes.json();
    console.log('[GitHub] status:', ghRes.status, JSON.stringify(ghData));

    if (!ghRes.ok) {
      return Response.json({ ok: false, error: `GitHub: ${ghData.message || ghRes.status}` }, { headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase
      .from('lp_offers')
      .update({
        github_repo: ghData.full_name,
        status: 'repo_criado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', offerId);

    return Response.json({
      ok: true,
      repoFullName: ghData.full_name,
      htmlUrl: ghData.html_url,
      defaultBranch: ghData.default_branch,
    }, { headers: corsHeaders });

  } catch (err) {
    console.error('[lp-github-create-repo] error:', err);
    return Response.json({ ok: false, error: String(err) }, { headers: corsHeaders });
  }
});
