import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  FileText, ExternalLink, FolderOpen, Video, Link2, Image,
  File, Search,
} from 'lucide-react';
import { supabase } from './lib/supabase';

// ── Types ────────────────────────────────────────────────────
type Documento = {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  tipo_arquivo: string | null;
  arquivo_url: string;
  created_at: string;
};

// ── Helpers ──────────────────────────────────────────────────
const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="w-6 h-6" />,
  video: <Video className="w-6 h-6" />,
  link: <Link2 className="w-6 h-6" />,
  imagem: <Image className="w-6 h-6" />,
  image: <Image className="w-6 h-6" />,
};

const getFileIcon = (tipo: string | null) => {
  if (!tipo) return <File className="w-6 h-6" />;
  const key = tipo.toLowerCase();
  return FILE_TYPE_ICONS[key] ?? <File className="w-6 h-6" />;
};

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: 'bg-red-500/15 text-red-400',
  video: 'bg-purple-500/15 text-purple-400',
  link: 'bg-blue-500/15 text-blue-400',
  imagem: 'bg-amber-500/15 text-amber-400',
  image: 'bg-amber-500/15 text-amber-400',
};

const getFileColor = (tipo: string | null) => {
  if (!tipo) return 'bg-white/10 text-white/50';
  return FILE_TYPE_COLORS[tipo.toLowerCase()] ?? 'bg-white/10 text-white/50';
};

// ── Props ────────────────────────────────────────────────────
type Props = {
  tenantId: string;
};

export default function DocumentosClienteView({ tenantId }: Props) {
  const [tenantDocs, setTenantDocs] = useState<Documento[]>([]);
  const [globalDocs, setGlobalDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ── Load data ──────
  useEffect(() => {
    setLoading(true);

    const fetchTenant = supabase
      .from('crm_client_documentos')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    const fetchGlobal = supabase
      .from('crm_documentos_globais')
      .select('*')
      .order('created_at', { ascending: false });

    Promise.all([fetchTenant, fetchGlobal])
      .then(([tRes, gRes]) => {
        const tData = Array.isArray(tRes.data) ? tRes.data : tRes.data ? [tRes.data] : [];
        const gData = Array.isArray(gRes.data) ? gRes.data : gRes.data ? [gRes.data] : [];
        setTenantDocs(tData);
        setGlobalDocs(gData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tenantId]);

  // ── Filter ──────
  const filterDocs = (docs: Documento[]) => {
    if (!search.trim()) return docs;
    const q = search.toLowerCase();
    return docs.filter(
      d =>
        d.titulo.toLowerCase().includes(q) ||
        d.descricao?.toLowerCase().includes(q) ||
        d.categoria?.toLowerCase().includes(q)
    );
  };

  const filteredTenant = filterDocs(tenantDocs);
  const filteredGlobal = filterDocs(globalDocs);
  const hasAny = tenantDocs.length > 0 || globalDocs.length > 0;
  const hasFiltered = filteredTenant.length > 0 || filteredGlobal.length > 0;

  // ── Loading ──────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Empty state ──────
  if (!hasAny) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/40 px-4">
        <FolderOpen className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-lg font-medium mb-1">Nenhum documento disponível</p>
        <p className="text-sm text-white/25">
          Quando a equipe M2 Black adicionar documentos ao seu projeto, eles aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Documentos</h1>
          <p className="text-sm text-white/40 mt-1">
            Acesse os documentos e materiais do seu projeto.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar documento..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-primary transition-colors"
          />
        </div>
      </div>

      {!hasFiltered && search.trim() && (
        <div className="text-center py-12 text-white/30">
          <Search className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum documento encontrado para "{search}"</p>
        </div>
      )}

      {/* Tenant-specific docs */}
      {filteredTenant.length > 0 && (
        <Section title="Documentos do seu projeto" docs={filteredTenant} />
      )}

      {/* Global docs */}
      {filteredGlobal.length > 0 && (
        <Section title="Biblioteca M2 Black" docs={filteredGlobal} />
      )}
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────
function Section({ title, docs }: { title: string; docs: Documento[] }) {
  // Group by categoria
  const categories = new Map<string, Documento[]>();
  docs.forEach(doc => {
    const cat = doc.categoria || 'Geral';
    const list = categories.get(cat) ?? [];
    list.push(doc);
    categories.set(cat, list);
  });

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider">
        {title}
      </h2>

      {Array.from(categories.entries()).map(([cat, catDocs]) => (
        <div key={cat} className="space-y-3">
          {categories.size > 1 && (
            <h3 className="text-xs font-medium text-brand-primary/70 pl-1">{cat}</h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {catDocs.map((doc, idx) => (
              <DocumentCard key={doc.id} doc={doc} index={idx} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── DocumentCard ─────────────────────────────────────────────
function DocumentCard({ doc, index }: { doc: Documento; index: number; key?: React.Key }) {
  return (
    <motion.a
      href={doc.arquivo_url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group bg-[#0d1117]/80 border border-white/10 rounded-2xl p-5 flex items-start gap-4 hover:border-brand-primary/40 hover:bg-white/[0.03] transition-all cursor-pointer"
    >
      {/* Icon */}
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${getFileColor(doc.tipo_arquivo)}`}
      >
        {getFileIcon(doc.tipo_arquivo)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-white group-hover:text-brand-primary transition-colors truncate">
            {doc.titulo}
          </h3>
          <ExternalLink className="w-4 h-4 text-white/20 group-hover:text-brand-primary/60 flex-shrink-0 mt-0.5 transition-colors" />
        </div>
        {doc.descricao && (
          <p className="text-xs text-white/40 mt-1 line-clamp-2">{doc.descricao}</p>
        )}
        {doc.tipo_arquivo && (
          <span className="inline-block text-[10px] text-white/25 uppercase tracking-wide mt-2">
            {doc.tipo_arquivo}
          </span>
        )}
      </div>
    </motion.a>
  );
}
