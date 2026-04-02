import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Injeta scripts de rastreamento antes de </head>
function injectTrackingScripts(html: string, metaPixelId?: string, clarityId?: string, capiEndpoint?: string): string {
  const scripts: string[] = [];

  if (metaPixelId) {
    scripts.push(`<!-- Meta Pixel -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${metaPixelId}');fbq('track','PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel -->`);
  }

  if (clarityId) {
    scripts.push(`<!-- Microsoft Clarity -->
<script type="text/javascript">
(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window,document,"clarity","script","${clarityId}");
</script>
<!-- End Clarity -->`);
  }

  // Script de Conversions API — intercepta submit do form e envia server-side
  if (metaPixelId && capiEndpoint) {
    scripts.push(`<!-- Meta CAPI -->
<script>
(function(){
  document.addEventListener('submit', function(e){
    var form = e.target;
    if(!form || form.tagName !== 'FORM') return;
    var data = {};
    new FormData(form).forEach(function(v,k){ data[k]=v; });
    fetch('${capiEndpoint}', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ pixelId:'${metaPixelId}', eventName:'Lead', userData: data, eventSourceUrl: window.location.href })
    }).catch(function(){});
  }, true);
})();
</script>
<!-- End Meta CAPI -->`);
  }

  if (scripts.length === 0) return html;

  const injection = '\n' + scripts.join('\n') + '\n';
  if (html.includes('</head>')) {
    return html.replace('</head>', injection + '</head>');
  }
  // Sem </head>, injeta no topo
  return injection + html;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      offerId,
      repoFullName,
      fileName = 'index.html',
      content,
      metaPixelId,
      clarityId,
      metaAccessToken,
      cfProjectName, // nome do projeto CF (para criar na primeira vez)
    } = await req.json();

    if (!content) {
      return Response.json({ ok: false, error: 'content é obrigatório' }, { headers: corsHeaders });
    }

    const cfToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Montar endpoint CAPI
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const capiEndpoint = metaPixelId && metaAccessToken
      ? `${supabaseUrl}/functions/v1/lp-meta-capi`
      : undefined;

    // Injetar scripts de rastreamento no HTML
    const finalContent = injectTrackingScripts(content, metaPixelId, clarityId, capiEndpoint);

    // ── 1. Upload para GitHub (se repo configurado) ────────────────────────────
    let githubResult: Record<string, unknown> = {};
    if (repoFullName) {
      const token = Deno.env.get('GITHUB_TOKEN');
      if (token) {
        const [owner, repo] = repoFullName.split('/');
        const base64Content = btoa(unescape(encodeURIComponent(finalContent)));

        let sha: string | undefined;
        const existsRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`,
          { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } }
        );
        if (existsRes.ok) sha = (await existsRes.json()).sha;

        const ghRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${fileName}`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
            body: JSON.stringify({ message: sha ? `Update ${fileName}` : `Add ${fileName}`, content: base64Content, ...(sha ? { sha } : {}) }),
          }
        );
        const ghData = await ghRes.json();
        console.log('[GitHub] status:', ghRes.status);
        if (!ghRes.ok) {
          return Response.json({ ok: false, error: `GitHub: ${ghData.message || ghRes.status}` }, { headers: corsHeaders });
        }
        githubResult = { sha: ghData.content?.sha, commitUrl: ghData.commit?.html_url, isUpdate: !!sha };
      }
    }

    // ── 2. Deploy direto no Cloudflare Pages ──────────────────────────────────
    let cfDeployed = false;
    let deployUrl: string | null = null;
    let cfProject: string | null = null;

    if (cfToken && accountId) {
      // Buscar cf_project do offer no banco
      let existingProject: string | null = null;
      if (offerId) {
        const { data } = await supabase.from('lp_offers').select('cf_project, deploy_url').eq('id', offerId).single();
        existingProject = data?.cf_project ?? null;
        deployUrl = data?.deploy_url ?? null;
      }

      // cfProjectName do body sobrescreve o existente (permite trocar para novo projeto)
      cfProject = cfProjectName || existingProject || null;

      // Verificar se o projeto existe no CF; se não, criar (direct upload mode)
      if (cfProject) {
        const checkRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${cfProject}`,
          { headers: { 'Authorization': `Bearer ${cfToken}` } }
        );
        const checkData = await checkRes.json();
        console.log('[CF] check project:', checkRes.status, checkData.success);

        if (!checkData.success) {
          // Projeto não existe — criar em modo direct upload (sem source)
          const createRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: cfProject, production_branch: 'main' }),
          });
          const createData = await createRes.json();
          console.log('[CF] create project:', createRes.status, createData.success);
          if (!createData.success) {
            const createErr = createData.errors?.[0]?.message || JSON.stringify(createData.errors);
            return Response.json({ ok: false, error: `Cloudflare criar projeto: ${createErr}` }, { headers: corsHeaders });
          }
          deployUrl = `https://${cfProject}.pages.dev`;
        } else {
          // Projeto existe — manter deploy_url atual ou montar padrão
          deployUrl = deployUrl || `https://${cfProject}.pages.dev`;
        }
      }

      // Upload direto ao Cloudflare Pages
      if (cfProject) {
        const formData = new FormData();
        formData.append(fileName, new Blob([finalContent], { type: 'text/html' }), fileName);

        const cfRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${cfProject}/deployments`,
          { method: 'POST', headers: { 'Authorization': `Bearer ${cfToken}` }, body: formData }
        );
        const cfData = await cfRes.json();
        console.log('[CF Deploy] status:', cfRes.status, JSON.stringify(cfData));

        if (!cfData.success) {
          const cfError = cfData.errors?.[0]?.message || cfData.errors?.[0]?.code || JSON.stringify(cfData.errors);
          return Response.json({
            ok: false,
            error: `Cloudflare Pages: ${cfError}. Se o projeto foi criado com integração GitHub, use um nome diferente.`,
          }, { headers: corsHeaders });
        }

        cfDeployed = true;
        // Sempre usar a URL de produção do projeto (não a URL de deployment com hash)
        deployUrl = `https://${cfProject}.pages.dev`;
      }
    }

    // ── 3. Atualizar banco ────────────────────────────────────────────────────
    if (offerId) {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (cfProject) updates.cf_project = cfProject;
      if (deployUrl) { updates.deploy_url = deployUrl; updates.status = 'no_ar'; }
      await supabase.from('lp_offers').update(updates).eq('id', offerId);
    }

    return Response.json({
      ok: true,
      fileName,
      ...githubResult,
      cfDeployed,
      deployUrl,
      cfProject,
      scriptsInjected: { pixel: !!metaPixelId, clarity: !!clarityId, capi: !!capiEndpoint },
    }, { headers: corsHeaders });

  } catch (err) {
    console.error('[lp-github-upload-file]', err);
    return Response.json({ ok: false, error: String(err) }, { headers: corsHeaders });
  }
});
