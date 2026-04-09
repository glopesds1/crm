import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Play, CheckCircle2, X, BookOpen, Video, Clock, ChevronRight,
  Edit3, Trash2, GripVertical, ArrowLeft, Save, ExternalLink,
} from 'lucide-react';
import type { EducacaoModulo, EducacaoAula, EducacaoProgresso } from './types';
import {
  getModulos, createModulo, updateModulo, deleteModulo,
  getAllAulas, getAulasByModulo, createAula, updateAula, deleteAula,
  getProgressoByUser, upsertProgresso,
} from './lib/database';

// ── Helpers ─────────────────────────────────────────────────
const getYouTubeId = (url: string): string | null => {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|.*[?&]v=))([^&#?]+)/);
  return m?.[1] ?? null;
};

const getVimeoId = (url: string): string | null => {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m?.[1] ?? null;
};

const getEmbedUrl = (url: string): string => {
  const ytId = getYouTubeId(url);
  if (ytId) return `https://www.youtube.com/embed/${ytId}`;
  const vimeoId = getVimeoId(url);
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
  return url;
};

// ── Props ───────────────────────────────────────────────────
type Props = {
  userEmail: string;
  isAdmin: boolean;
};

export default function EducacaoView({ userEmail, isAdmin }: Props) {
  const [modulos, setModulos] = useState<EducacaoModulo[]>([]);
  const [aulas, setAulas] = useState<EducacaoAula[]>([]);
  const [progresso, setProgresso] = useState<EducacaoProgresso[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation
  const [selectedModulo, setSelectedModulo] = useState<EducacaoModulo | null>(null);
  const [selectedAula, setSelectedAula] = useState<EducacaoAula | null>(null);

  // Admin modals
  const [showModuloForm, setShowModuloForm] = useState(false);
  const [editingModulo, setEditingModulo] = useState<EducacaoModulo | null>(null);
  const [showAulaForm, setShowAulaForm] = useState(false);
  const [editingAula, setEditingAula] = useState<EducacaoAula | null>(null);

  // ── Load data ─────
  useEffect(() => {
    setLoading(true);
    Promise.all([getModulos(), getAllAulas(), getProgressoByUser(userEmail)])
      .then(([m, a, p]) => { setModulos(m); setAulas(a); setProgresso(p); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userEmail]);

  // ── Computed ─────
  const aulasByModulo = useMemo(() => {
    const m = new Map<string, EducacaoAula[]>();
    modulos.forEach(mod => m.set(mod.id, []));
    aulas.forEach(a => { m.get(a.moduloId)?.push(a); });
    return m;
  }, [modulos, aulas]);

  const completedSet = useMemo(() => new Set(progresso.filter(p => p.concluida).map(p => p.aulaId)), [progresso]);

  const getModuloProgress = (moduloId: string) => {
    const moduloAulas = aulasByModulo.get(moduloId) ?? [];
    if (moduloAulas.length === 0) return { total: 0, completed: 0, pct: 0 };
    const completed = moduloAulas.filter(a => completedSet.has(a.id)).length;
    return { total: moduloAulas.length, completed, pct: Math.round((completed / moduloAulas.length) * 100) };
  };

  const totalProgress = useMemo(() => {
    if (aulas.length === 0) return 0;
    return Math.round((progresso.filter(p => p.concluida).length / aulas.length) * 100);
  }, [aulas, progresso]);

  // ── Handlers ─────
  const handleToggleComplete = async (aulaId: string) => {
    const isCompleted = completedSet.has(aulaId);
    await upsertProgresso(aulaId, userEmail, !isCompleted);
    setProgresso(prev => {
      const existing = prev.find(p => p.aulaId === aulaId);
      if (existing) return prev.map(p => p.aulaId === aulaId ? { ...p, concluida: !isCompleted } : p);
      return [...prev, { id: `temp-${Date.now()}`, aulaId, userEmail, concluida: true, atualizadoEm: new Date().toISOString() }];
    });
  };

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-primary transition-colors';

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  // ══════════════════════════════════════════════════════════
  // VIEW 3: Watching a lesson
  // ══════════════════════════════════════════════════════════
  if (selectedAula && selectedModulo) {
    const moduloAulas = aulasByModulo.get(selectedModulo.id) ?? [];
    const currentIdx = moduloAulas.findIndex(a => a.id === selectedAula.id);
    const nextAula = moduloAulas[currentIdx + 1] ?? null;
    const isCompleted = completedSet.has(selectedAula.id);

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
          <button onClick={() => setSelectedAula(null)} className="p-2 rounded-lg hover:bg-white/5"><ArrowLeft className="w-5 h-5 text-white/60" /></button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-brand-primary font-medium">{selectedModulo.titulo}</p>
            <h1 className="text-lg font-bold text-white truncate">{selectedAula.titulo}</h1>
          </div>
          <button onClick={() => handleToggleComplete(selectedAula.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${isCompleted ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>
            <CheckCircle2 className="w-4 h-4" /> {isCompleted ? 'Concluída' : 'Marcar como concluída'}
          </button>
        </div>

        {/* Video + sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Video player */}
          <div className="flex-1 flex flex-col">
            <div className="aspect-video bg-black w-full">
              <iframe src={getEmbedUrl(selectedAula.videoUrl)} className="w-full h-full" allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
            </div>
            {selectedAula.descricao && (
              <div className="p-6"><p className="text-sm text-white/60 leading-relaxed">{selectedAula.descricao}</p></div>
            )}
          </div>

          {/* Lesson list sidebar */}
          <div className="w-80 border-l border-white/5 overflow-y-auto">
            <div className="px-4 py-3 border-b border-white/5">
              <h3 className="text-xs font-bold text-white/40 uppercase">Aulas do módulo</h3>
            </div>
            {moduloAulas.map((aula, idx) => (
              <button key={aula.id} onClick={() => setSelectedAula(aula)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/5 transition-colors ${aula.id === selectedAula.id ? 'bg-brand-primary/10' : 'hover:bg-white/3'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${completedSet.has(aula.id) ? 'bg-green-500 text-black' : aula.id === selectedAula.id ? 'bg-brand-primary text-black' : 'bg-white/10 text-white/40'}`}>
                  {completedSet.has(aula.id) ? <CheckCircle2 size={14} /> : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${aula.id === selectedAula.id ? 'text-white font-medium' : 'text-white/60'}`}>{aula.titulo}</p>
                  {aula.duracao && <p className="text-[10px] text-white/30">{aula.duracao}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Next lesson bar */}
        {nextAula && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/5 bg-white/2">
            <span className="text-xs text-white/40">Próxima aula</span>
            <button onClick={() => setSelectedAula(nextAula)} className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-primary/20">
              {nextAula.titulo} <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW 2: Module lessons list
  // ══════════════════════════════════════════════════════════
  if (selectedModulo) {
    const moduloAulas = aulasByModulo.get(selectedModulo.id) ?? [];
    const progress = getModuloProgress(selectedModulo.id);

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedModulo(null)} className="p-2 rounded-lg hover:bg-white/5"><ArrowLeft className="w-5 h-5 text-white/60" /></button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">{selectedModulo.titulo}</h1>
            {selectedModulo.descricao && <p className="text-sm text-white/50 mt-1">{selectedModulo.descricao}</p>}
          </div>
          {isAdmin && (
            <button onClick={() => { setEditingAula(null); setShowAulaForm(true); }} className="flex items-center gap-2 bg-brand-primary text-black font-bold rounded-xl px-4 py-2 text-sm hover:brightness-110">
              <Plus className="w-4 h-4" /> Nova Aula
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="bg-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/40">{progress.completed}/{progress.total} aulas concluídas</span>
            <span className="text-xs font-bold text-brand-primary">{progress.pct}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-brand-primary rounded-full transition-all duration-500" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>

        {/* Lessons */}
        <div className="space-y-2">
          {moduloAulas.map((aula, idx) => {
            const isComplete = completedSet.has(aula.id);
            return (
              <motion.div key={aula.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                className="bg-[#0d1117]/80 border border-white/10 rounded-xl p-4 flex items-center gap-4 hover:border-white/20 transition-colors group">
                <button onClick={() => handleToggleComplete(aula.id)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isComplete ? 'bg-green-500 text-black' : 'bg-white/10 text-white/40 hover:bg-white/20'}`}>
                  {isComplete ? <CheckCircle2 size={16} /> : <span className="text-xs font-bold">{idx + 1}</span>}
                </button>

                <button onClick={() => setSelectedAula(aula)} className="flex-1 text-left min-w-0">
                  <p className={`text-sm font-medium ${isComplete ? 'text-white/40 line-through' : 'text-white'}`}>{aula.titulo}</p>
                  {aula.descricao && <p className="text-xs text-white/30 mt-0.5 truncate">{aula.descricao}</p>}
                  {aula.duracao && <span className="text-[10px] text-white/20 flex items-center gap-1 mt-1"><Clock size={10} />{aula.duracao}</span>}
                </button>

                <button onClick={() => setSelectedAula(aula)} className="p-2.5 rounded-xl bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 transition-colors opacity-0 group-hover:opacity-100">
                  <Play size={16} />
                </button>

                {isAdmin && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                    <button onClick={() => { setEditingAula(aula); setShowAulaForm(true); }} className="p-1.5 rounded-lg hover:bg-white/10 text-white/30"><Edit3 size={14} /></button>
                    <button onClick={async () => { if (confirm('Excluir aula?')) { await deleteAula(aula.id); setAulas(prev => prev.filter(a => a.id !== aula.id)); } }} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                )}
              </motion.div>
            );
          })}
          {moduloAulas.length === 0 && <div className="text-center py-16 text-white/30"><Video className="w-10 h-10 mx-auto mb-2 opacity-40" /><p className="text-sm">Nenhuma aula neste módulo</p></div>}
        </div>

        {/* Aula Form Modal */}
        <AnimatePresence>
          {showAulaForm && (
            <AulaFormModal moduloId={selectedModulo.id} aula={editingAula} nextOrdem={(moduloAulas.length + 1)}
              onClose={() => { setShowAulaForm(false); setEditingAula(null); }}
              onSave={async (data) => {
                if (editingAula) { const updated = await updateAula({ ...editingAula, ...data }); setAulas(prev => prev.map(a => a.id === updated.id ? updated : a)); }
                else { const created = await createAula({ ...data, moduloId: selectedModulo.id, ativo: true }); setAulas(prev => [...prev, created]); }
                setShowAulaForm(false); setEditingAula(null);
              }} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW 1: Module grid
  // ══════════════════════════════════════════════════════════
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Educação</h1>
          <p className="text-sm text-white/40 mt-1">Acesse as vídeo-aulas e acompanhe seu progresso.</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditingModulo(null); setShowModuloForm(true); }} className="flex items-center gap-2 bg-brand-primary text-black font-bold rounded-xl px-4 py-2 text-sm hover:brightness-110">
            <Plus className="w-4 h-4" /> Novo Módulo
          </button>
        )}
      </div>

      {/* Total progress */}
      {aulas.length > 0 && (
        <div className="bg-[#0d1117]/80 border border-white/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60">Progresso geral</span>
            <span className="text-lg font-bold text-brand-primary">{totalProgress}%</span>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-brand-primary rounded-full transition-all duration-500" style={{ width: `${totalProgress}%` }} />
          </div>
          <p className="text-xs text-white/30 mt-2">{progresso.filter(p => p.concluida).length} de {aulas.length} aulas concluídas</p>
        </div>
      )}

      {/* Module grid */}
      {modulos.length === 0 ? (
        <div className="text-center py-20 text-white/40">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg">Nenhum módulo disponível</p>
          {isAdmin && <p className="text-sm mt-1">Crie o primeiro módulo para começar.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {modulos.map((modulo, idx) => {
            const progress = getModuloProgress(modulo.id);
            const moduloAulas = aulasByModulo.get(modulo.id) ?? [];
            return (
              <motion.div key={modulo.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                className="bg-[#0d1117]/80 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-colors group cursor-pointer"
                onClick={() => setSelectedModulo(modulo)}>
                {/* Thumbnail */}
                <div className="aspect-video bg-gradient-to-br from-brand-primary/20 to-purple-500/20 flex items-center justify-center relative">
                  {modulo.thumbnailUrl ? (
                    <img src={modulo.thumbnailUrl} alt={modulo.titulo} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="w-12 h-12 text-white/20" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Play className="w-12 h-12 text-white" />
                  </div>
                  {isAdmin && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={e => { e.stopPropagation(); setEditingModulo(modulo); setShowModuloForm(true); }} className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white/70"><Edit3 size={14} /></button>
                      <button onClick={async e => { e.stopPropagation(); if (confirm('Excluir módulo e todas as aulas?')) { await deleteModulo(modulo.id); setModulos(prev => prev.filter(m => m.id !== modulo.id)); setAulas(prev => prev.filter(a => a.moduloId !== modulo.id)); } }} className="p-1.5 rounded-lg bg-black/60 hover:bg-red-500/80 text-white/70 hover:text-red-300"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="text-base font-bold text-white mb-1">{modulo.titulo}</h3>
                  {modulo.descricao && <p className="text-xs text-white/40 mb-3 line-clamp-2">{modulo.descricao}</p>}
                  <div className="flex items-center justify-between text-xs text-white/30 mb-2">
                    <span>{moduloAulas.length} aulas</span>
                    <span className="text-brand-primary font-bold">{progress.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-primary rounded-full transition-all" style={{ width: `${progress.pct}%` }} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modulo Form Modal */}
      <AnimatePresence>
        {showModuloForm && (
          <ModuloFormModal modulo={editingModulo} nextOrdem={modulos.length + 1}
            onClose={() => { setShowModuloForm(false); setEditingModulo(null); }}
            onSave={async (data) => {
              if (editingModulo) { const updated = await updateModulo({ ...editingModulo, ...data }); setModulos(prev => prev.map(m => m.id === updated.id ? updated : m)); }
              else { const created = await createModulo({ ...data, ativo: true }); setModulos(prev => [...prev, created]); }
              setShowModuloForm(false); setEditingModulo(null);
            }} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ModuloFormModal
// ══════════════════════════════════════════════════════════════
function ModuloFormModal({ modulo, nextOrdem, onClose, onSave }: { modulo: EducacaoModulo | null; nextOrdem: number; onClose: () => void; onSave: (data: Pick<EducacaoModulo, 'titulo' | 'descricao' | 'ordem' | 'thumbnailUrl' | 'ativo'>) => Promise<void>; }) {
  const [titulo, setTitulo] = useState(modulo?.titulo ?? '');
  const [descricao, setDescricao] = useState(modulo?.descricao ?? '');
  const [thumbnailUrl, setThumbnailUrl] = useState(modulo?.thumbnailUrl ?? '');
  const [saving, setSaving] = useState(false);
  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-primary';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-lg font-bold text-white">{modulo ? 'Editar Módulo' : 'Novo Módulo'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-5 h-5 text-white/50" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div><label className="block text-xs text-white/40 mb-1">Título *</label><input className={inputCls} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Onboarding" /></div>
          <div><label className="block text-xs text-white/40 mb-1">Descrição</label><textarea className={inputCls + ' resize-none'} rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição do módulo..." /></div>
          <div><label className="block text-xs text-white/40 mb-1">URL da thumbnail (opcional)</label><input className={inputCls} value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)} placeholder="https://..." /></div>
          <button disabled={saving || !titulo.trim()} onClick={async () => { setSaving(true); try { await onSave({ titulo, descricao, thumbnailUrl, ordem: modulo?.ordem ?? nextOrdem, ativo: true }); } finally { setSaving(false); } }}
            className="w-full bg-brand-primary text-black font-bold rounded-xl py-2.5 text-sm hover:brightness-110 disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════
// AulaFormModal
// ══════════════════════════════════════════════════════════════
function AulaFormModal({ moduloId, aula, nextOrdem, onClose, onSave }: { moduloId: string; aula: EducacaoAula | null; nextOrdem: number; onClose: () => void; onSave: (data: Pick<EducacaoAula, 'titulo' | 'descricao' | 'videoUrl' | 'duracao' | 'ordem'>) => Promise<void>; }) {
  const [titulo, setTitulo] = useState(aula?.titulo ?? '');
  const [descricao, setDescricao] = useState(aula?.descricao ?? '');
  const [videoUrl, setVideoUrl] = useState(aula?.videoUrl ?? '');
  const [duracao, setDuracao] = useState(aula?.duracao ?? '');
  const [saving, setSaving] = useState(false);
  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-primary';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-lg font-bold text-white">{aula ? 'Editar Aula' : 'Nova Aula'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-5 h-5 text-white/50" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div><label className="block text-xs text-white/40 mb-1">Título *</label><input className={inputCls} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Como usar o CRM" /></div>
          <div><label className="block text-xs text-white/40 mb-1">URL do vídeo *</label><input className={inputCls} value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." /></div>
          {videoUrl && getYouTubeId(videoUrl) && (
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              <iframe src={getEmbedUrl(videoUrl)} className="w-full h-full" allowFullScreen />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs text-white/40 mb-1">Duração</label><input className={inputCls} value={duracao} onChange={e => setDuracao(e.target.value)} placeholder="Ex: 12 min" /></div>
            <div><label className="block text-xs text-white/40 mb-1">Descrição</label><input className={inputCls} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Sobre a aula" /></div>
          </div>
          <button disabled={saving || !titulo.trim() || !videoUrl.trim()} onClick={async () => { setSaving(true); try { await onSave({ titulo, descricao, videoUrl, duracao, ordem: aula?.ordem ?? nextOrdem }); } finally { setSaving(false); } }}
            className="w-full bg-brand-primary text-black font-bold rounded-xl py-2.5 text-sm hover:brightness-110 disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
