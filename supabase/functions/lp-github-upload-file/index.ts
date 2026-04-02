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
  return injection + html;
}

// Faz upload de um único arquivo para o GitHub
async function uploadFileToGitHub(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string, // já em base64
  message: string,
): Promise<void> {
  // Buscar SHA atual se arquivo já existe
  let sha: string | undefined;
  const existsRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } }
  );
  if (existsRes.ok) {
    const existing = await existsRes.json();
    sha = existing.sha;
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        message,
        content,
        ...(sha ? { sha } : {}),
      }),
    }
  );

  if (!res.ok) {
    const data = await res.json();
    throw new Error(`GitHub (${path}): ${data.message || res.status}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      offerId,
      repoFullName,
      metaPixelId,
      clarityId,
      metaAccessToken,
      // Modo pasta: array de arquivos
      files,
      // Modo arquivo único
      fileName = 'index.html',
      content,
    } = body;

    if (!repoFullName) {
      return Response.json({ ok: false, error: 'repoFullName é obrigatório' }, { headers: corsHeaders });
    }

    const token = Deno.env.get('GITHUB_TOKEN');
    if (!token) {
      return Response.json({ ok: false, error: 'GITHUB_TOKEN não configurado' }, { headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const capiEndpoint = metaPixelId && metaAccessToken
      ? `${supabaseUrl}/functions/v1/lp-meta-capi`
      : undefined;

    const [owner, repo] = repoFullName.split('/');
    let filesUploaded = 0;

    if (files && Array.isArray(files) && files.length > 0) {
      // ── Modo pasta: múltiplos arquivos ─────────────────────────────────────
      for (const file of files as { path: string; content: string; encoding: string }[]) {
        let finalContent = file.content;

        // Injetar scripts apenas no index.html (encoding utf-8)
        if (file.encoding === 'utf-8' && (file.path === 'index.html' || file.path.endsWith('/index.html'))) {
          const injected = injectTrackingScripts(file.content, metaPixelId, clarityId, capiEndpoint);
          // Converter para base64 para a API do GitHub
          finalContent = btoa(unescape(encodeURIComponent(injected)));
        } else if (file.encoding === 'utf-8') {
          finalContent = btoa(unescape(encodeURIComponent(file.content)));
        }
        // encoding === 'base64': já está pronto

        await uploadFileToGitHub(token, owner, repo, file.path, finalContent, `Upload ${file.path}`);
        filesUploaded++;
      }

    } else if (content) {
      // ── Modo arquivo único ──────────────────────────────────────────────────
      const finalContent = injectTrackingScripts(content, metaPixelId, clarityId, capiEndpoint);
      const base64Content = btoa(unescape(encodeURIComponent(finalContent)));
      await uploadFileToGitHub(token, owner, repo, fileName, base64Content, `Upload ${fileName}`);
      filesUploaded = 1;

    } else {
      return Response.json({ ok: false, error: 'content ou files é obrigatório' }, { headers: corsHeaders });
    }

    // Atualizar updated_at no banco
    if (offerId) {
      await supabase.from('lp_offers').update({ updated_at: new Date().toISOString() }).eq('id', offerId);
    }

    return Response.json({
      ok: true,
      filesUploaded,
      scriptsInjected: { pixel: !!metaPixelId, clarity: !!clarityId, capi: !!capiEndpoint },
    }, { headers: corsHeaders });

  } catch (err) {
    console.error('[lp-github-upload-file]', err);
    return Response.json({ ok: false, error: String(err) }, { headers: corsHeaders });
  }
});
