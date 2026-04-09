import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Users, Briefcase, Phone } from 'lucide-react';  // ← Adicione Phone aqui
import { motion, AnimatePresence } from 'motion/react';
import {
  getAllPartners,
  savePartner,
  deletePartner,
  StoredPartner,
} from '../lib/mvpStorage';
import { PartnersView } from './components/PartnersView';
import { CallActivityButton } from './components/CallActivityButton';
import { LeadScoreModal, calculateLeadScore, getScoreBadgeIcon } from './components/LeadScoreModal';
import { saveLeadScore, getLeadScore } from './lib/mvpStorage';
export const App: React.FC = () => {
  const [partners, setPartners] = useState<StoredPartner[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<StoredPartner, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    email: '',
    phone: '',
    status: 'negociacao',
    works: [],
    birthDate: '',
    importantDates: [],
    notes: '',
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'crm' | 'partners' | 'playbooks' | 'reports' | 'team' | 'settings'>('dashboard');
  useEffect(() => {
    loadPartners();
  }, []);
  const loadPartners = () => {
    const stored = getAllPartners();
    setPartners(stored);
  };
  const handleSave = () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      alert('Nome e telefone são obrigatórios');
      return;
    }
    savePartner(formData, editingId || undefined);
    loadPartners();
    resetForm();
  };
  const handleDelete = (id: string) => {
    if (confirm('Tem certeza?')) {
      deletePartner(id);
      loadPartners();
    }
  };
  const handleEdit = (partner: StoredPartner) => {
    setEditingId(partner.id);
    setFormData({
      name: partner.name,
      email: partner.email,
      phone: partner.phone,
      status: partner.status,
      works: partner.works,
      birthDate: partner.birthDate || '',
      importantDates: partner.importantDates || [],
      notes: partner.notes || '',
    });
    setShowForm(true);
  };
  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      status: 'negociacao',
      works: [],
      birthDate: '',
      importantDates: [],
      notes: '',
    });
    setEditingId(null);
    setShowForm(false);
  };
  const negociacao = partners.filter(p => p.status === 'negociacao');
  const fechado = partners.filter(p => p.status === 'fechado');
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Users size={32} className="text-brand-primary" /> CRM de Parceiros
          </h1>
          <p className="text-gray-400 text-sm mt-1">Gestão de relacionamento com parceiros</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-lg bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary border border-brand-primary/50 flex items-center gap-2 transition-all font-bold"
        >
          <Plus size={18} /> Novo Parceiro
        </button>
      </div>
      {/* Kanban */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coluna Negociação */}
        <div className="bg-white/5 rounded-xl p-6 border border-yellow-500/20">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">🔄</span> Em Negociação ({negociacao.length})
          </h2>
          <div className="space-y-3">
            {negociacao.map(partner => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
            {negociacao.length === 0 && (
              <p className="text-gray-400 text-sm py-4">Nenhum parceiro em negociação</p>
            )}
          </div>
        </div>
        {/* Coluna Fechado */}
        <div className="bg-white/5 rounded-xl p-6 border border-green-500/20">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">✅</span> Fechado ({fechado.length})
          </h2>
          <div className="space-y-3">
            {fechado.map(partner => (
              <PartnerCard
                key={partner.id}
                partner={partner}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
            {fechado.length === 0 && (
              <p className="text-gray-400 text-sm py-4">Nenhum parceiro fechado</p>
            )}
          </div>
        </div>
      </div>
      {/* Modal Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={resetForm}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="glass-card w-full max-w-md p-8 rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-white mb-6">
                {editingId ? 'Editar Parceiro' : 'Novo Parceiro'}
              </h2>
              <div className="space-y-4 mb-6">
                <input
                  type="text"
                  placeholder="Nome"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary/50"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary/50"
                />
                <input
                  type="tel"
                  placeholder="Telefone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary/50"
                />
                <input
                  type="date"
                  placeholder="Data de Nascimento"
                  value={formData.birthDate || ''}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary/50"
                />
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'negociacao' | 'fechado' })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-brand-primary/50"
                >
                  <option value="negociacao">Em Negociação</option>
                  <option value="fechado">Fechado</option>
                </select>
                <textarea
                  placeholder="Observações"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary/50 resize-none h-20"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={resetForm}
                  className="px-6 py-2 rounded-lg hover:bg-white/10 transition-colors text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-2 rounded-lg bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary border border-brand-primary/50 transition-all font-bold"
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Sidebar */}
      <div className="fixed inset-0 z-40 flex flex-col md:static md:z-auto md:w-64 md:flex-none">
        <div className="flex flex-col items-start justify-between md:static md:z-auto md:w-64 md:flex-none">
          <div className="flex flex-col items-start justify-between p-4 md:static md:z-auto md:w-64 md:flex-none">
            <div className="flex flex-col items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">CRM de Parceiros</h2>
                <p className="text-gray-400 text-sm mt-1">Gestão de relacionamento com parceiros</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setShowForm(true)}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                >
                  <Plus size={14} /> Novo Parceiro
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                >
                  <Trash2 size={14} /> Limpar
                </button>
              </div>
            </div>
            <div className="flex flex-col items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">CRM de Parceiros</h2>
                <p className="text-gray-400 text-sm mt-1">Gestão de relacionamento com parceiros</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setShowForm(true)}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                >
                  <Plus size={14} /> Novo Parceiro
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                >
                  <Trash2 size={14} /> Limpar
                </button>
              </div>
            </div>
            <div className="flex flex-col items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">CRM de Parceiros</h2>
                <p className="text-gray-400 text-sm mt-1">Gestão de relacionamento com parceiros</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setShowForm(true)}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                >
                  <Plus size={14} /> Novo Parceiro
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                >
                  <Trash2 size={14} /> Limpar
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start justify-between p-4 md:static md:z-auto md:w-64 md:flex-none">
            <div className="flex flex-col items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">CRM de Parceiros</h2>
                <p className="text-gray-400 text-sm mt-1">Gestão de relacionamento com parceiros</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setShowForm(true)}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                >
                  <Plus size={14} /> Novo Parceiro
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                >
                  <Trash2 size={14} /> Limpar
                </button>
              </div>
            </div>
            <div className="flex flex-col items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">CRM de Parceiros</h2>
                <p className="text-gray-400 text-sm mt-1">Gestão de relacionamento com parceiros</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setShowForm(true)}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                >
                  <Plus size={14} /> Novo Parceiro
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                >
                  <Trash2 size={14} /> Limpar
                </button>
              </div>
            </div>
            <div className="flex flex-col items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">CRM de Parceiros</h2>
                <p className="text-gray-400 text-sm mt-1">Gestão de relacionamento com parceiros</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setShowForm(true)}
                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                >
                  <Plus size={14} /> Novo Parceiro
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                >
                  <Trash2 size={14} /> Limpar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="flex flex-1 flex-col md:static md:z-auto md:w-64 md:flex-none">
        <div className="flex flex-col items-start justify-between p-4 md:static md:z-auto md:w-64 md:flex-none">
          <div className="flex flex-col items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">CRM de Parceiros</h2>
              <p className="text-gray-400 text-sm mt-1">Gestão de relacionamento com parceiros</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setShowForm(true)}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
              >
                <Plus size={14} /> Novo Parceiro
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
              >
                <Trash2 size={14} /> Limpar
              </button>
            </div>
          </div>
          <div className="flex flex-col items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">CRM de Parceiros</h2>
              <p className="text-gray-400 text-sm mt-1">Gestão de relacionamento com parceiros</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setShowForm(true)}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
              >
                <Plus size={14} /> Novo Parceiro
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
              >
                <Trash2 size={14} /> Limpar
              </button>
            </div>
          </div>
          <div className="flex flex-col items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">CRM de Parceiros</h2>
              <p className="text-gray-400 text-sm mt-1">Gestão de relacionamento com parceiros</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setShowForm(true)}
                className="p-1.5 hover:bg-white/10 rounded transition-colors"
              >
                <Plus size={14} /> Novo Parceiro
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
              >
                <Trash2 size={14} /> Limpar
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-gray-400 text-sm">CRM de Parceiros</p>
        </div>
        <div>
          <button
            onClick={() => setActiveTab('dashboard')}
            className="px-4 py-2 rounded-lg bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary border border-brand-primary/50 flex items-center gap-2 transition-all font-bold"
          >
            <Home size={18} /> Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}; const PartnerCard: React.FC<{ partner: StoredPartner; onEdit: (p: StoredPartner) => void; onDelete: (id: string) => void; }> = ({ partner, onEdit, onDelete }) => (
  <motion.div
    layout
    className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-all"
  >
    <div className="flex items-start justify-between mb-2">
      <div>
        <p className="font-bold text-white">{partner.name}</p>
        <p className="text-xs text-gray-400">{partner.email}</p>
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => onEdit(partner)}
          className="p-1.5 hover:bg-white/10 rounded transition-colors"
        >
          <Edit size={14} className="text-gray-400" /> Editar
        </button>
        <button
          onClick={() => onDelete(partner.id)}
          className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
        >
          <Trash2 size={14} className="text-red-400" /> Excluir
        </button>
      </div>
    </div>
    <div className="flex items-center gap-2 text-xs text-gray-300 mt-2">
      <Phone size={12} /> {partner.phone}
    </div>
    {partner.works.length > 0 && (
      <div className="flex items-center gap-2 text-xs text-gray-300 mt-1">
        <Briefcase size={12} /> {partner.works.length} obra(s)
      </div>
    )}
  </motion.div>
);