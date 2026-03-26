import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Plus, Phone, Mail, DollarSign, User, Tag,
  ChevronDown, X, MessageSquare, Clock, Search, Building2,
} from 'lucide-react';
import type {
  CrmClientTenant, CrmClientStage, CrmClientLead,
  CrmClientLeadActivity, Client,
} from './types';
import {
  getAllTenants, getStagesByTenant, getClientLeads,
  createClientLead, updateClientLead, deleteClientLead,
  getLeadActivities, createLeadActivity,
} from './lib/database';

// ── Helpers ─────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR');

const PLAN_COLORS: Record<string, string> = {
  Pro: '#00FF88',
  Lite: '#3B82F6',
  Basic: '#8B5CF6',
};

// ── Props ───────────────────────────────────────────────────

type Props = {
  clients: Client[];
  selectedTenantId?: string | null;
  onBack?: () => void;
};

// ── Main Component ──────────────────────────────────────────

export default function ClientCRMView({ clients, selectedTenantId, onBack }: Props) {
  const [tenants, setTenants] = useState<CrmClientTenant[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(selectedTenantId ?? null);
  const [stages, setStages] = useState<CrmClientStage[]>([]);
  const [leads, setLeads] = useState<CrmClientLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedLead, setSelectedLead] = useState<CrmClientLead | null>(null);
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);

  // ── Load tenants ──────────────────────────────────────────
  useEffect(() => {
    if (!activeTenantId) {
      setLoading(true);
      getAllTenants()
        .then(setTenants)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [activeTenantId]);

  // ── Load stages + leads for active tenant ─────────────────
  useEffect(() => {
    if (!activeTenantId) return;
    setLoading(true);
    Promise.all([
      getStagesByTenant(activeTenantId),
      getClientLeads(activeTenantId),
    ])
      .then(([s, l]) => { setStages(s); setLeads(l); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeTenantId]);

  // ── Client lookup ─────────────────────────────────────────
  const clientMap = useMemo(() => {
    const m = new Map<string, Client>();
    clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  const activeClient = useMemo(() => {
    if (!activeTenantId) return null;
    const t = tenants.find((t) => t.id === activeTenantId);
    return t ? clientMap.get(t.clientId) ?? null : null;
  }, [activeTenantId, tenants, clientMap]);

  // ── Tenant lead counts ────────────────────────────────────
  const tenantLeadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    leads.forEach((l) => {
      counts.set(l.tenantId, (counts.get(l.tenantId) || 0) + 1);
    });
    return counts;
  }, [leads]);

  // ── Filtered leads ────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const q = searchQuery.toLowerCase();
    return leads.filter(
      (l) =>
        l.nome.toLowerCase().includes(q) ||
        l.telefone.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.segmento.toLowerCase().includes(q),
    );
  }, [leads, searchQuery]);

  // ── Leads grouped by stage ────────────────────────────────
  const leadsByStage = useMemo(() => {
    const m = new Map<string, CrmClientLead[]>();
    stages.forEach((s) => m.set(s.id, []));
    filteredLeads.forEach((l) => {
      const arr = m.get(l.stageId);
      if (arr) arr.push(l);
    });
    return m;
  }, [filteredLeads, stages]);

  // ── Handlers ──────────────────────────────────────────────
  const handleOpenTenant = (tenantId: string) => setActiveTenantId(tenantId);

  const handleBackToList = () => {
    setActiveTenantId(null);
    setStages([]);
    setLeads([]);
    setSearchQuery('');
    onBack?.();
  };

  const handleCreateLead = async (data: Omit<CrmClientLead, 'id' | 'criadoEm' | 'atualizadoEm'>) => {
    try {
      const newLead = await createClientLead(data);
      setLeads((prev) => [newLead, ...prev]);
      setShowNewLeadModal(false);
    } catch (err) {
      console.error('Erro ao criar lead:', err);
    }
  };

  const handleUpdateLead = async (lead: CrmClientLead) => {
    try {
      const updated = await updateClientLead(lead);
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setSelectedLead(updated);
    } catch (err) {
      console.error('Erro ao atualizar lead:', err);
    }
  };

  const handleDeleteLead = async (id: string) => {
    try {
      await deleteClientLead(id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setSelectedLead(null);
    } catch (err) {
      console.error('Erro ao excluir lead:', err);
    }
  };

  // ── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── MODE 1: Tenant List ───────────────────────────────────
  if (!activeTenantId) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">CRM dos Clientes</h1>
        </div>

        {tenants.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg">Nenhum CRM ativo</p>
            <p className="text-sm mt-1">Ative o CRM para um cliente na aba de configurações.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tenants.map((tenant) => {
              const client = clientMap.get(tenant.clientId);
              const planColor = client ? PLAN_COLORS[client.plan] ?? '#6B7280' : '#6B7280';
              return (
                <motion.div
                  key={tenant.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#0d1117]/80 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white truncate">
                        {client?.name ?? tenant.slug}
                      </h3>
                      {client && (
                        <span
                          className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold"
                          style={{ backgroundColor: planColor + '20', color: planColor }}
                        >
                          {client.plan}
                        </span>
                      )}
                    </div>
                    <Building2 className="w-5 h-5 text-white/20 flex-shrink-0" />
                  </div>

                  <div className="flex items-center gap-2 text-sm text-white/50 mb-4">
                    <User className="w-4 h-4" />
                    <span>{client?.responsible ?? '—'}</span>
                  </div>

                  <button
                    onClick={() => handleOpenTenant(tenant.id)}
                    className="w-full bg-brand-primary text-black font-bold rounded-xl px-4 py-2 text-sm hover:brightness-110 transition-all"
                  >
                    Abrir CRM
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── MODE 2: Kanban View ───────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-white/5">
        <button
          onClick={handleBackToList}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white/60" />
        </button>

        <h1 className="text-xl font-bold text-white truncate">
          {activeClient?.name ?? 'CRM'}
        </h1>

        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Buscar leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-primary"
          />
        </div>

        <button
          onClick={() => setShowNewLeadModal(true)}
          className="flex items-center gap-2 bg-brand-primary text-black font-bold rounded-xl px-4 py-2 text-sm hover:brightness-110 transition-all"
        >
          <Plus className="w-4 h-4" />
          Novo Lead
        </button>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full min-w-max">
          {stages.map((stage) => {
            const stageLeads = leadsByStage.get(stage.id) ?? [];
            return (
              <div
                key={stage.id}
                className="w-72 bg-[#1a1f2e] rounded-2xl p-3 border border-white/5 flex flex-col"
                style={{ borderTopColor: stage.cor, borderTopWidth: 3 }}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-sm font-semibold text-white">{stage.nome}</h3>
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: stage.cor + '20', color: stage.cor }}
                  >
                    {stageLeads.length}
                  </span>
                </div>

                {/* Lead cards */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {stageLeads.map((lead, idx) => (
                    <React.Fragment key={lead.id}>
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => setSelectedLead(lead)}
                        className="bg-[#161b26] border border-white/8 rounded-xl p-3.5 cursor-pointer hover:border-white/15 transition-colors"
                      >
                        <p className="text-sm font-semibold text-white mb-2 truncate">
                          {lead.nome}
                        </p>

                        {lead.telefone && (
                          <div className="flex items-center gap-1.5 text-xs text-white/50 mb-1">
                            <Phone className="w-3 h-3" />
                            <span className="truncate">{lead.telefone}</span>
                          </div>
                        )}

                        {lead.email && (
                          <div className="flex items-center gap-1.5 text-xs text-white/50 mb-1">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{lead.email}</span>
                          </div>
                        )}

                        {lead.segmento && (
                          <div className="flex items-center gap-1.5 text-xs text-white/40 mb-1">
                            <Building2 className="w-3 h-3" />
                            <span className="truncate">{lead.segmento}</span>
                          </div>
                        )}

                        {lead.ticketEstimado > 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-brand-primary font-semibold mt-2">
                            <DollarSign className="w-3 h-3" />
                            <span>{fmtBRL(lead.ticketEstimado)}</span>
                          </div>
                        )}

                        {lead.etiquetas.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {lead.etiquetas.map((tag) => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 text-[10px] rounded-md bg-white/5 text-white/50 border border-white/10"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </motion.div>

                      {idx < stageLeads.length - 1 && (
                        <div className="flex justify-center py-0.5">
                          <ChevronDown className="w-3.5 h-3.5 text-white/10" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}

                  {stageLeads.length === 0 && (
                    <div className="text-center py-8 text-white/20 text-xs">
                      Sem leads
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lead Modal */}
      <AnimatePresence>
        {selectedLead && (
          <LeadModal
            lead={selectedLead}
            stages={stages}
            tenantId={activeTenantId}
            onClose={() => setSelectedLead(null)}
            onUpdate={handleUpdateLead}
            onDelete={handleDeleteLead}
          />
        )}
      </AnimatePresence>

      {/* New Lead Modal */}
      <AnimatePresence>
        {showNewLeadModal && (
          <NewLeadModal
            tenantId={activeTenantId}
            stages={stages}
            onClose={() => setShowNewLeadModal(false)}
            onCreate={handleCreateLead}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── LeadModal ───────────────────────────────────────────────

type LeadModalProps = {
  lead: CrmClientLead;
  stages: CrmClientStage[];
  tenantId: string;
  onClose: () => void;
  onUpdate: (lead: CrmClientLead) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

function LeadModal({ lead, stages, tenantId, onClose, onUpdate, onDelete }: LeadModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'timeline'>('info');
  const [form, setForm] = useState({ ...lead });
  const [saving, setSaving] = useState(false);

  // Timeline
  const [activities, setActivities] = useState<CrmClientLeadActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    setForm({ ...lead });
  }, [lead]);

  useEffect(() => {
    if (activeTab === 'timeline') {
      setLoadingActivities(true);
      getLeadActivities(lead.id)
        .then(setActivities)
        .catch(console.error)
        .finally(() => setLoadingActivities(false));
    }
  }, [activeTab, lead.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(form);
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSendingComment(true);
    try {
      const activity = await createLeadActivity({
        leadId: lead.id,
        tenantId,
        tipo: 'comentario',
        conteudo: newComment.trim(),
        autor: 'Usuário',
      });
      setActivities((prev) => [activity, ...prev]);
      setNewComment('');
    } catch (err) {
      console.error('Erro ao adicionar comentário:', err);
    } finally {
      setSendingComment(false);
    }
  };

  const inputCls =
    'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-primary transition-colors';

  const TABS = [
    { id: 'info' as const, label: 'Informações' },
    { id: 'timeline' as const, label: 'Timeline' },
  ];

  const TIPO_BADGES: Record<string, string> = {
    comentario: 'bg-blue-500/20 text-blue-400',
    ligacao: 'bg-green-500/20 text-green-400',
    reuniao: 'bg-purple-500/20 text-purple-400',
    tarefa: 'bg-amber-500/20 text-amber-400',
    email: 'bg-pink-500/20 text-pink-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-lg font-bold text-white truncate">{lead.nome}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand-primary/10 text-brand-primary'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-1">Nome</label>
                <input
                  className={inputCls}
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Telefone</label>
                  <input
                    className={inputCls}
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Email</label>
                  <input
                    className={inputCls}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Segmento</label>
                  <input
                    className={inputCls}
                    value={form.segmento}
                    onChange={(e) => setForm({ ...form, segmento: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Ticket estimado</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={form.ticketEstimado || ''}
                    onChange={(e) => setForm({ ...form, ticketEstimado: +e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Responsável</label>
                  <input
                    className={inputCls}
                    value={form.responsavel}
                    onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Etapa</label>
                  <select
                    className={inputCls}
                    value={form.stageId}
                    onChange={(e) => setForm({ ...form, stageId: e.target.value })}
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-1">Observações</label>
                <textarea
                  rows={3}
                  className={inputCls + ' resize-none'}
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-brand-primary text-black font-bold rounded-xl px-6 py-2 text-sm hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  onClick={() => {
                    if (confirm('Tem certeza que deseja excluir este lead?')) {
                      onDelete(lead.id);
                    }
                  }}
                  className="text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Excluir lead
                </button>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {/* New comment */}
              <div className="flex gap-2">
                <input
                  className={inputCls + ' flex-1'}
                  placeholder="Adicionar comentário..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                />
                <button
                  onClick={handleAddComment}
                  disabled={sendingComment || !newComment.trim()}
                  className="bg-brand-primary text-black font-bold rounded-xl px-4 py-2 text-sm hover:brightness-110 transition-all disabled:opacity-50"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>

              {/* Activity list */}
              {loadingActivities ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-sm">
                  Nenhuma atividade registrada
                </div>
              ) : (
                <div className="space-y-3">
                  {activities.map((act) => (
                    <motion.div
                      key={act.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white/3 border border-white/5 rounded-xl p-3.5"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                            TIPO_BADGES[act.tipo] ?? 'bg-white/10 text-white/50'
                          }`}
                        >
                          {act.tipo}
                        </span>
                        <span className="text-xs text-white/30">{act.autor}</span>
                        <span className="text-xs text-white/20 ml-auto flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {fmtDate(act.criadoEm)}
                        </span>
                      </div>
                      <p className="text-sm text-white/70">{act.conteudo}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── NewLeadModal ────────────────────────────────────────────

type NewLeadModalProps = {
  tenantId: string;
  stages: CrmClientStage[];
  onClose: () => void;
  onCreate: (data: Omit<CrmClientLead, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<void>;
};

function NewLeadModal({ tenantId, stages, onClose, onCreate }: NewLeadModalProps) {
  const [form, setForm] = useState({
    nome: '',
    telefone: '',
    email: '',
    segmento: '',
    ticketEstimado: 0,
    responsavel: '',
    stageId: stages[0]?.id ?? '',
  });
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setCreating(true);
    try {
      await onCreate({
        tenantId,
        stageId: form.stageId,
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        email: form.email.trim(),
        segmento: form.segmento.trim(),
        ticketEstimado: form.ticketEstimado,
        responsavel: form.responsavel.trim(),
        etiquetas: [],
        observacoes: '',
      });
    } finally {
      setCreating(false);
    }
  };

  const inputCls =
    'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-primary transition-colors';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-lg font-bold text-white">Novo Lead</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-white/40 mb-1">Nome *</label>
            <input
              className={inputCls}
              placeholder="Nome do lead"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1">Telefone</label>
              <input
                className={inputCls}
                placeholder="(00) 00000-0000"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Email</label>
              <input
                type="email"
                className={inputCls}
                placeholder="email@exemplo.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1">Segmento</label>
              <input
                className={inputCls}
                placeholder="Ex: Construtora"
                value={form.segmento}
                onChange={(e) => setForm({ ...form, segmento: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Ticket estimado</label>
              <input
                type="number"
                className={inputCls}
                placeholder="0,00"
                value={form.ticketEstimado || ''}
                onChange={(e) => setForm({ ...form, ticketEstimado: +e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1">Responsável</label>
              <input
                className={inputCls}
                placeholder="Nome do responsável"
                value={form.responsavel}
                onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Etapa inicial</label>
              <select
                className={inputCls}
                value={form.stageId}
                onChange={(e) => setForm({ ...form, stageId: e.target.value })}
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={creating || !form.nome.trim()}
              className="w-full bg-brand-primary text-black font-bold rounded-xl px-4 py-2.5 text-sm hover:brightness-110 transition-all disabled:opacity-50"
            >
              {creating ? 'Criando...' : 'Criar Lead'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
