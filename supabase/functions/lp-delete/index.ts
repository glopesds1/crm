import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { repoFullName, cfProject } = await req.json();

    const ghToken = Deno.env.get('GITHUB_TOKEN');
    const cfToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');

    let githubDeleted = false;
    let cfDeleted = false;
    const errors: string[] = [];

    // ── Deletar repositório GitHub ─────────────────────────────────────────────
    if (repoFullName && ghToken) {
      const res = await fetch(`https://api.github.com/repos/${repoFullName}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (res.status === 204 || res.status === 404) {
        githubDeleted = true;
      } else {
        const data = await res.json().catch(() => ({}));
        errors.push(`GitHub: ${data.message || res.status}`);
      }
      console.log('[GitHub delete]', repoFullName, res.status);
    }

    // ── Deletar projeto Cloudflare Pages ───────────────────────────────────────
    if (cfProject && cfToken && accountId) {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${cfProject}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${cfToken}` },
        }
      );
      const data = await res.json().catch(() => ({}));
      if (data.result === null || data.success || res.status === 404) {
        cfDeleted = true;
      } else {
        const msg = data.errors?.[0]?.message || res.status;
        errors.push(`Cloudflare: ${msg}`);
      }
      console.log('[CF delete]', cfProject, res.status, data.success);
    }

    return Response.json({
      ok: errors.length === 0,
      githubDeleted,
      cfDeleted,
      errors: errors.length > 0 ? errors : undefined,
    }, { headers: corsHeaders });

  } catch (err) {
    console.error('[lp-delete]', err);
    return Response.json({ ok: false, error: String(err) }, { headers: corsHeaders });
  }
});
