import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Loader2 } from 'lucide-react';
import type { CRMLead, TeamMember } from '../../shared/types';

// ── New Lead Modal ─────────────────────────────────────────────
export function NewLeadModal({ onClose, onSave, userSession, teamMembers }: {
  onClose: () => void; onSave: (lead: Partial<CRMLead>) => Promise<void>; userSession: any; teamMembers: TeamMember[];
}) {
  const [form, setForm] = useState({ nome: '', telefone: '', empresa: '', faturamento: '', area: '', sdr_responsavel: '' });
  const [origem, setOrigem] = useState('');
  const [origemCustom, setOrigemCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const origemFinal = origem === 'Outro' ? origemCustom.trim() : origem;
  const handleSave = async () => {
    if (!form.nome.trim() || !origemFinal) return;
    setSaving(true);
    await onSave({ ...form, etapa: 'base', status: 'ativo', origem: origemFinal, anuncio: origemFinal });
    setSaving(false);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-bg-card border border-white/10 rounded-2xl w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-base font-bold text-white">Novo Lead</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          {[
            { key: 'nome',        label: 'Nome *',           placeholder: 'Nome do lead' },
            { key: 'telefone',    label: 'Telefone',         placeholder: '(xx) xxxxx-xxxx' },
            { key: 'empresa',     label: 'Empresa',          placeholder: 'Nome da empresa' },
            { key: 'area',        label: 'Área de Atuação',  placeholder: 'Ex: Construção Civil' },
            { key: 'faturamento', label: 'Faturamento',      placeholder: 'Ex: R$ 50.000/mês' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">{f.label}</label>
              <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-brand-primary"
              />
            </div>
          ))}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Origem *</label>
            <select value={origem} onChange={e => { setOrigem(e.target.value); if (e.target.value !== 'Outro') setOrigemCustom(''); }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
            >
              <option value="" className="bg-bg-main">Selecione a origem</option>
              {['NT', 'SS', 'Indicação', 'SE', 'Site', 'Evento', 'Prospecção Ativa', 'Outro'].map(o => (
                <option key={o} value={o} className="bg-bg-main">{o}</option>
              ))}
            </select>
          </div>
          {origem === 'Outro' && (
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">Origem (personalizada) *</label>
              <input value={origemCustom} onChange={e => setOrigemCustom(e.target.value)}
                placeholder="Digite a origem"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-brand-primary"
              />
            </div>
          )}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-600 block mb-1">SDR Responsável</label>
            <select value={form.sdr_responsavel} onChange={e => setForm(p => ({ ...p, sdr_responsavel: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary appearance-none"
            >
              <option value="" className="bg-bg-main">Sem responsável</option>
              {teamMembers
                .filter(m => ['admin', 'comercial'].includes((m.role ?? '').toLowerCase()))
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                .map(m => <option key={m.id} value={m.name} className="bg-bg-main">{m.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-400 hover:text-white transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.nome.trim() || !origemFinal}
              className="flex-1 px-4 py-2 rounded-xl bg-brand-primary text-black text-sm font-bold hover:bg-brand-primary/80 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />} Adicionar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
