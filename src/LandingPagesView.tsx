import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Github, Globe, Upload, ExternalLink,
  ChevronDown, ChevronRight, Trash2, X, Loader2,
  CheckCircle2, Clock, Link2, FileCode,
  Building2, MapPin, Rocket, Settings2, Save,
  ScanSearch, CircleAlert, Download
} from 'lucide-react';
import { supabase } from './lib/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface LpClient {
  id: string;
  name: string;
  city: string | null;
  created_at: string;
}

interface LpOffer {
  id: string;
  client_id: string;
  name: string;
  slug: string | null;
  github_repo: string | null;
  cf_project: string | null;
  deploy_url: string | null;
  custom_domain: string | null;
  status: 'pendente' | 'repo_criado' | 'no_ar' | 'dominio_apontado';
  meta_pixel_id: string | null;
  clarity_id: string | null;
  meta_access_token: string | null;
  updated_at: string;
  created_at: string;
}

type OfferStatus = LpOffer['status'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<OfferStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: {
    label: 'Pendente',
    color: 'text-gray-400 bg-gray-400/10',
    icon: <Clock size={11} />,
  },
  repo_criado: {
    label: 'Repo criado',
    color: 'text-yellow-400 bg-yellow-400/10',
    icon: <Github size={11} />,
  },
  no_ar: {
    label: 'No ar',
    color: 'text-brand-primary bg-brand-primary/10',
    icon: <CheckCircle2 size={11} />,
  },
  dominio_apontado: {
    label: 'Domínio ativo',
    color: 'text-blue-400 bg-blue-400/10',
    icon: <Globe size={11} />,
  },
};

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function push(message: string, type: Toast['type'] = 'info') {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }

  return { toasts, push };
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function LandingPagesView() {
  const [clients, setClients] = useState<LpClient[]>([]);
  const [offers, setOffers] = useState<LpOffer[]>([]);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // offerId ou clientId em ação

  // Modais
  const [modalNewClient, setModalNewClient] = useState(false);
  const [modalNewOffer, setModalNewOffer] = useState<string | null>(null); // clientId
  const [modalRepo, setModalRepo] = useState<LpOffer | null>(null);
  const [modalUpload, setModalUpload] = useState<LpOffer | null>(null);
  const [modalDeploy, setModalDeploy] = useState<LpOffer | null>(null);
  const [modalDomain, setModalDomain] = useState<LpOffer | null>(null);

  // Forms
  const [newClientName, setNewClientName] = useState('');
  const [newClientCity, setNewClientCity] = useState('');
  const [newOfferName, setNewOfferName] = useState('');
  const [repoName, setRepoName] = useState('');
  const [deployProjectName, setDeployProjectName] = useState('');
  const [deployBranch, setDeployBranch] = useState('main');
  const [cfProjectName, setCfProjectName] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadHtml, setUploadHtml] = useState('');
  const [uploadTab, setUploadTab] = useState<'file' | 'paste'>('file');
  const [uploadFileName, setUploadFileName] = useState('index.html');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toasts, push } = useToasts();

  // ─── Carregamento ────────────────────────────────────────────────────────────

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: cls }, { data: ofs }] = await Promise.all([
      supabase.from('lp_clients').select('*').order('created_at', { ascending: false }),
      supabase.from('lp_offers').select('*').order('created_at', { ascending: true }),
    ]);
    setClients(Array.isArray(cls) ? cls : []);
    setOffers(Array.isArray(ofs) ? ofs : []);
    setLoading(false);
  }

  function offersForClient(clientId: string) {
    return offers.filter(o => o.client_id === clientId);
  }

  function toggleClient(id: string) {
    setExpandedClients(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ─── Ações: Cliente ──────────────────────────────────────────────────────────

  async function createClient() {
    if (!newClientName.trim()) return;
    const { data, error } = await supabase
      .from('lp_clients')
      .insert({ name: newClientName.trim(), city: newClientCity.trim() || null })
      .select()
      .single();

    if (error) { push('Erro ao criar cliente: ' + error.message, 'error'); return; }
    setClients(c => [data, ...c]);
    setExpandedClients(prev => new Set([...prev, data.id]));
    setModalNewClient(false);
    setNewClientName('');
    setNewClientCity('');
    push('Cliente criado!', 'success');
  }

  async function deleteClient(id: string) {
    if (!confirm('Remover cliente e todas as suas páginas?')) return;
    await supabase.from('lp_clients').delete().eq('id', id);
    setClients(c => c.filter(x => x.id !== id));
    setOffers(o => o.filter(x => x.client_id !== id));
    push('Cliente removido.', 'info');
  }

  // ─── Ações: Oferta ────────────────────────────────────────────────────────────

  async function createOffer() {
    if (!modalNewOffer || !newOfferName.trim()) return;
    const { data, error } = await supabase
      .from('lp_offers')
      .insert({
        client_id: modalNewOffer,
        name: newOfferName.trim(),
        slug: slugify(newOfferName.trim()),
        status: 'pendente',
      })
      .select()
      .single();

    if (error) { push('Erro ao criar oferta: ' + error.message, 'error'); return; }
    setOffers(o => [...o, data]);
    setModalNewOffer(null);
    setNewOfferName('');
    push('Oferta adicionada!', 'success');
  }

  async function deleteOffer(id: string) {
    if (!confirm('Remover esta oferta?')) return;
    await supabase.from('lp_offers').delete().eq('id', id);
    setOffers(o => o.filter(x => x.id !== id));
    push('Oferta removida.', 'info');
  }

  // ─── Ações: Edge Functions ────────────────────────────────────────────────────

  async function invokeAction(fnName: string, body: object) {
    const { data, error } = await supabase.functions.invoke(fnName, { body });
    // Supabase retorna error genérico em respostas non-2xx — verificar data.error primeiro
    if (data?.error) throw new Error(data.error);
    if (error) throw new Error(error.message);
    if (!data?.ok) throw new Error('Resposta inesperada da função');
    return data;
  }

  async function handleCreateRepo() {
    if (!modalRepo || !repoName.trim()) return;
    setActionLoading(modalRepo.id);
    try {
      const result = await invokeAction('lp-github-create-repo', {
        offerId: modalRepo.id,
        repoName: repoName.trim(),
        description: `Landing page — ${modalRepo.name}`,
      });
      setOffers(o => o.map(x => x.id === modalRepo.id
        ? { ...x, github_repo: result.repoFullName, status: 'repo_criado' }
        : x
      ));
      setModalRepo(null);
      setRepoName('');
      push(`Repo "${result.repoFullName}" criado!`, 'success');
    } catch (e: unknown) {
      push('Erro: ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUploadHtml() {
    if (!modalUpload) return;

    let content = '';
    if (uploadTab === 'file' && uploadFile) {
      content = await fileToText(uploadFile);
    } else if (uploadTab === 'paste' && uploadHtml.trim()) {
      content = uploadHtml.trim();
    } else {
      push('Selecione um arquivo ou cole o HTML.', 'error');
      return;
    }

    // Precisamos sempre do nome do projeto CF
    if (!cfProjectName.trim()) {
      push('Informe o nome do projeto Cloudflare.', 'error');
      return;
    }

    setActionLoading(modalUpload.id);
    try {
      const result = await invokeAction('lp-github-upload-file', {
        offerId: modalUpload.id,
        repoFullName: modalUpload.github_repo || undefined,
        fileName: uploadFileName || 'index.html',
        content,
        metaPixelId: modalUpload.meta_pixel_id || undefined,
        clarityId: modalUpload.clarity_id || undefined,
        metaAccessToken: modalUpload.meta_access_token || undefined,
        cfProjectName: cfProjectName.trim(),
      });

      // Atualizar estado local com dados do deploy
      const updates: Partial<LpOffer> = {};
      if (result.cfProject) updates.cf_project = result.cfProject;
      if (result.deployUrl) { updates.deploy_url = result.deployUrl; updates.status = 'no_ar'; }

      if (Object.keys(updates).length > 0) {
        setOffers(o => o.map(x => x.id === modalUpload.id ? { ...x, ...updates } : x));
      }

      setModalUpload(null);
      setUploadFile(null);
      setUploadHtml('');
      setCfProjectName('');

      const deployedMsg = result.deployUrl ? ` Publicado em: ${result.deployUrl}` : '';
      if (result.cfDeployed) {
        push(`Página publicada com sucesso!${deployedMsg}`, 'success');
      } else {
        push(result.isUpdate ? 'HTML atualizado no GitHub!' : 'HTML enviado ao GitHub!', 'success');
      }
    } catch (e: unknown) {
      push('Erro: ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeploy() {
    if (!modalDeploy || !deployProjectName.trim()) return;
    setActionLoading(modalDeploy.id);
    try {
      const result = await invokeAction('lp-cf-deploy', {
        offerId: modalDeploy.id,
        projectName: deployProjectName.trim(),
        repoFullName: modalDeploy.github_repo,
        productionBranch: deployBranch || 'main',
      });
      setOffers(o => o.map(x => x.id === modalDeploy.id
        ? { ...x, cf_project: result.projectName, deploy_url: result.deployUrl, status: 'no_ar' }
        : x
      ));
      setModalDeploy(null);
      setDeployProjectName('');
      push('Deploy iniciado! URL: ' + result.deployUrl, 'success');
    } catch (e: unknown) {
      push('Erro: ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAddDomain() {
    if (!modalDomain || !domainInput.trim()) return;
    setActionLoading(modalDomain.id);
    try {
      await invokeAction('lp-cf-add-domain', {
        offerId: modalDomain.id,
        projectName: modalDomain.cf_project,
        domain: domainInput.trim(),
      });
      setOffers(o => o.map(x => x.id === modalDomain.id
        ? { ...x, custom_domain: domainInput.trim(), status: 'dominio_apontado' }
        : x
      ));
      setModalDomain(null);
      setDomainInput('');
      push('Domínio adicionado!', 'success');
    } catch (e: unknown) {
      push('Erro: ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setActionLoading(null);
    }
  }

  // ─── Render helpers ───────────────────────────────────────────────────────────

  function OfferCard({ offer }: { offer: LpOffer }) {
    const st = STATUS_CONFIG[offer.status];
    const busy = actionLoading === offer.id;
    // Sanitiza URLs com "https://https://" que podem ter sido salvas com bug anterior
    const sanitizeUrl = (u: string | null) => u ? u.replace(/^https?:\/\/https?:\/\//, 'https://') : null;
    const url = offer.custom_domain
      ? `https://${offer.custom_domain}`
      : sanitizeUrl(offer.deploy_url);
    const [trackingOpen, setTrackingOpen] = useState(false);
    const [pixelId, setPixelId] = useState(offer.meta_pixel_id || '');
    const [clarityId, setClarityId] = useState(offer.clarity_id || '');
    const [accessToken, setAccessToken] = useState(offer.meta_access_token || '');
    const [savingTracking, setSavingTracking] = useState(false);
    const [checkingPixel, setCheckingPixel] = useState(false);
    const [pixelCheck, setPixelCheck] = useState<null | {
      meta: { checked: boolean; found: boolean };
      clarity: { checked: boolean; found: boolean };
      capi: { found: boolean };
      error?: string;
    }>(null);

    async function checkPixel() {
      const liveUrl = offer.custom_domain
        ? `https://${offer.custom_domain}`
        : offer.deploy_url;
      if (!liveUrl) { push('Página ainda não está no ar.', 'error'); return; }
      setCheckingPixel(true);
      setPixelCheck(null);
      try {
        const result = await invokeAction('lp-check-pixel', {
          url: liveUrl,
          metaPixelId: offer.meta_pixel_id || undefined,
          clarityId: offer.clarity_id || undefined,
        });
        setPixelCheck(result);
      } catch (e: unknown) {
        setPixelCheck({ meta: { checked: false, found: false }, clarity: { checked: false, found: false }, capi: { found: false }, error: e instanceof Error ? e.message : String(e) });
      } finally {
        setCheckingPixel(false);
      }
    }

    async function saveTracking() {
      setSavingTracking(true);
      const { error } = await supabase.from('lp_offers').update({
        meta_pixel_id: pixelId.trim() || null,
        clarity_id: clarityId.trim() || null,
        meta_access_token: accessToken.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', offer.id);
      setSavingTracking(false);
      if (error) { push('Erro ao salvar rastreamento', 'error'); return; }
      setOffers(o => o.map(x => x.id === offer.id
        ? { ...x, meta_pixel_id: pixelId.trim() || null, clarity_id: clarityId.trim() || null, meta_access_token: accessToken.trim() || null }
        : x
      ));
      push('Rastreamento salvo! Suba o HTML novamente para aplicar.', 'success');
    }

    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
        {/* Header da oferta */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-white">{offer.name}</p>
            {offer.slug && <p className="text-[11px] text-gray-500 font-mono">/{offer.slug}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${st.color}`}>
              {st.icon} {st.label}
            </span>
            <button
              onClick={() => deleteOffer(offer.id)}
              className="text-gray-600 hover:text-red-400 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Links */}
        {(offer.github_repo || url) && (
          <div className="flex flex-wrap gap-2 text-[11px]">
            {offer.github_repo && (
              <a
                href={`https://github.com/${offer.github_repo}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
              >
                <Github size={11} /> {offer.github_repo}
              </a>
            )}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-brand-primary hover:underline"
              >
                <ExternalLink size={11} /> {offer.custom_domain || offer.deploy_url}
              </a>
            )}
          </div>
        )}

        {/* Botões de ação contextuais */}
        <div className="flex flex-wrap gap-2">
          {offer.status === 'pendente' && (
            <ActionButton
              icon={<Github size={13} />}
              label="Criar repo"
              busy={busy}
              onClick={() => { setRepoName(slugify(offer.name)); setModalRepo(offer); }}
            />
          )}
          <ActionButton
            icon={<Upload size={13} />}
            label={offer.status === 'pendente' ? 'Subir HTML' : offer.cf_project ? 'Atualizar HTML' : 'Subir HTML'}
            busy={busy}
            primary={offer.status === 'pendente'}
            onClick={() => {
              setUploadFileName('index.html');
              setUploadTab('file');
              setUploadFile(null);
              setUploadHtml('');
              setCfProjectName(offer.cf_project || slugify(offer.name));
              setModalUpload(offer);
            }}
          />
          {offer.status === 'no_ar' && (
            <ActionButton
              icon={<Link2 size={13} />}
              label="Apontar domínio"
              busy={busy}
              onClick={() => { setDomainInput(''); setModalDomain(offer); }}
            />
          )}
          {offer.github_repo && (
            <a
              href={`https://raw.githubusercontent.com/${offer.github_repo}/main/${offer.slug ? offer.slug + '.html' : 'index.html'}`}
              download={`${offer.slug || 'index'}.html`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-colors"
              onClick={async (e) => {
                // Busca o arquivo e força download com nome correto
                e.preventDefault();
                try {
                  const rawUrl = `https://raw.githubusercontent.com/${offer.github_repo}/main/index.html`;
                  const res = await fetch(rawUrl);
                  if (!res.ok) { push('Arquivo não encontrado no repositório.', 'error'); return; }
                  const blob = await res.blob();
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `${offer.slug || 'index'}.html`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                } catch {
                  push('Erro ao baixar o arquivo.', 'error');
                }
              }}
            >
              <Download size={12} />
              Baixar HTML
            </a>
          )}
          {(offer.meta_pixel_id || offer.clarity_id) && url && (
            <button
              disabled={checkingPixel}
              onClick={checkPixel}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              {checkingPixel ? <Loader2 size={12} className="animate-spin" /> : <ScanSearch size={12} />}
              Verificar
            </button>
          )}
          <button
            onClick={() => setTrackingOpen(o => !o)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              trackingOpen ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'
            }`}
          >
            <Settings2 size={12} />
            Pixel
            {(offer.meta_pixel_id || offer.clarity_id) && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
            )}
          </button>
        </div>

        {/* Resultado da verificação de pixel */}
        <AnimatePresence>
          {pixelCheck && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-2"
            >
              {pixelCheck.error ? (
                <div className="flex items-center gap-2 text-xs text-red-400">
                  <CircleAlert size={13} /> {pixelCheck.error}
                </div>
              ) : (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Resultado da verificação</p>
                  {pixelCheck.meta.checked && (
                    <div className="flex items-center gap-2 text-xs">
                      {pixelCheck.meta.found
                        ? <CheckCircle2 size={13} className="text-brand-primary shrink-0" />
                        : <CircleAlert size={13} className="text-red-400 shrink-0" />}
                      <span className={pixelCheck.meta.found ? 'text-white' : 'text-red-400'}>
                        Meta Pixel {pixelCheck.meta.found ? 'detectado no HTML' : 'não encontrado — suba o HTML novamente'}
                      </span>
                    </div>
                  )}
                  {pixelCheck.clarity.checked && (
                    <div className="flex items-center gap-2 text-xs">
                      {pixelCheck.clarity.found
                        ? <CheckCircle2 size={13} className="text-brand-primary shrink-0" />
                        : <CircleAlert size={13} className="text-red-400 shrink-0" />}
                      <span className={pixelCheck.clarity.found ? 'text-white' : 'text-red-400'}>
                        Clarity {pixelCheck.clarity.found ? 'detectado no HTML' : 'não encontrado — suba o HTML novamente'}
                      </span>
                    </div>
                  )}
                  {pixelCheck.capi.found && (
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle2 size={13} className="text-brand-primary shrink-0" />
                      <span className="text-white">Conversions API configurada</span>
                    </div>
                  )}
                  {!pixelCheck.meta.checked && !pixelCheck.clarity.checked && (
                    <p className="text-xs text-gray-500">Configure o Pixel ID antes de verificar.</p>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Painel de rastreamento */}
        <AnimatePresence>
          {trackingOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-white/10 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Rastreamento</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">Meta Pixel ID</label>
                    <input
                      className="input-dark text-xs py-1.5"
                      placeholder="1234567890"
                      value={pixelId}
                      onChange={e => setPixelId(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 mb-1 block">Clarity ID</label>
                    <input
                      className="input-dark text-xs py-1.5"
                      placeholder="abc123xyz"
                      value={clarityId}
                      onChange={e => setClarityId(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">
                    Meta Access Token <span className="text-gray-600">(Conversions API)</span>
                  </label>
                  <input
                    className="input-dark text-xs py-1.5 font-mono"
                    placeholder="EAAxxxxxxx..."
                    value={accessToken}
                    onChange={e => setAccessToken(e.target.value)}
                    type="password"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[10px] text-gray-600">
                    Após salvar, suba o HTML novamente para aplicar.
                  </p>
                  <button
                    onClick={saveTracking}
                    disabled={savingTracking}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    {savingTracking ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                    Salvar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium shadow-xl pointer-events-auto ${
                t.type === 'success' ? 'bg-brand-primary text-black'
                : t.type === 'error' ? 'bg-red-500 text-white'
                : 'bg-white/10 text-white border border-white/20'
              }`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Landing Pages</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {clients.length} cliente{clients.length !== 1 ? 's' : ''} · {offers.length} página{offers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setModalNewClient(true)}
          className="flex items-center gap-2 bg-brand-primary text-black text-sm font-bold px-4 py-2 rounded-xl hover:bg-brand-primary/90 transition-colors"
        >
          <Plus size={15} /> Novo Cliente
        </button>
      </div>

      {/* Lista de clientes */}
      {clients.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Globe size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum cliente ainda.</p>
          <p className="text-sm mt-1">Clique em "Novo Cliente" para começar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map(client => {
            const clientOffers = offersForClient(client.id);
            const expanded = expandedClients.has(client.id);
            const activeCount = clientOffers.filter(o => o.status === 'no_ar' || o.status === 'dominio_apontado').length;

            return (
              <div key={client.id} className="border border-white/10 rounded-2xl overflow-hidden">
                {/* Header do cliente */}
                <button
                  className="w-full flex items-center gap-3 px-5 py-4 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
                  onClick={() => toggleClient(client.id)}
                >
                  <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center shrink-0">
                    <Building2 size={15} className="text-brand-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{client.name}</p>
                    {client.city && (
                      <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} /> {client.city}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {clientOffers.length > 0 && (
                      <span className="text-[11px] text-gray-500">
                        {activeCount}/{clientOffers.length} no ar
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteClient(client.id); }}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                    {expanded
                      ? <ChevronDown size={16} className="text-gray-400" />
                      : <ChevronRight size={16} className="text-gray-400" />
                    }
                  </div>
                </button>

                {/* Ofertas */}
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 py-4 border-t border-white/10 space-y-3">
                        {clientOffers.length === 0 && (
                          <p className="text-sm text-gray-600 text-center py-2">
                            Nenhuma página ainda.
                          </p>
                        )}
                        {clientOffers.map(offer => (
                          <React.Fragment key={offer.id}>
                            <OfferCard offer={offer} />
                          </React.Fragment>
                        ))}
                        <button
                          onClick={() => { setNewOfferName(''); setModalNewOffer(client.id); }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-white/20 rounded-xl text-sm text-gray-500 hover:text-white hover:border-white/40 transition-colors"
                        >
                          <Plus size={14} /> Adicionar oferta
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: Novo Cliente ────────────────────────────────────── */}
      <Modal
        open={modalNewClient}
        title="Novo Cliente"
        onClose={() => setModalNewClient(false)}
        onConfirm={createClient}
        confirmLabel="Criar"
      >
        <FormField label="Nome *">
          <input
            autoFocus
            className="input-dark"
            placeholder="Ex: Construtora Horizonte"
            value={newClientName}
            onChange={e => setNewClientName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createClient()}
          />
        </FormField>
        <FormField label="Cidade">
          <input
            className="input-dark"
            placeholder="Ex: São Paulo - SP"
            value={newClientCity}
            onChange={e => setNewClientCity(e.target.value)}
          />
        </FormField>
      </Modal>

      {/* ── Modal: Nova Oferta ─────────────────────────────────────── */}
      <Modal
        open={!!modalNewOffer}
        title="Adicionar Oferta"
        onClose={() => setModalNewOffer(null)}
        onConfirm={createOffer}
        confirmLabel="Adicionar"
      >
        <FormField label="Nome da oferta *">
          <input
            autoFocus
            className="input-dark"
            placeholder="Ex: Reforma, Construção, Financiada..."
            value={newOfferName}
            onChange={e => setNewOfferName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createOffer()}
          />
        </FormField>
        <p className="text-[11px] text-gray-500 mt-1">
          Slug gerado: <span className="font-mono text-gray-400">/{slugify(newOfferName || 'nome-da-oferta')}</span>
        </p>
      </Modal>

      {/* ── Modal: Criar Repo ──────────────────────────────────────── */}
      <Modal
        open={!!modalRepo}
        title={`Criar Repo — ${modalRepo?.name}`}
        onClose={() => setModalRepo(null)}
        onConfirm={handleCreateRepo}
        confirmLabel="Criar no GitHub"
        loading={actionLoading === modalRepo?.id}
      >
        <FormField label="Nome do repositório">
          <input
            autoFocus
            className="input-dark font-mono"
            placeholder="ex: moura-engenharia-reforma"
            value={repoName}
            onChange={e => setRepoName(e.target.value)}
          />
        </FormField>
        <p className="text-[11px] text-gray-500 mt-1">
          Será criado em <span className="font-mono text-gray-400">
            {import.meta.env.VITE_GITHUB_ORG || 'sua conta'}
          </span>
        </p>
      </Modal>

      {/* ── Modal: Upload HTML ─────────────────────────────────────── */}
      <Modal
        open={!!modalUpload}
        title={`${modalUpload?.cf_project ? 'Atualizar' : 'Publicar'} Página — ${modalUpload?.name}`}
        onClose={() => setModalUpload(null)}
        onConfirm={handleUploadHtml}
        confirmLabel={modalUpload?.cf_project ? 'Atualizar e publicar' : 'Publicar no Cloudflare'}
        loading={actionLoading === modalUpload?.id}
        wide
      >
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-4">
          {(['file', 'paste'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setUploadTab(tab)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                uploadTab === tab ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'
              }`}
            >
              {tab === 'file' ? '📁 Arquivo' : '📋 Colar HTML'}
            </button>
          ))}
        </div>

        {uploadTab === 'file' ? (
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              uploadFile ? 'border-brand-primary/50 bg-brand-primary/5' : 'border-white/20 hover:border-white/40'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) { setUploadFile(f); setUploadFileName(f.name); }
            }}
          >
            <FileCode size={24} className={`mx-auto mb-2 ${uploadFile ? 'text-brand-primary' : 'text-gray-500'}`} />
            {uploadFile ? (
              <p className="text-sm font-medium text-white">{uploadFile.name}</p>
            ) : (
              <>
                <p className="text-sm text-gray-400">Arraste o .html aqui ou clique</p>
                <p className="text-xs text-gray-600 mt-1">index.html, oferta.html...</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) { setUploadFile(f); setUploadFileName(f.name); }
              }}
            />
          </div>
        ) : (
          <textarea
            className="input-dark font-mono text-xs h-40 resize-none"
            placeholder="Cole o HTML completo aqui..."
            value={uploadHtml}
            onChange={e => setUploadHtml(e.target.value)}
          />
        )}

        <FormField label="Nome do arquivo" className="mt-3">
          <input
            className="input-dark font-mono"
            value={uploadFileName}
            onChange={e => setUploadFileName(e.target.value)}
            placeholder="index.html"
          />
        </FormField>

        {/* Campo CF Project — sempre visível */}
        <FormField label={modalUpload?.cf_project ? 'Projeto Cloudflare Pages' : 'Nome do projeto Cloudflare *'}>
          <input
            className="input-dark font-mono"
            placeholder="ex: moura-engenharia-reforma"
            value={cfProjectName}
            onChange={e => setCfProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
          />
          <p className="text-[11px] text-gray-500 mt-1">
            URL: <span className="font-mono text-gray-400">{cfProjectName || 'projeto'}.pages.dev</span>
          </p>
          {modalUpload?.cf_project && cfProjectName !== modalUpload.cf_project && (
            <p className="text-[11px] text-yellow-400 mt-1">
              ⚠️ Nome diferente do atual — um novo projeto será criado.
            </p>
          )}
        </FormField>
      </Modal>

      {/* ── Modal: Deploy ──────────────────────────────────────────── */}
      <Modal
        open={!!modalDeploy}
        title={`Deploy — ${modalDeploy?.name}`}
        onClose={() => setModalDeploy(null)}
        onConfirm={handleDeploy}
        confirmLabel="Publicar no Cloudflare"
        loading={actionLoading === modalDeploy?.id}
      >
        <FormField label="Nome do projeto (Cloudflare Pages)">
          <input
            autoFocus
            className="input-dark font-mono"
            placeholder="ex: moura-engenharia-reforma"
            value={deployProjectName}
            onChange={e => setDeployProjectName(e.target.value)}
          />
          <p className="text-[11px] text-gray-500 mt-1">
            URL: <span className="font-mono">{deployProjectName || 'projeto'}.pages.dev</span>
          </p>
        </FormField>
        <FormField label="Branch">
          <input
            className="input-dark"
            value={deployBranch}
            onChange={e => setDeployBranch(e.target.value)}
          />
        </FormField>
      </Modal>

      {/* ── Modal: Apontar Domínio ─────────────────────────────────── */}
      <Modal
        open={!!modalDomain}
        title={`Domínio — ${modalDomain?.name}`}
        onClose={() => setModalDomain(null)}
        onConfirm={handleAddDomain}
        confirmLabel="Adicionar domínio"
        loading={actionLoading === modalDomain?.id}
      >
        <FormField label="Domínio customizado">
          <input
            autoFocus
            className="input-dark"
            placeholder="lp.mouraengenharia.com.br"
            value={domainInput}
            onChange={e => setDomainInput(e.target.value)}
          />
        </FormField>
        {modalDomain?.cf_project && (
          <div className="mt-3 p-3 bg-white/5 rounded-xl text-xs font-mono text-gray-400 space-y-1">
            <p className="text-[10px] text-gray-600 font-sans uppercase tracking-widest mb-2">DNS necessário</p>
            <div className="flex gap-3">
              <span className="text-brand-primary">CNAME</span>
              <span>{domainInput || 'seu-dominio.com'}</span>
              <span className="text-gray-600">→</span>
              <span>{modalDomain.cf_project}.pages.dev</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function ActionButton({
  icon, label, busy, primary, onClick
}: {
  icon: React.ReactNode;
  label: string;
  busy: boolean;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={busy}
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
        primary
          ? 'bg-brand-primary text-black hover:bg-brand-primary/90'
          : 'bg-white/10 text-white hover:bg-white/20'
      }`}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

function Modal({
  open, title, onClose, onConfirm, confirmLabel, loading, wide, children
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  loading?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={e => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={`bg-[#111] border border-white/10 rounded-2xl shadow-2xl w-full ${wide ? 'max-w-lg' : 'max-w-md'}`}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">{children}</div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/10">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-brand-primary text-black rounded-xl hover:bg-brand-primary/90 transition-colors disabled:opacity-60"
              >
                {loading && <Loader2 size={13} className="animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FormField({
  label, children, className
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
