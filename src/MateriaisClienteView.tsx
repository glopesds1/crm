import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2, Users, Globe, Monitor, Camera, MessageSquare,
  ChevronDown, Check, Calendar, Link, Eye, EyeOff, Save,
  Loader2,
} from 'lucide-react';
import { supabase } from './lib/supabase';

// ── Types ────────────────────────────────────────────────────
interface MateriaisData {
  tenant_id: string;
  // Dados da Empresa
  empresa_nome: string;
  empresa_responsaveis: string;
  empresa_whatsapp: string;
  empresa_email: string;
  empresa_indicacao_parceiros: boolean;
  empresa_indicacao_parceiros_desc: string;
  empresa_indicacao_clientes: boolean;
  empresa_indicacao_clientes_desc: string;
  empresa_placa_obra: boolean;
  empresa_placa_obra_desc: string;
  // Publico-Alvo
  publico_cidades: string;
  publico_bairros: string;
  publico_condominios: string;
  publico_restricoes: string;
  // Acessos
  acesso_facebook_email: string;
  acesso_facebook_senha: string;
  acesso_google_email: string;
  acesso_google_senha: string;
  acesso_instagram_email: string;
  acesso_instagram_senha: string;
  // Dominio
  dominio_possui: boolean;
  dominio_url: string;
  dominio_login: string;
  dominio_senha: string;
  // Materiais
  mat_fotos_obras: boolean;
  mat_videos: boolean;
  mat_identidade_visual: boolean;
  mat_fotos_lideranca: boolean;
  mat_link_drive: string;
  // Feedbacks
  feed_prints_elogios: boolean;
  feed_comentarios: boolean;
  feed_depoimentos: boolean;
  feed_videos_obra: boolean;
  // Prazo
  prazo_envio: string;
}

const DEFAULT_DATA: Omit<MateriaisData, 'tenant_id'> = {
  empresa_nome: '',
  empresa_responsaveis: '',
  empresa_whatsapp: '',
  empresa_email: '',
  empresa_indicacao_parceiros: false,
  empresa_indicacao_parceiros_desc: '',
  empresa_indicacao_clientes: false,
  empresa_indicacao_clientes_desc: '',
  empresa_placa_obra: false,
  empresa_placa_obra_desc: '',
  publico_cidades: '',
  publico_bairros: '',
  publico_condominios: '',
  publico_restricoes: '',
  acesso_facebook_email: '',
  acesso_facebook_senha: '',
  acesso_google_email: '',
  acesso_google_senha: '',
  acesso_instagram_email: '',
  acesso_instagram_senha: '',
  dominio_possui: false,
  dominio_url: '',
  dominio_login: '',
  dominio_senha: '',
  mat_fotos_obras: false,
  mat_videos: false,
  mat_identidade_visual: false,
  mat_fotos_lideranca: false,
  mat_link_drive: '',
  feed_prints_elogios: false,
  feed_comentarios: false,
  feed_depoimentos: false,
  feed_videos_obra: false,
  prazo_envio: '',
};

// ── Section config ───────────────────────────────────────────
type FieldDef =
  | { type: 'text' | 'email' | 'tel' | 'url' | 'date'; key: keyof MateriaisData; label: string; placeholder?: string }
  | { type: 'textarea'; key: keyof MateriaisData; label: string; placeholder?: string }
  | { type: 'password'; key: keyof MateriaisData; label: string; placeholder?: string }
  | { type: 'boolean'; key: keyof MateriaisData; label: string }
  | { type: 'boolean_with_desc'; keyBool: keyof MateriaisData; keyDesc: keyof MateriaisData; label: string; descPlaceholder?: string };

interface SectionDef {
  id: string;
  title: string;
  icon: React.ReactNode;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    id: 'empresa',
    title: 'Dados da Empresa',
    icon: <Building2 className="w-5 h-5" />,
    fields: [
      { type: 'text', key: 'empresa_nome', label: 'Nome da Empresa', placeholder: 'Ex: Construtora ABC' },
      { type: 'text', key: 'empresa_responsaveis', label: 'Responsáveis', placeholder: 'Nomes dos responsáveis' },
      { type: 'tel', key: 'empresa_whatsapp', label: 'WhatsApp', placeholder: '(00) 00000-0000' },
      { type: 'email', key: 'empresa_email', label: 'E-mail', placeholder: 'contato@empresa.com' },
      { type: 'boolean_with_desc', keyBool: 'empresa_indicacao_parceiros', keyDesc: 'empresa_indicacao_parceiros_desc', label: 'Indicação de Parceiros', descPlaceholder: 'Descreva os parceiros...' },
      { type: 'boolean_with_desc', keyBool: 'empresa_indicacao_clientes', keyDesc: 'empresa_indicacao_clientes_desc', label: 'Indicação de Clientes', descPlaceholder: 'Descreva os clientes...' },
      { type: 'boolean_with_desc', keyBool: 'empresa_placa_obra', keyDesc: 'empresa_placa_obra_desc', label: 'Placa de Obra', descPlaceholder: 'Detalhes sobre a placa...' },
    ],
  },
  {
    id: 'publico',
    title: 'Público-Alvo',
    icon: <Users className="w-5 h-5" />,
    fields: [
      { type: 'textarea', key: 'publico_cidades', label: 'Cidades', placeholder: 'Cidades de atuação...' },
      { type: 'textarea', key: 'publico_bairros', label: 'Bairros', placeholder: 'Bairros prioritários...' },
      { type: 'textarea', key: 'publico_condominios', label: 'Condomínios', placeholder: 'Condomínios de interesse...' },
      { type: 'textarea', key: 'publico_restricoes', label: 'Restrições', placeholder: 'Restrições de público...' },
    ],
  },
  {
    id: 'acessos',
    title: 'Acessos às Plataformas',
    icon: <Globe className="w-5 h-5" />,
    fields: [
      { type: 'email', key: 'acesso_facebook_email', label: 'Facebook — E-mail', placeholder: 'email@facebook.com' },
      { type: 'password', key: 'acesso_facebook_senha', label: 'Facebook — Senha', placeholder: '••••••••' },
      { type: 'email', key: 'acesso_google_email', label: 'Google — E-mail', placeholder: 'email@google.com' },
      { type: 'password', key: 'acesso_google_senha', label: 'Google — Senha', placeholder: '••••••••' },
      { type: 'email', key: 'acesso_instagram_email', label: 'Instagram — E-mail', placeholder: 'email@instagram.com' },
      { type: 'password', key: 'acesso_instagram_senha', label: 'Instagram — Senha', placeholder: '••••••••' },
    ],
  },
  {
    id: 'dominio',
    title: 'Domínio do Site',
    icon: <Monitor className="w-5 h-5" />,
    fields: [
      { type: 'boolean', key: 'dominio_possui', label: 'Possui domínio?' },
      { type: 'url', key: 'dominio_url', label: 'URL do domínio', placeholder: 'https://www.seusite.com.br' },
      { type: 'text', key: 'dominio_login', label: 'Login', placeholder: 'Usuário de acesso' },
      { type: 'password', key: 'dominio_senha', label: 'Senha', placeholder: '••••••••' },
    ],
  },
  {
    id: 'materiais',
    title: 'Materiais Obrigatórios',
    icon: <Camera className="w-5 h-5" />,
    fields: [
      { type: 'boolean', key: 'mat_fotos_obras', label: 'Fotos das obras' },
      { type: 'boolean', key: 'mat_videos', label: 'Vídeos' },
      { type: 'boolean', key: 'mat_identidade_visual', label: 'Identidade visual' },
      { type: 'boolean', key: 'mat_fotos_lideranca', label: 'Fotos da liderança' },
      { type: 'url', key: 'mat_link_drive', label: 'Link do Drive', placeholder: 'https://drive.google.com/...' },
    ],
  },
  {
    id: 'feedbacks',
    title: 'Feedbacks',
    icon: <MessageSquare className="w-5 h-5" />,
    fields: [
      { type: 'boolean', key: 'feed_prints_elogios', label: 'Prints de elogios' },
      { type: 'boolean', key: 'feed_comentarios', label: 'Comentários' },
      { type: 'boolean', key: 'feed_depoimentos', label: 'Depoimentos' },
      { type: 'boolean', key: 'feed_videos_obra', label: 'Vídeos de obra' },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────
function getFieldKeys(section: SectionDef): (keyof MateriaisData)[] {
  const keys: (keyof MateriaisData)[] = [];
  for (const f of section.fields) {
    if (f.type === 'boolean_with_desc') {
      keys.push(f.keyBool, f.keyDesc);
    } else {
      keys.push(f.key);
    }
  }
  return keys;
}

function isFieldFilled(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().length > 0;
  return false;
}

function countFilled(data: MateriaisData, keys: (keyof MateriaisData)[]): { filled: number; total: number } {
  let filled = 0;
  for (const k of keys) {
    if (isFieldFilled(data[k])) filled++;
  }
  return { filled, total: keys.length };
}

// ── Component ────────────────────────────────────────────────
type Props = { tenantId: string };

export default function MateriaisClienteView({ tenantId }: Props) {
  const [data, setData] = useState<MateriaisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['empresa']));
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch / init ─────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from('crm_client_materiais')
        .select('*')
        .eq('tenant_id', tenantId)
        .limit(1);

      if (cancelled) return;

      const existing = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

      if (existing) {
        setData(existing as MateriaisData);
      } else {
        const newRow: MateriaisData = { ...DEFAULT_DATA, tenant_id: tenantId };
        const { data: inserted, error: insertErr } = await supabase
          .from('crm_client_materiais')
          .insert(newRow)
          .select()
          .single();

        if (!cancelled) {
          if (insertErr) {
            console.error('Erro ao criar registro:', insertErr);
            setData(newRow);
          } else {
            setData(inserted as MateriaisData);
          }
        }
      }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  // ── Save (debounced) ─────
  const persistData = useCallback(async (updated: MateriaisData) => {
    setSaving(true);
    const { tenant_id, ...rest } = updated;
    const { error } = await supabase
      .from('crm_client_materiais')
      .update(rest)
      .eq('tenant_id', tenantId);

    if (error) console.error('Erro ao salvar:', error);
    setSaving(false);
  }, [tenantId]);

  const scheduleAutoSave = useCallback((updated: MateriaisData) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persistData(updated), 800);
  }, [persistData]);

  // ── Field change handlers ─────
  const handleChange = useCallback((key: keyof MateriaisData, value: string | boolean) => {
    setData(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [key]: value };
      scheduleAutoSave(updated);
      return updated;
    });
  }, [scheduleAutoSave]);

  const handleBlur = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (data) persistData(data);
  }, [data, persistData]);

  // ── Section toggle ─────
  const toggleSection = useCallback((id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const togglePassword = useCallback((key: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // ── Progress ─────
  const allFieldKeys = useMemo(() => SECTIONS.flatMap(getFieldKeys), []);

  const globalProgress = useMemo(() => {
    if (!data) return 0;
    const { filled, total } = countFilled(data, allFieldKeys);
    return total > 0 ? Math.round((filled / total) * 100) : 0;
  }, [data, allFieldKeys]);

  const sectionProgress = useMemo(() => {
    if (!data) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const s of SECTIONS) {
      const keys = getFieldKeys(s);
      const { filled, total } = countFilled(data, keys);
      m.set(s.id, total > 0 ? Math.round((filled / total) * 100) : 0);
    }
    return m;
  }, [data]);

  // ── CSS helpers ─────
  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00FF88] transition-colors';

  // ── Loading state ─────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-[#00FF88] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-white/40">
        <p>Erro ao carregar materiais. Tente novamente.</p>
      </div>
    );
  }

  // ── Render field ─────
  const renderField = (field: FieldDef) => {
    if (field.type === 'boolean_with_desc') {
      const boolVal = data[field.keyBool] as boolean;
      return (
        <div key={String(field.keyBool)} className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-white/70">{field.label}</label>
            <button
              type="button"
              onClick={() => handleChange(field.keyBool, !boolVal)}
              className={`relative w-11 h-6 rounded-full transition-colors ${boolVal ? 'bg-[#00FF88]' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${boolVal ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <AnimatePresence>
            {boolVal && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <textarea
                  className={inputCls + ' resize-none'}
                  rows={2}
                  value={data[field.keyDesc] as string}
                  onChange={e => handleChange(field.keyDesc, e.target.value)}
                  onBlur={handleBlur}
                  placeholder={field.descPlaceholder ?? ''}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    if (field.type === 'boolean') {
      const boolVal = data[field.key] as boolean;
      return (
        <div key={String(field.key)} className="flex items-center justify-between py-1">
          <label className="text-sm text-white/70">{field.label}</label>
          <button
            type="button"
            onClick={() => handleChange(field.key, !boolVal)}
            className={`relative w-11 h-6 rounded-full transition-colors ${boolVal ? 'bg-[#00FF88]' : 'bg-white/10'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${boolVal ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={String(field.key)}>
          <label className="block text-xs text-white/40 mb-1">{field.label}</label>
          <textarea
            className={inputCls + ' resize-none'}
            rows={3}
            value={data[field.key] as string}
            onChange={e => handleChange(field.key, e.target.value)}
            onBlur={handleBlur}
            placeholder={field.placeholder ?? ''}
          />
        </div>
      );
    }

    if (field.type === 'password') {
      const isVisible = visiblePasswords.has(String(field.key));
      return (
        <div key={String(field.key)}>
          <label className="block text-xs text-white/40 mb-1">{field.label}</label>
          <div className="relative">
            <input
              type={isVisible ? 'text' : 'password'}
              className={inputCls + ' pr-10'}
              value={data[field.key] as string}
              onChange={e => handleChange(field.key, e.target.value)}
              onBlur={handleBlur}
              placeholder={field.placeholder ?? ''}
            />
            <button
              type="button"
              onClick={() => togglePassword(String(field.key))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      );
    }

    // text, email, tel, url, date
    return (
      <div key={String(field.key)}>
        <label className="block text-xs text-white/40 mb-1">{field.label}</label>
        <input
          type={field.type}
          className={inputCls}
          value={data[field.key] as string}
          onChange={e => handleChange(field.key, e.target.value)}
          onBlur={handleBlur}
          placeholder={field.placeholder ?? ''}
        />
      </div>
    );
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Materiais do Cliente</h1>
        <p className="text-sm text-white/40 mt-1">Preencha as informações abaixo para o onboarding.</p>
      </div>

      {/* Global progress */}
      <div className="bg-[#0d1117]/80 border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/60">Progresso geral</span>
            {saving && <Loader2 className="w-3.5 h-3.5 text-[#00FF88] animate-spin" />}
          </div>
          <span className="text-lg font-bold text-[#00FF88]">{globalProgress}%</span>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#00FF88] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${globalProgress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {SECTIONS.map((section, sIdx) => {
          const isOpen = openSections.has(section.id);
          const pct = sectionProgress.get(section.id) ?? 0;

          return (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sIdx * 0.05 }}
              className="bg-[#0d1117]/80 border border-white/10 rounded-2xl overflow-hidden"
            >
              {/* Section header */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/3 transition-colors"
              >
                <span className={`${pct === 100 ? 'text-[#00FF88]' : 'text-white/40'}`}>
                  {pct === 100 ? <Check className="w-5 h-5" /> : section.icon}
                </span>
                <span className="flex-1 text-left text-sm font-medium text-white">{section.title}</span>
                <span className={`text-xs font-bold ${pct === 100 ? 'text-[#00FF88]' : 'text-white/30'}`}>{pct}%</span>
                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#00FF88] rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Section body */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
                      {section.fields.map(renderField)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Prazo de envio */}
      <div className="bg-[#0d1117]/80 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <Calendar className="w-5 h-5 text-white/40" />
          <span className="text-sm font-medium text-white">Prazo de Envio</span>
        </div>
        <input
          type="date"
          className={inputCls}
          value={data.prazo_envio}
          onChange={e => handleChange('prazo_envio', e.target.value)}
          onBlur={handleBlur}
        />
      </div>
    </div>
  );
}
