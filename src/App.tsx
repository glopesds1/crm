import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, BookOpen, GraduationCap,
  Users, 
  Kanban as KanbanIcon, 
  BarChart3, 
  Settings, 
  Search, 
  Plus, 
  Bell,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Clock,
  X,
  MoreVertical,
  Filter,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit2,
  Check,
  Eye,
  EyeOff,
  Tag as TagIcon,
  Briefcase,
  LogOut,
  User,
  Lock,
  Calendar,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  PieChart,
  FileText,
  Download,
  ImageOff,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Loader2,
  ClipboardList,
  AtSign,
  HelpCircle,
  Send,
  Building2,
  Shield,
  QrCode,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO, isWithinInterval, subDays, startOfDay, startOfWeek, startOfMonth, endOfMonth, endOfDay, eachMonthOfInterval, subMonths } from 'date-fns';
import DashboardView from './DashboardView';
import CRMView from './CRMView';
import PlaybooksView from './PlaybooksView';
import ClientCRMView from './ClientCRMView';
import EducacaoView from './EducacaoView';
import MateriaisClienteView from './MateriaisClienteView';
import DocumentosClienteView from './DocumentosClienteView';
import ConsultorIAView from './ConsultorIAView';
import { getTenantByClientId, activateCrmForClient, authenticateCrmUser, getCrmUsersByTenant, createCrmUser, updateCrmUser, deleteCrmUser, authenticateUser, signOut, resetPassword, updatePassword, getAuthSession, mfaListFactors, mfaChallenge, mfaVerify, mfaEnrollTotp, mfaUnenroll, mfaGetAuthenticatorLevel } from './lib/database';
import type { CrmClientTenant, CrmClientUser } from './types';
import { ptBR } from 'date-fns/locale';

import { 
  COLUMNS, 
  MOCK_CLIENTS, 
  INITIAL_TAGS, 
  FUNNEL_OPTIONS, 
  PLATFORM_OPTIONS, 
  COLOR_PALETTE, 
  DEFAULT_ONBOARDING_ITEMS, 
  INITIAL_TEAM_MEMBERS,
  INITIAL_AGENCY_CONFIG
} from './constants';
import { 
  Client, 
  Plan, 
  Tag, 
  ClientComment, 
  Offer, 
  OnboardingItem, 
  MonthlyMeeting,
  MeetingActionItem,
  Demand,
  TeamMember,
  AgencyConfig,
  Notification,
  UserSession,
  ComercialTask
} from './types';

import { 
  getClients, createClient, updateClient, deleteClient,
  getTeamMembers, createTeamMember, updateTeamMember, deleteTeamMember,
  getAgencyConfig, updateAgencyConfig,
  getTags, saveTag, deleteTag,
  getComercialTasks, createComercialTask, deleteComercialTask,
  getDemands, createDemand, updateDemand, deleteDemand
} from './lib/database';
import { supabase } from './lib/supabase';

// --- Helper Functions ---

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  try {
    return format(parseISO(dateString), 'dd/MM/yyyy');
  } catch (e) {
    return dateString;
  }
};

const generateMeetings = (entryDate: string, duration: number): MonthlyMeeting[] => {
  const meetings: MonthlyMeeting[] = [];
  const startDate = new Date(entryDate);
  
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  for (let i = 1; i <= duration; i++) {
    const meetingDate = new Date(startDate);
    meetingDate.setMonth(startDate.getMonth() + i);
    
    meetings.push({
      id: `meeting-${i}-${Date.now()}`,
      number: i,
      month: monthNames[meetingDate.getMonth()],
      year: meetingDate.getFullYear(),
      completed: false
    });
  }
  return meetings;
};

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick, badge }: { icon: any, label: string, active?: boolean, onClick: () => void, badge?: number }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
      active
        ? 'bg-brand-primary/10 text-brand-primary'
        : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    <Icon size={20} className={active ? 'text-brand-primary' : 'group-hover:text-white'} />
    <span className="font-medium text-sm">{label}</span>
    {badge ? <span className="ml-auto text-[10px] font-bold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">{badge}</span> : null}
    {active && !badge && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-primary" />}
  </button>
);

const MetricCard = ({ label, value, trend, icon: Icon }: { label: string, value: string | number, trend?: string, icon: any }) => (
  <div className="glass-card p-6 flex flex-col gap-2">
    <div className="flex justify-between items-start">
      <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
        <Icon size={20} />
      </div>
      {trend && (
        <span className="text-xs font-medium text-brand-primary bg-brand-primary/10 px-2 py-1 rounded-full">
          {trend}
        </span>
      )}
    </div>
    <div className="mt-4">
      <p className="text-gray-400 text-sm font-medium">{label}</p>
      <h3 className="text-3xl font-bold mt-1 tracking-tight">{value}</h3>
    </div>
  </div>
);

interface ClientCardProps {
  client: Client;
  allTags: Record<string, Tag>;
  onClick: () => void;
}

const ClientCard: React.FC<ClientCardProps> = ({ client, allTags, onClick }) => {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="glass-card p-4 cursor-pointer group hover:scale-[1.01] transition-all border border-white/5 hover:border-brand-primary/20"
    >
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-semibold text-white group-hover:text-brand-primary transition-colors">{client.name}</h4>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
          client.plan === 'Pro' ? 'bg-purple-500/20 text-purple-400' :
          client.plan === 'Basic' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
        }`}>
          {client.plan}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-1.5 mb-4">
        {client.tags.map(tagId => {
          const tag = allTags[tagId];
          if (!tag) return null;
          return (
            <span 
              key={tagId} 
              className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
              style={{ borderColor: `${tag.color}33`, color: tag.color, backgroundColor: `${tag.color}11` }}
            >
              {tag.label}
            </span>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div 
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ backgroundColor: COLOR_PALETTE[client.responsible.length % COLOR_PALETTE.length] + '33', color: COLOR_PALETTE[client.responsible.length % COLOR_PALETTE.length] }}
          >
            {client.responsible.split(' ').map(n => n[0]).join('')}
          </div>
          <span className="text-xs text-gray-400">{client.responsible}</span>
        </div>
        <div className="text-[10px] text-gray-500 font-medium flex items-center gap-2">
          <span className="flex items-center gap-0.5">{client.comments.length} <MessageSquare size={10} /></span>
        </div>
      </div>
    </motion.div>
  );
};

const MultiSelect = ({ options, selected, onChange, label }: { options: string[], selected: string[], onChange: (val: string[]) => void, label: string }) => (
  <section>
    <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-4">{label}</h3>
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const isSelected = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => {
              if (isSelected) {
                onChange(selected.filter(s => s !== opt));
              } else {
                onChange([...selected, opt]);
              }
            }}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              isSelected 
                ? 'bg-brand-primary/20 border-brand-primary text-brand-primary' 
                : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  </section>
);

const TagManager = ({ clientTags, allTags, onToggleTag, onSaveTag, onDeleteTag }: { 
  clientTags: string[], 
  allTags: Record<string, Tag>, 
  onToggleTag: (tagId: string) => void,
  onSaveTag: (tag: Tag) => void,
  onDeleteTag: (id: string) => void
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(COLOR_PALETTE[0]);

  const handleCreateOrUpdateTag = () => {
    if (!newTagName.trim()) return;
    const id = editingTagId || newTagName.toLowerCase().replace(/\s+/g, '-');
    const newTag: Tag = { id, label: newTagName, color: newTagColor };
    onSaveTag(newTag);
    setNewTagName('');
    setEditingTagId(null);
  };

  const startEditing = (tag: Tag) => {
    setEditingTagId(tag.id);
    setNewTagName(tag.label);
    setNewTagColor(tag.color);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary">Etiquetas</h3>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="text-[10px] font-bold text-gray-500 hover:text-white flex items-center gap-1"
        >
          {isEditing ? <Check size={12} /> : <Settings size={12} />}
          {isEditing ? 'Concluído' : 'Gerenciar'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {Object.values(allTags).map(tag => {
          const isApplied = clientTags.includes(tag.id);
          return (
            <button
              key={tag.id}
              onClick={() => onToggleTag(tag.id)}
              className={`px-2 py-1 rounded-full border text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                isApplied ? 'opacity-100' : 'opacity-40 hover:opacity-70'
              }`}
              style={{ borderColor: `${tag.color}44`, color: tag.color, backgroundColor: `${tag.color}11` }}
            >
              {tag.label}
              {isApplied && <Check size={10} />}
            </button>
          );
        })}
      </div>

      {isEditing && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4"
        >
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder={editingTagId ? "Editar etiqueta..." : "Nova etiqueta..."}
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand-primary"
            />
            <button 
              onClick={handleCreateOrUpdateTag}
              className="p-1.5 rounded-lg bg-brand-primary text-bg-main"
            >
              {editingTagId ? <Check size={16} /> : <Plus size={16} />}
            </button>
            {editingTagId && (
              <button 
                onClick={() => {
                  setEditingTagId(null);
                  setNewTagName('');
                }}
                className="p-1.5 rounded-lg bg-white/5 text-gray-400"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map(color => (
              <button
                key={color}
                onClick={() => setNewTagColor(color)}
                className={`w-5 h-5 rounded-full border-2 transition-all ${newTagColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="pt-2 border-t border-white/5">
            <p className="text-[10px] text-gray-500 mb-2 uppercase font-bold">Editar Existentes</p>
            <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
              {Object.values(allTags).map(tag => (
                <div key={tag.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className="text-xs text-gray-300">{tag.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => startEditing(tag)}
                      className="text-gray-600 hover:text-brand-primary p-1"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button 
                      onClick={() => onDeleteTag(tag.id)}
                      className="text-gray-600 hover:text-red-400 p-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </section>
  );
};

const OfferSection = ({ offers, onAddOffer, onRemoveOffer }: { 
  offers: Offer[], 
  onAddOffer: (offer: Omit<Offer, 'id'>) => void,
  onRemoveOffer: (id: string) => void
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newOffer, setNewOffer] = useState({ name: '', situation: '', platform: 'Ambos' as Offer['platform'] });

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary">Ofertas</h3>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1"
        >
          <Plus size={14} /> Nova Oferta
        </button>
      </div>

      <div className="space-y-3">
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 rounded-xl bg-brand-primary/5 border border-brand-primary/20 space-y-3"
          >
            <input 
              type="text" 
              placeholder="Nome da oferta"
              value={newOffer.name}
              onChange={e => setNewOffer({ ...newOffer, name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-primary"
            />
            <textarea 
              placeholder="Situação atual"
              value={newOffer.situation}
              onChange={e => setNewOffer({ ...newOffer, situation: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-primary h-20 resize-none"
            />
            <div className="flex gap-2">
              {['Google Ads', 'Meta Ads', 'Ambos'].map(p => (
                <button
                  key={p}
                  onClick={() => setNewOffer({ ...newOffer, platform: p as Offer['platform'] })}
                  className={`flex-1 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                    newOffer.platform === p ? 'bg-brand-primary text-bg-main border-brand-primary' : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => {
                  onAddOffer(newOffer);
                  setIsAdding(false);
                  setNewOffer({ name: '', situation: '', platform: 'Ambos' });
                }}
                className="flex-1 py-2 bg-brand-primary text-bg-main rounded-lg text-xs font-bold"
              >
                Salvar Oferta
              </button>
              <button 
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-xs font-bold"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}

        {offers.map(offer => (
          <div key={offer.id} className="glass-card overflow-hidden">
            <div 
              onClick={() => setExpandedId(expandedId === offer.id ? null : offer.id)}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
                  <Briefcase size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold">{offer.name}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{offer.platform}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); onRemoveOffer(offer.id); }}
                  className="p-1.5 text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
                {expandedId === offer.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>
            <AnimatePresence>
              {expandedId === offer.id && (
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="px-4 pb-4 border-t border-white/5"
                >
                  <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                    <span className="text-brand-primary font-bold block mb-1 uppercase tracking-tighter text-[10px]">Situação</span>
                    {offer.situation}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
};

const ClientRegistrationModal = ({ isOpen, onClose, onCreate }: { isOpen: boolean, onClose: () => void, onCreate: (client: Partial<Client>) => void }) => {
  const [formData, setFormData] = useState({
    name: '',
    responsible: '',
    plan: 'Basic' as Plan,
    entryDate: new Date().toISOString().split('T')[0],
    contractDuration: 3,
    docsAccess: '',
    docsTranscription: ''
  });

  const exitDate = useMemo(() => {
    if (!formData.entryDate) return '';
    const date = new Date(formData.entryDate);
    date.setMonth(date.getMonth() + Number(formData.contractDuration));
    return date.toISOString().split('T')[0];
  }, [formData.entryDate, formData.contractDuration]);

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-bg-main border border-white/10 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-bg-sidebar/50">
          <h2 className="text-xl font-bold tracking-tight">Novo Cliente</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Nome da Empresa</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-all"
                placeholder="Ex: TechFlow Solutions"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Responsável pela Empresa</label>
              <input 
                type="text" 
                required
                value={formData.responsible}
                onChange={e => setFormData({ ...formData, responsible: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-all"
                placeholder="Nome do contato principal"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Plano</label>
                <select 
                  value={formData.plan}
                  onChange={e => setFormData({ ...formData, plan: e.target.value as Plan })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-all appearance-none"
                >
                  <option value="Basic" className="bg-bg-main">BASIC</option>
                  <option value="Pro" className="bg-bg-main">PRO</option>
                  <option value="Lite" className="bg-bg-main">LITE</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Tempo de Contrato</label>
                <select 
                  value={formData.contractDuration}
                  onChange={e => setFormData({ ...formData, contractDuration: Number(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-all appearance-none"
                >
                  <option value={1} className="bg-bg-main">1 mês</option>
                  <option value={3} className="bg-bg-main">3 meses</option>
                  <option value={6} className="bg-bg-main">6 meses</option>
                  <option value={12} className="bg-bg-main">12 meses</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Data de Entrada</label>
                <input 
                  type="date" 
                  required
                  value={formData.entryDate}
                  onChange={e => setFormData({ ...formData, entryDate: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Saída Prevista</label>
                <input 
                  type="date" 
                  disabled
                  value={exitDate}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Google Docs - Acessos</label>
              <input 
                type="url" 
                value={formData.docsAccess}
                onChange={e => setFormData({ ...formData, docsAccess: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-all"
                placeholder="https://docs.google.com/..."
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Google Docs - Transcrição</label>
              <input 
                type="url" 
                value={formData.docsTranscription}
                onChange={e => setFormData({ ...formData, docsTranscription: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-all"
                placeholder="https://docs.google.com/..."
              />
            </div>
          </div>

          <button 
            onClick={() => {
              if (!formData.name || !formData.responsible) return;
              onCreate({
                ...formData,
                exitDate
              });
              onClose();
            }}
            className="w-full py-4 bg-brand-primary text-bg-main font-bold rounded-xl shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            CADASTRAR CLIENTE
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const OnboardingSection = ({ checklist, onToggle }: { checklist: OnboardingItem[], onToggle: (id: string) => void }) => {
  const completedCount = checklist.filter(i => i.completed).length;
  const totalCount = checklist.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary">Checklist de Onboarding</h3>
          <span className="text-[10px] font-bold bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full">
            {completedCount}/{totalCount} Concluídos
          </span>
        </div>
        <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-brand-primary shadow-glow"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {checklist.map(item => (
          <div 
            key={item.id}
            onClick={() => onToggle(item.id)}
            className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
              item.completed 
                ? 'bg-brand-primary/5 border-brand-primary/20' 
                : 'bg-white/5 border-white/5 hover:border-white/20'
            }`}
          >
            <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
              item.completed ? 'bg-brand-primary border-brand-primary text-bg-main' : 'border-white/20'
            }`}>
              {item.completed && <Check size={14} />}
            </div>
            <span className={`text-xs font-medium transition-all ${
              item.completed ? 'text-gray-500 line-through' : 'text-gray-300'
            }`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove o prefixo "data:application/pdf;base64,"
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const generateActionItemsWithAI = async (pdfBase64: string, mimeType: string): Promise<{ items: string[]; resumo: string }> => {
  const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  if (!GEMINI_KEY) throw new Error('Chave da API Gemini não configurada');

  const prompt = `Você vai ler um PDF de transcrição de uma reunião mensal entre a agência M² Black e um cliente.

Sua tarefa: identificar APENAS as demandas e tarefas que a EQUIPE DA AGÊNCIA precisa executar DEPOIS da reunião.

O QUE INCLUIR (somente se mencionado explicitamente):
- Entregas que a equipe precisa fazer para o cliente (ex: criar criativos, ajustar campanha, enviar relatório)
- Alterações técnicas solicitadas (ex: mudar segmentação, atualizar site, trocar copy)
- Materiais que a equipe precisa produzir ou enviar
- Prazos e responsáveis quando mencionados

O QUE NÃO INCLUIR:
- Coisas que já foram resolvidas/feitas durante a própria reunião
- Ações do CLIENTE (o que o cliente vai fazer)
- Observações gerais, elogios ou feedback sem demanda
- Acompanhamentos vagos sem ação concreta
- NÃO invente tarefas que não foram pedidas

FORMATO DE RESPOSTA — use este JSON exato:
{
  "actionItems": ["tarefa 1", "tarefa 2"],
  "resumo": "Breve resumo do que foi discutido na reunião (2-3 frases)"
}

Se NÃO houver nenhuma demanda concreta para a equipe, retorne:
{
  "actionItems": [],
  "resumo": "Resumo da reunião. Não há plano de ação — apenas acompanhar XYZ"
}

Sem markdown, sem crases, sem texto antes ou depois do JSON.`;

  console.log('[Gemini] Enviando PDF:', { mimeType, base64Length: pdfBase64.length });

  const body = {
    contents: [{
      parts: [
        { inlineData: { mimeType: mimeType || 'application/pdf', data: pdfBase64 } },
        { text: prompt }
      ]
    }],
    generationConfig: { temperature: 0.1 }
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  console.log('[Gemini] Resposta:', JSON.stringify(data).substring(0, 500));

  if (!response.ok) {
    throw new Error(data?.error?.message || 'Erro ao chamar a API Gemini');
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  console.log('[Gemini] Texto bruto:', text);

  // Tenta parsear como objeto { actionItems, resumo }
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]);
      if (parsed.actionItems && Array.isArray(parsed.actionItems)) {
        return { items: parsed.actionItems, resumo: parsed.resumo || '' };
      }
    } catch { /* fallback abaixo */ }
  }

  // Fallback: tenta parsear como array simples
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    return { items: JSON.parse(arrMatch[0]), resumo: '' };
  }

  throw new Error('IA não retornou um formato válido.');
};

const MeetingsSection = ({
  meetings,
  onToggle,
  onUpdateTranscription,
  onUpdateActionItems
}: {
  meetings: MonthlyMeeting[],
  onToggle: (id: string) => void,
  onUpdateTranscription: (id: string, url: string) => void,
  onUpdateActionItems: (id: string, items: MeetingActionItem[], summary?: string) => void
}) => {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [tempUrl, setTempUrl] = React.useState('');
  const [expandedMeeting, setExpandedMeeting] = React.useState<string | null>(null);
  const [aiLoading, setAiLoading] = React.useState<string | null>(null);
  const [newItemText, setNewItemText] = React.useState('');
  const [addingItemTo, setAddingItemTo] = React.useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = React.useState<Record<string, { name: string; base64: string; mimeType: string }>>({});
  const [dragOver, setDragOver] = React.useState<string | null>(null);

  const handleFileUpload = async (meetingId: string, file: File) => {
    const allowed = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.txt') && !file.name.endsWith('.docx')) {
      alert('Formato não suportado. Use PDF, TXT ou DOCX.');
      return;
    }
    const base64 = await fileToBase64(file);
    const mimeType = file.type || 'application/pdf';
    setUploadedFiles(prev => ({ ...prev, [meetingId]: { name: file.name, base64, mimeType } }));
  };

  const handleGenerateAI = async (meeting: MonthlyMeeting) => {
    const file = uploadedFiles[meeting.id];
    if (!file) {
      alert('Envie o arquivo da transcrição primeiro.');
      return;
    }
    setAiLoading(meeting.id);
    try {
      const result = await generateActionItemsWithAI(file.base64, file.mimeType);
      const actionItems: MeetingActionItem[] = result.items.map((text: string, i: number) => ({
        id: `ai-${Date.now()}-${i}`,
        text,
        completed: false
      }));
      // Preserva items existentes e adiciona os novos
      const existing = meeting.actionItems ?? [];
      onUpdateActionItems(meeting.id, [...existing, ...actionItems], result.resumo);
      setExpandedMeeting(meeting.id);
    } catch (err) {
      alert('Erro ao gerar ações. Tente novamente.');
    } finally {
      setAiLoading(null);
    }
  };

  const handleToggleItem = (meetingId: string, itemId: string, items: MeetingActionItem[]) => {
    const updated = items.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    onUpdateActionItems(meetingId, updated);
  };

  const handleDeleteItem = (meetingId: string, itemId: string, items: MeetingActionItem[]) => {
    onUpdateActionItems(meetingId, items.filter(item => item.id !== itemId));
  };

  const handleAddItem = (meetingId: string, items: MeetingActionItem[]) => {
    if (!newItemText.trim()) return;
    const newItem: MeetingActionItem = {
      id: `manual-${Date.now()}`,
      text: newItemText.trim(),
      completed: false
    };
    onUpdateActionItems(meetingId, [...items, newItem]);
    setNewItemText('');
    setAddingItemTo(null);
  };

  return (
    <section>
      <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-4">Reuniões Mensais</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {meetings.map(meeting => {
          const actionItems = meeting.actionItems ?? [];
          const completedCount = actionItems.filter(i => i.completed).length;
          const isExpanded = expandedMeeting === meeting.id;

          return (
            <div
              key={meeting.id}
              className={`p-4 rounded-xl border flex flex-col gap-3 transition-all ${
                meeting.completed
                  ? 'bg-brand-primary/5 border-brand-primary/20'
                  : 'bg-white/5 border-white/5 hover:border-white/20'
              }`}
            >
              <div className="flex justify-between items-start cursor-pointer" onClick={() => onToggle(meeting.id)}>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Reunião {meeting.number.toString().padStart(2, '0')}</p>
                  <p className={`text-sm font-bold ${meeting.completed ? 'text-brand-primary' : 'text-white'}`}>{meeting.month} {meeting.year}</p>
                </div>
                <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                  meeting.completed ? 'bg-brand-primary border-brand-primary text-bg-main' : 'border-white/20'
                }`}>
                  {meeting.completed && <Check size={14} />}
                </div>
              </div>

              {meeting.completed && (
                <div className="pt-2 border-t border-brand-primary/10 space-y-3" onClick={(e) => e.stopPropagation()}>
                  {meeting.completionDate && (
                    <p className="text-[10px] text-brand-primary/60 font-medium">Realizada em: {formatDate(meeting.completionDate)}</p>
                  )}

                  {/* Transcrição URL */}
                  {editingId === meeting.id ? (
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={tempUrl}
                        onChange={(e) => setTempUrl(e.target.value)}
                        placeholder="Cole o link da transcrição..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary/50"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { onUpdateTranscription(meeting.id, tempUrl); setEditingId(null); setTempUrl(''); }
                          if (e.key === 'Escape') { setEditingId(null); setTempUrl(''); }
                        }}
                      />
                      <button
                        onClick={() => { onUpdateTranscription(meeting.id, tempUrl); setEditingId(null); setTempUrl(''); }}
                        className="p-1.5 rounded-lg bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/30 transition-colors"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ) : meeting.transcriptionUrl ? (
                    <div className="flex items-center gap-2">
                      <a href={meeting.transcriptionUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[10px] text-brand-primary/80 hover:text-brand-primary transition-colors truncate">
                        <FileText size={12} /><span className="truncate">Transcrição</span><ExternalLink size={10} />
                      </a>
                      <button onClick={() => { setEditingId(meeting.id); setTempUrl(meeting.transcriptionUrl || ''); }}
                        className="p-1 rounded text-gray-500 hover:text-white transition-colors">
                        <Edit2 size={10} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingId(meeting.id); setTempUrl(''); }}
                      className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-brand-primary transition-colors">
                      <Plus size={12} /><span>Adicionar transcrição</span>
                    </button>
                  )}

                  {/* Upload PDF da transcrição */}
                  {meeting.completed && (
                    <div className="space-y-2">
                      {uploadedFiles[meeting.id] ? (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={14} className="text-brand-primary flex-shrink-0" />
                            <span className="text-[11px] text-white truncate">{uploadedFiles[meeting.id].name}</span>
                          </div>
                          <button
                            onClick={() => setUploadedFiles(prev => { const n = { ...prev }; delete n[meeting.id]; return n; })}
                            className="p-1 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <label
                          onDragOver={(e) => { e.preventDefault(); setDragOver(meeting.id); }}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOver(null);
                            const file = e.dataTransfer.files[0];
                            if (file) handleFileUpload(meeting.id, file);
                          }}
                          className={`w-full flex flex-col items-center justify-center gap-1.5 py-3 px-3 rounded-lg border border-dashed cursor-pointer transition-all text-[11px] ${
                            dragOver === meeting.id
                              ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                              : 'border-white/15 bg-white/5 text-gray-400 hover:text-white hover:border-white/30'
                          }`}
                        >
                          <Download size={16} />
                          <span>Arraste o PDF ou clique para enviar</span>
                          <span className="text-[9px] text-gray-600">PDF, TXT ou DOCX</span>
                          <input
                            type="file"
                            accept=".pdf,.txt,.docx"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(meeting.id, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {/* Botão Gerar Ações com IA */}
                  {uploadedFiles[meeting.id] && (
                    <button
                      onClick={() => handleGenerateAI(meeting)}
                      disabled={aiLoading === meeting.id}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 transition-all text-[11px] font-semibold disabled:opacity-50"
                    >
                      {aiLoading === meeting.id ? (
                        <><Loader2 size={14} className="animate-spin" /> Analisando transcrição...</>
                      ) : (
                        <><Sparkles size={14} /> Gerar ações com IA</>
                      )}
                    </button>
                  )}

                  {/* Resumo da reunião */}
                  {meeting.meetingSummary && (
                    <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/70 mb-1">Resumo da Reunião</p>
                      <p className="text-[11px] text-gray-300 leading-relaxed">{meeting.meetingSummary}</p>
                    </div>
                  )}

                  {/* Action Items Checklist */}
                  {actionItems.length > 0 && (
                    <div className="space-y-2">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setExpandedMeeting(isExpanded ? null : meeting.id)}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          Ações ({completedCount}/{actionItems.length})
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-primary rounded-full transition-all"
                              style={{ width: `${actionItems.length > 0 ? (completedCount / actionItems.length) * 100 : 0}%` }}
                            />
                          </div>
                          {isExpanded ? <ChevronUp size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-1.5 max-h-48 overflow-y-auto"
                        >
                          {actionItems.map(item => (
                            <div key={item.id} className="flex items-start gap-2 group">
                              <button
                                onClick={() => handleToggleItem(meeting.id, item.id, actionItems)}
                                className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                                  item.completed
                                    ? 'bg-brand-primary border-brand-primary text-bg-main'
                                    : 'border-white/20 hover:border-brand-primary/50'
                                }`}
                              >
                                {item.completed && <Check size={10} />}
                              </button>
                              <span className={`text-[11px] flex-1 leading-tight ${item.completed ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                                {item.text}
                              </span>
                              <button
                                onClick={() => handleDeleteItem(meeting.id, item.id, actionItems)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-600 hover:text-red-400 transition-all"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}

                          {/* Adicionar item manual */}
                          {addingItemTo === meeting.id ? (
                            <div className="flex gap-1.5 mt-1">
                              <input
                                type="text"
                                value={newItemText}
                                onChange={(e) => setNewItemText(e.target.value)}
                                placeholder="Descreva a ação..."
                                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary/50"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddItem(meeting.id, actionItems);
                                  if (e.key === 'Escape') { setAddingItemTo(null); setNewItemText(''); }
                                }}
                              />
                              <button onClick={() => handleAddItem(meeting.id, actionItems)}
                                className="p-1 rounded-lg bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/30 transition-colors">
                                <Check size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAddingItemTo(meeting.id); setNewItemText(''); }}
                              className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-brand-primary transition-colors mt-1"
                            >
                              <Plus size={10} /> Adicionar ação manualmente
                            </button>
                          )}
                        </motion.div>
                      )}
                    </div>
                  )}

                  {/* Se não tem items ainda mas tem transcrição, mostra botão de adicionar manual */}
                  {actionItems.length === 0 && meeting.transcriptionUrl && (
                    <div>
                      {addingItemTo === meeting.id ? (
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={newItemText}
                            onChange={(e) => setNewItemText(e.target.value)}
                            placeholder="Descreva a ação..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-brand-primary/50"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddItem(meeting.id, actionItems);
                              if (e.key === 'Escape') { setAddingItemTo(null); setNewItemText(''); }
                            }}
                          />
                          <button onClick={() => handleAddItem(meeting.id, actionItems)}
                            className="p-1 rounded-lg bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/30 transition-colors">
                            <Check size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddingItemTo(meeting.id); setNewItemText(''); }}
                          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-brand-primary transition-colors"
                        >
                          <Plus size={10} /> Adicionar ação manualmente
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

// --- Two Factor Panel (Configurações) ---
const TwoFactorPanel = () => {
  const [factors, setFactors] = useState<{ id: string; friendlyName?: string }[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [enrollFactorId, setEnrollFactorId] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFactors();
  }, []);

  const loadFactors = async () => {
    setLoading(true);
    const data = await mfaListFactors();
    setFactors(data.totp?.map((f: { id: string; friendly_name?: string }) => ({ id: f.id, friendlyName: f.friendly_name })) ?? []);
    setLoading(false);
  };

  const handleEnroll = async () => {
    try {
      const data = await mfaEnrollTotp('Authenticator');
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setEnrollFactorId(data.id);
      setEnrolling(true);
      setStatus('');
    } catch {
      setStatus('Erro ao gerar QR Code.');
    }
  };

  const handleVerifyEnroll = async () => {
    try {
      const challenge = await mfaChallenge(enrollFactorId);
      const result = await mfaVerify(enrollFactorId, challenge.id, verifyCode);
      if (result.error) {
        setStatus('Código inválido. Tente novamente.');
        setVerifyCode('');
        return;
      }
      setEnrolling(false);
      setVerifyCode('');
      setQrCode('');
      setSecret('');
      setStatus('2FA ativado com sucesso!');
      loadFactors();
    } catch {
      setStatus('Erro ao verificar código.');
    }
  };

  const handleRemove = async (factorId: string) => {
    if (!confirm('Desativar autenticação em 2 fatores?')) return;
    try {
      await mfaUnenroll(factorId);
      setStatus('2FA desativado.');
      loadFactors();
    } catch {
      setStatus('Erro ao desativar 2FA.');
    }
  };

  if (loading) return null;

  return (
    <div className="glass-card p-8 space-y-6">
      <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary flex items-center gap-2">
        <Shield size={16} /> Autenticação em 2 Fatores (2FA)
      </h3>

      {factors.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <Shield size={20} className="text-green-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-400">2FA Ativo</p>
              <p className="text-xs text-gray-500">Seu login está protegido com autenticação em 2 fatores.</p>
            </div>
            <button onClick={() => handleRemove(factors[0].id)}
              className="text-xs text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10">
              Desativar
            </button>
          </div>
        </div>
      ) : enrolling ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Escaneie o QR Code abaixo no seu app autenticador (Google Authenticator, Authy, etc.):</p>
          <div className="flex justify-center">
            <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48 rounded-xl" />
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Chave manual</p>
            <code className="text-xs text-gray-400 bg-white/5 px-3 py-1.5 rounded-lg">{secret}</code>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Código de verificação</label>
            <input type="text" inputMode="numeric" maxLength={6} value={verifyCode}
              onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter' && verifyCode.length === 6) handleVerifyEnroll(); }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-center tracking-[0.3em] font-mono focus:outline-none focus:border-brand-primary"
              placeholder="000000"
            />
          </div>
          {status && <p className="text-xs text-red-400 text-center">{status}</p>}
          <div className="flex gap-3">
            <button onClick={() => { setEnrolling(false); setQrCode(''); mfaUnenroll(enrollFactorId).catch(() => {}); }}
              className="flex-1 bg-white/5 text-gray-400 py-2.5 rounded-xl text-sm hover:bg-white/10 transition-colors">
              Cancelar
            </button>
            <button onClick={handleVerifyEnroll} disabled={verifyCode.length !== 6}
              className="flex-1 bg-brand-primary text-bg-main font-bold py-2.5 rounded-xl text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
              Ativar 2FA
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">Adicione uma camada extra de segurança ao seu login usando um aplicativo autenticador.</p>
          <button onClick={handleEnroll}
            className="flex items-center gap-2 bg-brand-primary/10 text-brand-primary px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-primary/20 transition-colors">
            <QrCode size={16} /> Configurar 2FA
          </button>
        </div>
      )}

      {status && !enrolling && <p className="text-xs text-brand-primary">{status}</p>}
    </div>
  );
};

const LoginScreen = ({ onLogin, onCrmLogin, teamMembers, agencyConfig }: { onLogin: (user: UserSession) => void, onCrmLogin: (user: CrmClientUser, tenant: CrmClientTenant) => void, teamMembers: TeamMember[], agencyConfig: AgencyConfig }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA state
  const [mfaPending, setMfaPending] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaChallengeId, setMfaChallengeId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [pendingMember, setPendingMember] = useState<TeamMember | null>(null);
  const [pendingCrmResult, setPendingCrmResult] = useState<{ user: CrmClientUser; tenant: CrmClientTenant } | null>(null);

  const completeMfaLogin = async () => {
    setError('');
    setLoading(true);
    const result = await mfaVerify(mfaFactorId, mfaChallengeId, mfaCode);
    if (result.error) {
      setError('Código inválido. Tente novamente.');
      setMfaCode('');
      setLoading(false);
      return;
    }
    if (pendingMember) {
      onLogin({ userId: pendingMember.id, name: pendingMember.name, email: pendingMember.email, role: pendingMember.role, color: pendingMember.color });
    } else if (pendingCrmResult) {
      onCrmLogin(pendingCrmResult.user, pendingCrmResult.tenant);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // 1. Tenta como equipe M2 (via Supabase Auth)
      const member = await authenticateUser(email, password);
      if (member) {
        if (member.status === 'Inativo') {
          setError('Esta conta está inativa. Contate o administrador.');
          setLoading(false);
          return;
        }
        // Verificar se tem 2FA ativo
        const aal = await mfaGetAuthenticatorLevel();
        if (aal.nextLevel === 'aal2' && aal.currentLevel === 'aal1') {
          const factors = await mfaListFactors();
          const totp = factors.totp?.[0];
          if (totp) {
            const challenge = await mfaChallenge(totp.id);
            setMfaFactorId(totp.id);
            setMfaChallengeId(challenge.id);
            setPendingMember(member);
            setMfaPending(true);
            setLoading(false);
            return;
          }
        }
        onLogin({ userId: member.id, name: member.name, email: member.email, role: member.role, color: member.color });
        setLoading(false);
        return;
      }
      // 2. Tenta como usuário CRM (cliente) (via Supabase Auth)
      const crmResult = await authenticateCrmUser(email, password);
      if (crmResult) {
        // Verificar 2FA para CRM users também
        const aal = await mfaGetAuthenticatorLevel();
        if (aal.nextLevel === 'aal2' && aal.currentLevel === 'aal1') {
          const factors = await mfaListFactors();
          const totp = factors.totp?.[0];
          if (totp) {
            const challenge = await mfaChallenge(totp.id);
            setMfaFactorId(totp.id);
            setMfaChallengeId(challenge.id);
            setPendingCrmResult(crmResult);
            setMfaPending(true);
            setLoading(false);
            return;
          }
        }
        onCrmLogin(crmResult.user, crmResult.tenant);
        setLoading(false);
        return;
      }
      setError('E-mail ou senha incorretos.');
    } catch {
      setError('Erro ao conectar. Tente novamente.');
    }
    setLoading(false);
  };

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) return;
    const { error: err } = await resetPassword(resetEmail);
    if (err) {
      setResetMsg('Erro ao enviar. Verifique o e-mail.');
    } else {
      setResetMsg('Link de redefinição enviado para o e-mail!');
    }
  };

  // Tela de verificação 2FA
  if (mfaPending) {
    return (
      <div className="fixed inset-0 z-[200] bg-bg-main flex items-center justify-center p-4 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-primary/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-secondary/10 blur-[120px] rounded-full" />
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="relative w-full max-w-sm bg-bg-card border border-white/5 rounded-2xl shadow-2xl p-8 z-10">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <Shield size={32} className="text-brand-primary" />
            </div>
            <h2 className="text-xl font-bold">Verificação em 2 Etapas</h2>
            <p className="text-sm text-gray-400">Digite o código do seu aplicativo autenticador</p>
          </div>
          <div className="mt-6 space-y-4">
            <input type="text" inputMode="numeric" maxLength={6} autoFocus
              value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter' && mfaCode.length === 6) completeMfaLogin(); }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:border-brand-primary transition-all"
              placeholder="000000"
            />
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <button onClick={completeMfaLogin} disabled={loading || mfaCode.length !== 6}
              className="w-full bg-brand-primary text-bg-main font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 uppercase tracking-wider text-sm">
              {loading ? 'Verificando...' : 'Verificar'}
            </button>
            <button onClick={() => { setMfaPending(false); setMfaCode(''); setPendingMember(null); setPendingCrmResult(null); signOut(); }}
              className="w-full text-gray-500 text-xs hover:text-gray-300 transition-colors">
              ← Voltar para o login
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-bg-main flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-primary/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-secondary/10 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-card p-10 relative z-10 border border-white/10"
      >
        <div className="flex flex-col items-center mb-10">
          {agencyConfig.logoUrl ? (
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-glow mb-6 border border-white/10">
              <img 
                src={agencyConfig.logoUrl} 
                alt={agencyConfig.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-glow mb-6">
              <KanbanIcon size={32} className="text-bg-main" />
            </div>
          )}
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase">
            {agencyConfig.name.split(' ').slice(0, -1).join(' ')} <span className="text-brand-primary">{agencyConfig.name.split(' ').slice(-1)}</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2">Acesse sua plataforma de gestão</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Email Corporativo</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-brand-primary transition-all"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-brand-primary transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-xs font-medium text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-brand-primary text-bg-main font-bold rounded-xl shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'ENTRANDO...' : 'ENTRAR NO SISTEMA'}
          </button>

          <button type="button" onClick={() => setShowReset(true)} className="text-xs text-gray-500 hover:text-brand-primary transition-colors mt-2">
            Esqueceu a senha?
          </button>
        </form>

        {/* Modal de redefinição de senha */}
        {showReset && (
          <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
            <h3 className="text-sm font-bold text-white">Redefinir Senha</h3>
            <p className="text-xs text-gray-400">Informe seu e-mail e enviaremos um link para redefinir.</p>
            <input
              type="email"
              value={resetEmail}
              onChange={e => setResetEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-all"
              placeholder="seu@email.com"
            />
            {resetMsg && <p className={`text-xs ${resetMsg.includes('Erro') ? 'text-red-400' : 'text-green-400'}`}>{resetMsg}</p>}
            <div className="flex gap-2">
              <button onClick={handleResetPassword} className="flex-1 py-2 bg-brand-primary text-bg-main font-bold rounded-lg text-sm">Enviar Link</button>
              <button onClick={() => { setShowReset(false); setResetMsg(''); }} className="py-2 px-4 bg-white/5 text-gray-400 rounded-lg text-sm">Cancelar</button>
            </div>
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-white/5 text-center">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">{agencyConfig.name} © {new Date().getFullYear()}</p>
        </div>
      </motion.div>
    </div>
  );
};

const GlobalSearchModal = ({ isOpen, onClose, clients, onSelectClient }: { 
  isOpen: boolean, 
  onClose: () => void, 
  clients: Client[],
  onSelectClient: (id: string) => void
}) => {
  const [query, setQuery] = useState('');
  
  const results = useMemo(() => {
    if (!query.trim()) return [];
    return clients.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
  }, [query, clients]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center p-4 pt-[15vh] bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-bg-main border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex items-center gap-4">
          <Search className="text-brand-primary" size={20} />
          <input 
            autoFocus
            type="text" 
            placeholder="Buscar empresa ou cliente..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none text-lg focus:outline-none text-white"
          />
          <kbd className="bg-white/5 px-2 py-1 rounded text-[10px] text-gray-500 border border-white/10">ESC</kbd>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
          {results.length > 0 ? (
            <div className="p-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest p-3">Resultados</p>
              {results.map(client => (
                <button
                  key={client.id}
                  onClick={() => {
                    onSelectClient(client.id);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-all text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold">
                      {client.name[0]}
                    </div>
                    <div>
                      <p className="font-bold text-white group-hover:text-brand-primary transition-colors">{client.name}</p>
                      <p className="text-xs text-gray-500">{client.responsible} • {client.plan}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-700 group-hover:text-brand-primary" />
                </button>
              ))}
            </div>
          ) : query.trim() ? (
            <div className="p-20 text-center">
              <Search size={48} className="text-gray-800 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum resultado encontrado para "{query}"</p>
            </div>
          ) : (
            <div className="p-10 text-center text-gray-600">
              <p className="text-sm">Digite para começar a buscar...</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const NotificationPanel = ({ isOpen, onClose, notifications, onMarkRead }: { 
  isOpen: boolean, 
  onClose: () => void, 
  notifications: Notification[],
  onMarkRead: (id: string) => void
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute top-12 right-0 w-80 z-[100] bg-bg-main border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-bg-sidebar/50">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white">Notificações</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={14} /></button>
      </div>
      <div className="max-h-96 overflow-y-auto custom-scrollbar">
        {notifications.length > 0 ? (
          notifications.map(n => (
            <div 
              key={n.id} 
              className={`p-4 border-b border-white/5 transition-all cursor-pointer hover:bg-white/[0.02] ${!n.read ? 'bg-brand-primary/[0.02]' : ''}`}
              onClick={() => onMarkRead(n.id)}
            >
              <div className="flex gap-3">
                <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                  n.type === 'alert' ? 'bg-red-500' : n.type === 'success' ? 'bg-brand-primary' : 'bg-blue-500'
                }`} />
                <div>
                  <p className={`text-xs font-bold mb-1 ${!n.read ? 'text-white' : 'text-gray-400'}`}>{n.title}</p>
                  <p className="text-[10px] text-gray-500 leading-relaxed mb-2">{n.message}</p>
                  <p className="text-[9px] text-gray-600 font-bold uppercase">{n.date}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-10 text-center">
            <Bell size={32} className="text-gray-800 mx-auto mb-3" />
            <p className="text-xs text-gray-600 italic">Tudo limpo por aqui!</p>
          </div>
        )}
      </div>
    </div>
  );
};

const UserMenu = ({ isOpen, onClose, user, onLogout }: { 
  isOpen: boolean, 
  onClose: () => void, 
  user: UserSession,
  onLogout: () => void
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute bottom-16 left-0 w-56 z-[100] bg-bg-main border border-white/10 rounded-xl shadow-2xl overflow-hidden">
      <div className="p-2">
        <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-all">
          <User size={14} /> Editar Perfil
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-white transition-all">
          <Lock size={14} /> Alterar Senha
        </button>
        <div className="my-1 border-t border-white/5" />
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut size={14} /> Sair do Sistema
        </button>
      </div>
    </div>
  );
};

const KanbanFilterPanel = ({ 
  isOpen, 
  onClose, 
  filters, 
  onFilterChange,
  teamMembers 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  filters: any,
  onFilterChange: (newFilters: any) => void,
  teamMembers: TeamMember[]
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute top-12 right-0 w-72 z-[100] bg-bg-main border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-bg-sidebar/50">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white">Filtros Avançados</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={14} /></button>
      </div>
      <div className="p-6 space-y-6">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3 block">Plano</label>
          <div className="flex flex-wrap gap-2">
            {['BASIC', 'PRO', 'LITE'].map(p => (
              <button
                key={p}
                onClick={() => {
                  const newPlans = filters.plans.includes(p) 
                    ? filters.plans.filter((f: string) => f !== p)
                    : [...filters.plans, p];
                  onFilterChange({ ...filters, plans: newPlans });
                }}
                className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                  filters.plans.includes(p) ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' : 'bg-white/5 border-white/10 text-gray-500'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3 block">Responsável</label>
          <select 
            value={filters.responsible}
            onChange={e => onFilterChange({ ...filters, responsible: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-primary"
          >
            <option value="all" className="bg-bg-main">Todos os membros</option>
            {teamMembers.map(m => <option key={m.id} value={m.name} className="bg-bg-main">{m.name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3 block">Status do Cliente</label>
          <div className="flex gap-2">
            {['Ativo', 'Inativo'].map(s => (
              <button
                key={s}
                onClick={() => onFilterChange({ ...filters, status: s })}
                className={`flex-1 py-2 rounded-lg border text-[10px] font-bold transition-all ${
                  filters.status === s ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' : 'bg-white/5 border-white/10 text-gray-500'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <button 
          onClick={() => onFilterChange({ plans: [], responsible: 'all', status: 'Ativo' })}
          className="w-full py-2.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
        >
          Limpar Filtros
        </button>
      </div>
    </div>
  );
};

const SettingsView = ({ config, onSave, allTags, onSaveTag, onDeleteTag }: { 
  config: AgencyConfig, 
  onSave: (c: AgencyConfig) => void,
  allTags: Record<string, Tag>,
  onSaveTag: (tag: Tag) => void,
  onDeleteTag: (id: string) => void
}) => {
  const [formData, setFormData] = useState(config);
  const [newTag, setNewTag] = useState({ label: '', color: COLOR_PALETTE[0] });

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-gray-400 mt-1">Personalize a plataforma para sua agência.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-card p-8 space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary flex items-center gap-2">
            <Briefcase size={16} /> Dados da Agência
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Nome da Agência</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Logo URL</label>
              <input 
                type="text" 
                value={formData.logoUrl}
                onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Email de Contato</label>
              <input 
                type="email" 
                value={formData.contactEmail}
                onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>
        </div>

        <div className="glass-card p-8 space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary flex items-center gap-2">
            <DollarSign size={16} /> Personalização de Planos
          </h3>
          <div className="space-y-4">
            {(['Basic', 'Pro', 'Lite'] as Plan[]).map(plan => (
              <div key={plan} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                <span className="text-xs font-bold text-white uppercase tracking-widest">{plan}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">R$</span>
                  <input 
                    type="number" 
                    value={formData.planPricing[plan]}
                    onChange={e => setFormData({ 
                      ...formData, 
                      planPricing: { ...formData.planPricing, [plan]: Number(e.target.value) } 
                    })}
                    className="w-24 bg-transparent border-b border-white/10 text-right font-bold text-brand-primary focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel 2FA */}
      <TwoFactorPanel />

      <div className="glass-card p-8 space-y-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary flex items-center gap-2">
          <TagIcon size={16} /> Gestão de Etiquetas
        </h3>
        <div className="flex gap-4 items-end mb-6">
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Nova Etiqueta</label>
            <input 
              type="text" 
              value={newTag.label}
              onChange={e => setNewTag({ ...newTag, label: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary"
              placeholder="Nome da etiqueta..."
            />
          </div>
          <div className="flex gap-2 mb-1">
            {COLOR_PALETTE.slice(0, 6).map(color => (
              <button
                key={color}
                onClick={() => setNewTag({ ...newTag, color })}
                className={`w-8 h-8 rounded-lg border-2 transition-all ${newTag.color === color ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <button 
            onClick={() => {
              if (!newTag.label) return;
              const id = newTag.label.toLowerCase().replace(/\s+/g, '-');
              onSaveTag({ id, ...newTag });
              setNewTag({ label: '', color: COLOR_PALETTE[0] });
            }}
            className="px-6 py-3 bg-brand-primary text-bg-main font-bold rounded-xl shadow-glow"
          >
            Adicionar
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Object.values(allTags).map(tag => (
            <div key={tag.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-3 group">
              <div className="flex justify-between items-start">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                <button 
                  onClick={() => onDeleteTag(tag.id)}
                  className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white truncate">{tag.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={() => onSave(formData)}
          className="px-10 py-4 bg-brand-primary text-bg-main font-black rounded-xl shadow-glow hover:scale-105 active:scale-95 transition-all"
        >
          SALVAR CONFIGURAÇÕES
        </button>
      </div>
    </div>
  );
};

const ReportsView = ({ clients, config }: { clients: Client[], config: AgencyConfig }) => {
  const activeClients = clients.filter(c => c.isActive);
  const monthlyRevenue = activeClients.reduce((acc, c) => acc + (config.planPricing[c.plan] || 0), 0);
  const annualRevenue = monthlyRevenue * 12;
  
  const last30Days = subDays(new Date(), 30);
  const newClients = clients.filter(c => parseISO(c.entryDate) >= last30Days).length;
  
  const avgOnboarding = activeClients.length > 0 
    ? activeClients.reduce((acc, c) => {
        const completed = c.onboardingChecklist.filter(i => i.completed).length;
        return acc + (completed / c.onboardingChecklist.length);
      }, 0) / activeClients.length * 100
    : 0;

  const statusData = COLUMNS.map(col => ({
    name: col.title,
    value: clients.filter(c => c.status === col.id).length
  }));

  const onboardingProgressData = clients.slice(0, 10).map(c => ({
    name: c.name,
    progress: Math.round((c.onboardingChecklist.filter(i => i.completed).length / c.onboardingChecklist.length) * 100)
  }));

  const alertClients = clients.filter(c => {
    const exitDate = parseISO(c.exitDate);
    const thirtyDaysFromNow = subDays(new Date(), -30);
    return exitDate <= thirtyDaysFromNow && c.isActive;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios e Métricas</h1>
        <p className="text-gray-400 mt-1">Análise profunda da performance da sua agência.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard label="Receita Mensal" value={`R$ ${monthlyRevenue.toLocaleString()}`} trend="+8.2%" icon={DollarSign} />
        <MetricCard label="Receita Anual Projetada" value={`R$ ${annualRevenue.toLocaleString()}`} trend="+15.4%" icon={TrendingUp} />
        <MetricCard label="Clientes Novos (30 dias)" value={newClients} trend="+2" icon={Users} />
        <MetricCard label="Onboarding Médio" value={`${Math.round(avgOnboarding)}%`} trend="+5%" icon={Check} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-8 flex items-center gap-2">
            <PieChart size={16} /> Clientes por Status
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                />
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            {statusData.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLOR_PALETTE[i % COLOR_PALETTE.length] }} />
                <span className="text-[10px] text-gray-500 font-bold uppercase truncate">{s.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-8">
          <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-8 flex items-center gap-2">
            <BarChart3 size={16} /> Progresso de Onboarding
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={onboardingProgressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#555" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#00FF88', fontSize: '12px' }}
                />
                <Bar dataKey="progress" fill="#00FF88" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass-card p-8">
        <h3 className="text-sm font-bold uppercase tracking-widest text-red-400 mb-6 flex items-center gap-2">
          <AlertTriangle size={16} /> Clientes em Alerta (Saída em 30 dias)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5">
                <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Empresa</th>
                <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Responsável</th>
                <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Plano</th>
                <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Data de Saída</th>
                <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {alertClients.length > 0 ? alertClients.map(client => (
                <tr key={client.id} className="border-b border-white/5">
                  <td className="py-4 text-sm font-bold">{client.name}</td>
                  <td className="py-4 text-sm text-gray-400">{client.responsible}</td>
                  <td className="py-4">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-gray-400">{client.plan}</span>
                  </td>
                  <td className="py-4 text-sm text-red-400 font-bold">{formatDate(client.exitDate)}</td>
                  <td className="py-4 text-right">
                    <button className="text-[10px] font-bold text-brand-primary hover:underline uppercase tracking-widest">Renovar</button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-600 italic text-sm">Nenhum cliente em alerta crítico.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const TeamMemberModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  member 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (member: Partial<TeamMember>) => void,
  member?: TeamMember | null
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    password: '',
    confirmPassword: '',
    status: 'Ativo' as 'Ativo' | 'Inativo',
    photoUrl: '',
    phone: '',
    webhookKentro: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Selecione uma imagem.'); return; }
    if (file.size > 2 * 1024 * 1024) { alert('Imagem muito grande. Máximo 2MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setFormData(prev => ({ ...prev, photoUrl: reader.result as string }));
    reader.readAsDataURL(file);
  };

  React.useEffect(() => {
    if (member) {
      setFormData({
        name: member.name,
        email: member.email,
        role: member.role,
        password: '',
        confirmPassword: '',
        status: member.status,
        photoUrl: member.photoUrl || '',
        phone: member.phone || '',
        webhookKentro: member.webhookKentro || ''
      });
    } else {
      setFormData({
        name: '',
        email: '',
        role: '',
        password: '',
        confirmPassword: '',
        status: 'Ativo',
        photoUrl: '',
        phone: '',
        webhookKentro: ''
      });
    }
  }, [member, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert('As senhas não coincidem!');
      return;
    }
    onSave({
      ...formData,
      id: member?.id || `tm-${Date.now()}`,
      color: member?.color || COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)],
      photoUrl: formData.photoUrl,
      phone: formData.phone,
      webhookKentro: formData.webhookKentro
    });
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-bg-main border border-white/10 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-bg-sidebar/50">
          <h2 className="text-xl font-bold tracking-tight">{member ? 'Editar Membro' : 'Adicionar Membro'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {/* Foto do colaborador */}
          <div className="flex flex-col items-center gap-3">
            <label className="relative cursor-pointer group">
              {formData.photoUrl ? (
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-white/10 group-hover:border-brand-primary/50 transition-all">
                  <img src={formData.photoUrl} alt="Foto" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-white/5 border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-1 group-hover:border-brand-primary/50 transition-all">
                  <User size={24} className="text-gray-500 group-hover:text-brand-primary transition-colors" />
                  <span className="text-[9px] text-gray-500 group-hover:text-brand-primary transition-colors">Adicionar foto</span>
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
            {formData.photoUrl && (
              <button type="button" onClick={() => setFormData(prev => ({ ...prev, photoUrl: '' }))} className="text-[10px] text-gray-500 hover:text-red-400 transition-colors">
                Remover foto
              </button>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Nome Completo</label>
            <input 
              type="text" 
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-all"
              placeholder="Ex: Alex Silva"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Email</label>
            <input 
              type="email" 
              required
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-all"
              placeholder="alex@m2black.com"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Telefone (WhatsApp)</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-all"
              placeholder="5531999999999"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Webhook Kentro</label>
            <input
              type="url"
              value={formData.webhookKentro}
              onChange={e => setFormData({ ...formData, webhookKentro: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-all"
              placeholder="https://m2black.atenderbem.com/webhook/..."
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Cargo / Função</label>
            <input
              type="text"
              required
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-all"
              placeholder="Ex: Gestor de Tráfego"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Senha</label>
              <input 
                type={showPassword ? "text" : "password"} 
                required={!member}
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-all"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 bottom-3 text-gray-500 hover:text-white"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Confirmar Senha</label>
              <input 
                type={showPassword ? "text" : "password"} 
                required={!member}
                value={formData.confirmPassword}
                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Status da Conta</span>
            <button 
              type="button"
              onClick={() => setFormData({ ...formData, status: formData.status === 'Ativo' ? 'Inativo' : 'Ativo' })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                formData.status === 'Ativo' 
                  ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' 
                  : 'bg-red-500/10 border-red-500 text-red-500'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${formData.status === 'Ativo' ? 'bg-brand-primary' : 'bg-red-500'}`} />
              <span className="text-[10px] font-bold uppercase">{formData.status}</span>
            </button>
          </div>

          <button 
            type="submit"
            className="w-full py-4 bg-brand-primary text-bg-main font-bold rounded-xl shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all mt-4"
          >
            {member ? 'SALVAR ALTERAÇÕES' : 'ADICIONAR MEMBRO'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ── Seção CRM do Cliente (dentro do modal) ──
const CrmClientSection = ({ clientId, clientName, onOpenCrm }: { clientId: string; clientName: string; onOpenCrm: (tenantId: string) => void }) => {
  const [tenant, setTenant] = useState<CrmClientTenant | null | undefined>(undefined);
  const [activating, setActivating] = useState(false);
  const [leadCount, setLeadCount] = useState(0);

  useEffect(() => {
    getTenantByClientId(clientId).then(t => {
      setTenant(t);
      if (t) {
        import('./lib/database').then(db => db.getClientLeads(t.id)).then(leads => setLeadCount(leads.length));
      }
    }).catch(() => setTenant(null));
  }, [clientId]);

  const handleActivate = async () => {
    setActivating(true);
    try {
      const t = await activateCrmForClient(clientId, clientName);
      setTenant(t);
    } catch (err) {
      console.error('Erro ao ativar CRM:', err);
      alert('Erro ao ativar CRM.');
    }
    setActivating(false);
  };

  if (tenant === undefined) return null; // loading

  return (
    <section className="glass-card p-6 mb-6">
      <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-4">CRM do Cliente</h3>
      {!tenant ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">CRM não configurado para este cliente.</p>
          </div>
          <button onClick={handleActivate} disabled={activating}
            className="bg-brand-primary text-black font-bold rounded-xl px-5 py-2.5 text-sm hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2">
            {activating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {activating ? 'Ativando...' : 'Ativar CRM'}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-400" /> Ativo
            </span>
            <span className="text-sm text-gray-400">{leadCount} leads</span>
          </div>
          <button onClick={() => onOpenCrm(tenant.id)}
            className="bg-brand-primary text-black font-bold rounded-xl px-5 py-2.5 text-sm hover:brightness-110 transition-all flex items-center gap-2">
            <ExternalLink size={16} /> Acessar CRM
          </button>
        </div>
      )}
    </section>
  );
};

const ClientModal = ({ client, allTags, teamMembers, onClose, onUpdateClient, onSaveTag, onDeleteTag, onCreateDemand, userSession, onOpenClientCrm }: {
  client: Client,
  allTags: Record<string, Tag>,
  teamMembers: TeamMember[],
  onClose: () => void,
  onUpdateClient: (updated: Client, oldName?: string) => void,
  onSaveTag: (tag: Tag) => void,
  onDeleteTag: (id: string) => void,
  onCreateDemand: (demand: Demand) => void,
  userSession: UserSession,
  onOpenClientCrm?: (tenantId: string) => void,
}) => {
  const [newComment, setNewComment] = useState('');
  const [editName, setEditName] = useState(client.name);
  const [editResponsible, setEditResponsible] = useState(client.responsible);
  const [originalName] = useState(client.name);

  React.useEffect(() => { setEditName(client.name); }, [client.name]);
  React.useEffect(() => { setEditResponsible(client.responsible); }, [client.responsible]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);

  const filteredMembers = teamMembers.filter(m =>
    m.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  const handleCommentChange = (value: string) => {
    setNewComment(value);
    const lastAt = value.lastIndexOf('@');
    if (lastAt !== -1 && lastAt === value.length - 1 || (lastAt !== -1 && !value.substring(lastAt).includes(' '))) {
      const query = value.substring(lastAt + 1);
      setMentionFilter(query);
      setShowMentionDropdown(true);
      setMentionIndex(0);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const insertMention = (member: TeamMember) => {
    const lastAt = newComment.lastIndexOf('@');
    const before = newComment.substring(0, lastAt);
    setNewComment(`${before}@${member.name} `);
    setShowMentionDropdown(false);
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    const comment: ClientComment = {
      id: Date.now().toString(),
      author: userSession.name,
      text: newComment,
      date: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    };
    onUpdateClient({ ...client, comments: [comment, ...client.comments] });

    // Detectar @ menções e criar demandas
    const mentionRegex = /@([A-Za-zÀ-ÿ]+(?:\s[A-Za-zÀ-ÿ]+)*)/g;
    let match;
    while ((match = mentionRegex.exec(newComment)) !== null) {
      const mentionedName = match[1].trim();
      const member = teamMembers.find(m => m.name.toLowerCase().startsWith(mentionedName.toLowerCase()));
      if (member) {
        const demand: Demand = {
          id: `dem-${Date.now()}-${member.id}`,
          clientId: client.id,
          clientName: client.name,
          assignedTo: member.id,
          assignedName: member.name,
          text: newComment,
          priority: 'media',
          status: 'pendente',
          commentAuthor: userSession.name,
          createdAt: new Date().toISOString()
        };
        onCreateDemand(demand);
      }
    }

    setNewComment('');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-bg-main border border-white/10 w-full max-w-5xl max-h-[95vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-bg-sidebar/50">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={() => { if (editName.trim() && editName.trim() !== originalName) onUpdateClient({ ...client, name: editName.trim() }, originalName); }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="text-2xl font-bold tracking-tight bg-transparent border-b border-transparent hover:border-white/20 focus:border-brand-primary focus:outline-none transition-all px-0 py-0"
              />
              <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                client.plan === 'Pro' ? 'bg-purple-500/20 text-purple-400' :
                client.plan === 'Basic' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
              }`}>
                {client.plan}
              </span>
            </div>
            <p className="text-sm text-gray-400 flex items-center gap-1">Responsável:
              <input
                type="text"
                value={editResponsible}
                onChange={e => setEditResponsible(e.target.value)}
                onBlur={() => { if (editResponsible !== client.responsible && editResponsible.trim()) onUpdateClient({ ...client, responsible: editResponsible.trim() }); }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="text-white bg-transparent border-b border-transparent hover:border-white/20 focus:border-brand-primary focus:outline-none transition-all text-sm px-0 py-0"
              />
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
          {/* Left Col: Info */}
          <div className="lg:col-span-8 overflow-y-auto custom-scrollbar p-8 space-y-10 border-r border-white/5">
            {/* Quick Info Grid (Moved from Sidebar) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 rounded-2xl bg-white/5 border border-white/5">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Status da Operação</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Status</span>
                    <select 
                      value={client.status}
                      onChange={e => onUpdateClient({ ...client, status: e.target.value as Client['status'] })}
                      className="bg-transparent text-xs font-bold text-brand-primary focus:outline-none"
                    >
                      {COLUMNS.map(col => <option key={col.id} value={col.id} className="bg-bg-main">{col.title}</option>)}
                    </select>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Prioridade</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">ALTA</span>
                  </div>
                </div>
              </div>

              <TagManager 
                clientTags={client.tags} 
                allTags={allTags} 
                onToggleTag={(tagId) => {
                  const newTags = client.tags.includes(tagId) 
                    ? client.tags.filter(t => t !== tagId)
                    : [...client.tags, tagId];
                  onUpdateClient({ ...client, tags: newTags });
                }}
                onSaveTag={onSaveTag}
                onDeleteTag={onDeleteTag}
              />

              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Equipe Alocada</h4>
                <div className="flex flex-wrap gap-2">
                  {teamMembers.map(member => (
                    <div key={member.id} className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                      {member.photoUrl ? (
                        <img src={member.photoUrl} alt={member.name} className="w-5 h-5 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: `${member.color}33`, color: member.color }}>
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </div>
                      )}
                      <span className="text-[10px] text-gray-300">{member.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <section>
              <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-4">Situação Atual</h3>
              <textarea 
                value={client.situation}
                onChange={e => onUpdateClient({ ...client, situation: e.target.value })}
                className="w-full p-4 rounded-xl bg-white/5 border border-white/5 text-gray-300 leading-relaxed focus:outline-none focus:border-brand-primary/30 min-h-[100px] resize-none"
              />
            </section>

            {/* ── CRM DO CLIENTE ── */}
            <CrmClientSection clientId={client.id} clientName={client.name} onOpenCrm={(tenantId) => {
              onClose();
              if (onOpenClientCrm) onOpenClientCrm(tenantId);
            }} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <MultiSelect
                label="Plataformas"
                options={PLATFORM_OPTIONS}
                selected={client.platforms}
                onChange={val => onUpdateClient({ ...client, platforms: val })}
              />
              <MultiSelect 
                label="Funis Ativos" 
                options={FUNNEL_OPTIONS} 
                selected={client.funnels} 
                onChange={val => onUpdateClient({ ...client, funnels: val })} 
              />
            </div>

            <section>
              <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-4">Informações do Contrato</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-5 rounded-2xl bg-white/5 border border-white/5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Data de Entrada</p>
                  <input 
                    type="date" 
                    value={client.entryDate}
                    onChange={e => {
                      const newDate = e.target.value;
                      onUpdateClient({ 
                        ...client, 
                        entryDate: newDate,
                        monthlyMeetings: generateMeetings(newDate, client.contractDuration)
                      });
                    }}
                    className="bg-transparent text-sm font-bold text-white focus:outline-none w-full"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Duração</p>
                  <select 
                    value={client.contractDuration}
                    onChange={e => {
                      const duration = Number(e.target.value);
                      const date = new Date(client.entryDate);
                      date.setMonth(date.getMonth() + duration);
                      onUpdateClient({ 
                        ...client, 
                        contractDuration: duration,
                        exitDate: date.toISOString().split('T')[0],
                        monthlyMeetings: generateMeetings(client.entryDate, duration)
                      });
                    }}
                    className="bg-transparent text-sm font-bold text-white focus:outline-none w-full"
                  >
                    <option value={1} className="bg-bg-main">1 mês</option>
                    <option value={3} className="bg-bg-main">3 meses</option>
                    <option value={6} className="bg-bg-main">6 meses</option>
                    <option value={12} className="bg-bg-main">12 meses</option>
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Saída Prevista</p>
                  <p className="text-sm font-bold text-brand-primary">{client.exitDate}</p>
                </div>
              </div>
            </section>

            <OnboardingSection 
              checklist={client.onboardingChecklist} 
              onToggle={(id) => {
                const newList = client.onboardingChecklist.map(item => 
                  item.id === id ? { ...item, completed: !item.completed } : item
                );
                onUpdateClient({ ...client, onboardingChecklist: newList });
              }}
            />

            <MeetingsSection
              meetings={client.monthlyMeetings}
              onToggle={(id) => {
                const newList = client.monthlyMeetings.map(meeting =>
                  meeting.id === id ? {
                    ...meeting,
                    completed: !meeting.completed,
                    completionDate: !meeting.completed ? new Date().toLocaleDateString('pt-BR') : undefined,
                    transcriptionUrl: !meeting.completed ? meeting.transcriptionUrl : undefined
                  } : meeting
                );
                onUpdateClient({ ...client, monthlyMeetings: newList });
              }}
              onUpdateTranscription={(id, url) => {
                const newList = client.monthlyMeetings.map(meeting =>
                  meeting.id === id ? { ...meeting, transcriptionUrl: url } : meeting
                );
                onUpdateClient({ ...client, monthlyMeetings: newList });
              }}
              onUpdateActionItems={(id, items, summary) => {
                const newList = client.monthlyMeetings.map(meeting =>
                  meeting.id === id ? { ...meeting, actionItems: items, ...(summary !== undefined ? { meetingSummary: summary } : {}) } : meeting
                );
                onUpdateClient({ ...client, monthlyMeetings: newList });
              }}
            />

            <OfferSection 
              offers={client.offers} 
              onAddOffer={(off) => onUpdateClient({ ...client, offers: [{ ...off, id: Date.now().toString() }, ...client.offers] })}
              onRemoveOffer={(id) => onUpdateClient({ ...client, offers: client.offers.filter(o => o.id !== id) })}
            />

            <section>
              <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary mb-4">Documentos da Conta</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a href={client.docs.access} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-brand-primary/30 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                      <Users size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Acessos do Cliente</p>
                      <p className="text-[10px] text-gray-500">Google Docs</p>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-gray-600 group-hover:text-brand-primary" />
                </a>
                <a href={client.docs.transcription} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-brand-primary/30 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10 text-green-400">
                      <Clock size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Transcrição Onboarding</p>
                      <p className="text-[10px] text-gray-500">Google Docs</p>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-gray-600 group-hover:text-brand-primary" />
                </a>
              </div>
            </section>
          </div>

          {/* Right Col: Communication (Exclusive) */}
          <div className="lg:col-span-4 flex flex-col bg-bg-sidebar/20">
            <div className="flex flex-col min-h-0 p-6 h-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary">Comentários e Atividades</h3>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6 max-h-[60vh]">
                {client.comments.length > 0 ? client.comments.map(comment => (
                  <div key={comment.id} className="flex gap-3">
                    {(() => { const m = teamMembers.find(t => t.name === comment.author); return m?.photoUrl ? (
                      <img src={m.photoUrl} alt={m.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-white/5" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center text-[10px] font-bold border border-white/5">
                        {comment.author[0]}
                      </div>
                    ); })()}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-white">{comment.author}</span>
                        <span className="text-[9px] text-gray-500">{comment.date}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                        <p className="text-xs text-gray-400 leading-relaxed">{comment.text}</p>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <MessageSquare size={32} className="text-gray-700 mb-3" />
                    <p className="text-xs text-gray-500 italic">Nenhuma atividade registrada ainda.</p>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-white/5">
                <div className="flex gap-2 relative">
                  <input
                    type="text"
                    placeholder="Adicionar comentário... Use @ para mencionar"
                    value={newComment}
                    onChange={e => handleCommentChange(e.target.value)}
                    onKeyDown={e => {
                      if (showMentionDropdown && filteredMembers.length > 0) {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, filteredMembers.length - 1)); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); }
                        else if (e.key === 'Enter') { e.preventDefault(); insertMention(filteredMembers[mentionIndex]); }
                        else if (e.key === 'Escape') setShowMentionDropdown(false);
                      } else if (e.key === 'Enter') handleAddComment();
                    }}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-brand-primary transition-all"
                  />
                  {showMentionDropdown && filteredMembers.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-bg-sidebar border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                      <div className="p-2 border-b border-white/5">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1"><AtSign size={10} /> Mencionar colaborador</p>
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {filteredMembers.map((m, i) => (
                          <button
                            key={m.id}
                            onClick={() => insertMention(m)}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${i === mentionIndex ? 'bg-brand-primary/10 text-brand-primary' : 'text-gray-300 hover:bg-white/5'}`}
                          >
                            {m.photoUrl ? (
                              <img src={m.photoUrl} alt={m.name} className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: `${m.color}33`, color: m.color }}>
                                {m.name.split(' ').map(n => n[0]).join('')}
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-medium">{m.name}</p>
                              <p className="text-[9px] text-gray-500">{m.role}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={handleAddComment}
                    className="p-3 rounded-xl bg-brand-primary text-bg-main hover:scale-105 active:scale-95 transition-all shadow-glow"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const LoadingScreen = () => (
  <div className="fixed inset-0 z-[300] bg-bg-main flex flex-col items-center justify-center">
    <div className="w-16 h-16 border-4 border-brand-primary/20 border-t-brand-primary rounded-full animate-spin mb-4" />
    <p className="text-gray-500 text-sm font-bold uppercase tracking-widest animate-pulse">Carregando dados...</p>
  </div>
);


const ComercialView = ({ teamMembers, userSession, onOpenInCRM }: {
  teamMembers: TeamMember[],
  userSession: UserSession | null,
  onOpenInCRM?: (companyName: string) => void
}) => {
  const [selectedCollaborator, setSelectedCollaborator] = useState('');
  const [tasks, setTasks] = useState<ComercialTask[]>([]);
  const [viewingTask, setViewingTask] = useState<ComercialTask | null>(null);
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes' | 'custom'>('mes');
  const [customInicio, setCustomInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customFim, setCustomFim] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Load tasks from Supabase on mount
  useEffect(() => {
    getComercialTasks().then(setTasks).catch(console.error);
    if ((userSession?.role ?? '').toLowerCase() !== 'admin') {
      setSelectedCollaborator(userSession?.name ?? '');
    }
  }, []);

  const dateRange = useMemo(() => {
    const now = new Date();
    if (periodo === 'hoje') return { start: startOfDay(now), end: endOfDay(now) };
    if (periodo === 'semana') return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) };
    if (periodo === 'mes') return { start: startOfMonth(now), end: endOfDay(now) };
    return { start: startOfDay(parseISO(customInicio)), end: endOfDay(parseISO(customFim)) };
  }, [periodo, customInicio, customFim]);

  const filteredTasks = useMemo(() => {
    const isAdmin = (userSession?.role ?? '').toLowerCase() === 'admin';
    let filtered = tasks;
    if (!isAdmin) {
      filtered = filtered.filter(t => t.collaborator === (userSession?.name ?? ''));
    } else if (selectedCollaborator !== '' && selectedCollaborator !== 'all') {
      filtered = filtered.filter(t => t.collaborator === selectedCollaborator);
    }
    // Filter by date range
    filtered = filtered.filter(t => {
      try {
        const d = parseISO(t.createdAt);
        return d >= dateRange.start && d <= dateRange.end;
      } catch { return true; }
    });
    return filtered;
  }, [tasks, selectedCollaborator, userSession, dateRange]);

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;
    try {
      await deleteComercialTask(id);
      setTasks(tasks.filter(t => t.id !== id));
    } catch (err) {
      console.error('Erro ao deletar tarefa:', err);
      alert('Erro ao deletar. Verifique a conexão com o banco.');
    }
  };

  // Summary stats from tasks
  const summary = useMemo(() => {
    const src = filteredTasks;
    const ligacoes = src.filter(t => t.category === 'Ligação');
    const reunioes = src.filter(t => t.category === 'Reunião');
    const atendeu = ligacoes.filter(t => t.answered === 'Atendeu').length;
    const naoAtendeu = ligacoes.filter(t => t.answered === 'Não atendeu').length;
    const marcacoes = ligacoes.filter(t => t.scheduled).length;
    const compareceu = reunioes.filter(t => t.meetingStatus === 'Compareceu').length;
    const naoCompareceu = reunioes.filter(t => t.meetingStatus === 'Não compareceu').length;
    const vendas = reunioes.filter(t => t.saleStatus === 'Venda').length;
    const perdidos = reunioes.filter(t => t.saleStatus === 'Perdido').length;
    const r2 = reunioes.filter(t => t.saleStatus === 'Marcou R2+').length;
    const totalContrato = reunioes.reduce((acc, t) => acc + (t.contractValue ?? 0), 0);
    const totalCc = reunioes.reduce((acc, t) => acc + (t.cashCollect ?? 0), 0);
    return { ligacoes: ligacoes.length, reunioes: reunioes.length, atendeu, naoAtendeu, marcacoes, compareceu, naoCompareceu, vendas, perdidos, r2, totalContrato, totalCc };
  }, [filteredTasks]);

  // Metas editáveis para o funil comercial
  const [funilMetas, setFunilMetas] = useState<Record<string, number>>({});
  const [editFunilMeta, setEditFunilMeta] = useState<string | null>(null);
  const [editFunilVal, setEditFunilVal] = useState('');
  const isAdminComercial = (userSession?.role ?? '').toLowerCase() === 'admin';

  useEffect(() => {
    supabase.from('comercial_metas_funil').select('*').eq('id', 1).single()
      .then(({ data: d }) => { if (d) { const { id: _id, updated_at: _u, ...rest } = d as Record<string, unknown>; setFunilMetas(Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, Number(v) || 0]))); } });
  }, []);

  const saveFunilMeta = async (key: string, val: string) => {
    const n = parseFloat(val) || 0;
    const updated = { ...funilMetas, [key]: n };
    setFunilMetas(updated);
    await supabase.from('comercial_metas_funil').upsert({ id: 1, ...updated, updated_at: new Date().toISOString() });
    setEditFunilMeta(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatório</h1>
          <p className="text-gray-400 mt-1">Visão geral e histórico de atividades do time comercial.</p>
        </div>
      </div>

        <div className="space-y-8">
          {/* Filtros */}
          <div className="glass-card p-6 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-brand-primary whitespace-nowrap">Colaborador</label>
              <div className="relative min-w-[200px]">
                {(userSession?.role ?? '').toLowerCase() === 'admin' ? (
                  <>
                    <select
                      value={selectedCollaborator}
                      onChange={e => setSelectedCollaborator(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-primary transition-all appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-bg-main">TODOS</option>
                      {teamMembers.map(m => (
                        <option key={m.id} value={m.name} className="bg-bg-main">{m.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                  </>
                ) : (
                  <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white font-medium">
                    {userSession?.name ?? ''}
                  </div>
                )}
              </div>
            </div>

            <div className="h-8 w-px bg-white/10 hidden sm:block" />

            <div className="flex items-center gap-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-brand-primary whitespace-nowrap">Período</label>
              <div className="flex gap-1.5">
                {([['hoje', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês'], ['custom', 'Personalizado']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setPeriodo(key)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${
                      periodo === key
                        ? 'bg-brand-primary/15 border-brand-primary/40 text-brand-primary'
                        : 'bg-white/5 border-white/10 text-gray-500 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {key === 'custom' ? <Calendar size={13} /> : label}
                  </button>
                ))}
              </div>
              {periodo === 'custom' && (
                <div className="flex items-center gap-2">
                  <input type="date" value={customInicio} onChange={e => setCustomInicio(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand-primary" />
                  <span className="text-gray-600 text-xs">até</span>
                  <input type="date" value={customFim} onChange={e => setCustomFim(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-brand-primary" />
                </div>
              )}
            </div>
          </div>

          {/* Funis lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Funil Pré-vendas */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-blue-400 mb-5">Pré-vendas</h3>
              <div className="space-y-0">
                {(() => {
                  const stages = [
                    { key: 'pv_ligacoes', label: 'Ligações', value: summary.ligacoes, w: 100 },
                    { key: 'pv_atendeu', label: 'Atendeu', value: summary.atendeu, w: 80 },
                    { key: 'pv_marcacoes', label: 'Marcações', value: summary.marcacoes, w: 60 },
                  ];
                  return stages.map((e, i) => {
                    const next = i < stages.length - 1 ? stages[i + 1] : null;
                    const taxa = next && e.value > 0 ? (next.value / e.value) * 100 : null;
                    const metaKey = next?.key ?? e.key;
                    return (
                      <div key={e.key} className="space-y-0">
                        <div className="flex items-center" style={{ paddingLeft: `${(100 - e.w) / 2}%`, paddingRight: `${(100 - e.w) / 2}%` }}>
                          <div className="flex-1 bg-white/10 rounded-xl px-3 py-2.5 flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-300">{e.label}</span>
                            <span className="text-xl font-black text-white">{e.value}</span>
                          </div>
                        </div>
                        {taxa !== null && (
                          <div className="flex items-center justify-center gap-3 py-1.5">
                            <div className="flex-1 h-px bg-white/5" />
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-300">{taxa.toFixed(1)}%</span>
                              <span className="text-gray-600">|</span>
                              {editFunilMeta === metaKey ? (
                                <div className="flex items-center gap-1">
                                  <input autoFocus type="number" min="0" max="100" step="0.1"
                                    value={editFunilVal} onChange={ev => setEditFunilVal(ev.target.value)}
                                    onBlur={() => saveFunilMeta(metaKey, editFunilVal)}
                                    onKeyDown={ev => ev.key === 'Enter' && saveFunilMeta(metaKey, editFunilVal)}
                                    className="w-14 bg-white/10 border border-brand-primary rounded px-1 py-0.5 text-xs text-white text-center focus:outline-none"
                                  />
                                  <span className="text-xs text-gray-400">%</span>
                                </div>
                              ) : (
                                <span
                                  onClick={() => isAdminComercial ? (setEditFunilMeta(metaKey), setEditFunilVal(String(funilMetas[metaKey] || ''))) : null}
                                  className={`text-[10px] font-bold text-gray-500 ${isAdminComercial ? 'cursor-pointer hover:text-brand-primary transition-colors' : ''}`}
                                  title={isAdminComercial ? 'Clique para editar a meta' : ''}
                                >
                                  Meta: {funilMetas[metaKey] ? `${funilMetas[metaKey]}%` : '—'}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 h-px bg-white/5" />
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              {/* Extra: Não atendeu */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between px-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Não atendeu</span>
                <span className="text-lg font-bold text-red-400">{summary.naoAtendeu}</span>
              </div>
              {isAdminComercial && <p className="text-[9px] text-gray-600 mt-3 text-center">Clique em "Meta" para editar a taxa alvo</p>}
            </div>

            {/* Funil Vendas */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-purple-400 mb-5">Vendas</h3>
              <div className="space-y-0">
                {(() => {
                  const stages = [
                    { key: 'vd_reunioes', label: 'Reuniões', value: summary.reunioes, w: 100 },
                    { key: 'vd_compareceu', label: 'Compareceu', value: summary.compareceu, w: 75 },
                    { key: 'vd_vendas', label: 'Vendas', value: summary.vendas, w: 50 },
                  ];
                  return stages.map((e, i) => {
                    const next = i < stages.length - 1 ? stages[i + 1] : null;
                    const taxa = next && e.value > 0 ? (next.value / e.value) * 100 : null;
                    const metaKey = next?.key ?? e.key;
                    return (
                      <div key={e.key} className="space-y-0">
                        <div className="flex items-center" style={{ paddingLeft: `${(100 - e.w) / 2}%`, paddingRight: `${(100 - e.w) / 2}%` }}>
                          <div className="flex-1 bg-white/10 rounded-xl px-3 py-2.5 flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-300">{e.label}</span>
                            <span className="text-xl font-black text-white">{e.value}</span>
                          </div>
                        </div>
                        {taxa !== null && (
                          <div className="flex items-center justify-center gap-3 py-1.5">
                            <div className="flex-1 h-px bg-white/5" />
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-300">{taxa.toFixed(1)}%</span>
                              <span className="text-gray-600">|</span>
                              {editFunilMeta === metaKey ? (
                                <div className="flex items-center gap-1">
                                  <input autoFocus type="number" min="0" max="100" step="0.1"
                                    value={editFunilVal} onChange={ev => setEditFunilVal(ev.target.value)}
                                    onBlur={() => saveFunilMeta(metaKey, editFunilVal)}
                                    onKeyDown={ev => ev.key === 'Enter' && saveFunilMeta(metaKey, editFunilVal)}
                                    className="w-14 bg-white/10 border border-brand-primary rounded px-1 py-0.5 text-xs text-white text-center focus:outline-none"
                                  />
                                  <span className="text-xs text-gray-400">%</span>
                                </div>
                              ) : (
                                <span
                                  onClick={() => isAdminComercial ? (setEditFunilMeta(metaKey), setEditFunilVal(String(funilMetas[metaKey] || ''))) : null}
                                  className={`text-[10px] font-bold text-gray-500 ${isAdminComercial ? 'cursor-pointer hover:text-brand-primary transition-colors' : ''}`}
                                  title={isAdminComercial ? 'Clique para editar a meta' : ''}
                                >
                                  Meta: {funilMetas[metaKey] ? `${funilMetas[metaKey]}%` : '—'}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 h-px bg-white/5" />
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              {/* Extras: No-show, R2+, Perdidos */}
              <div className="mt-4 pt-3 border-t border-white/5 space-y-2 px-2">
                {[
                  { label: 'No-show', value: summary.naoCompareceu, color: 'text-red-400' },
                  { label: 'Marcou R2+', value: summary.r2, color: 'text-blue-400' },
                  { label: 'Perdidos', value: summary.perdidos, color: 'text-red-400' },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{s.label}</span>
                    <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </div>
              {isAdminComercial && <p className="text-[9px] text-gray-600 mt-3 text-center">Clique em "Meta" para editar a taxa alvo</p>}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-brand-primary">Histórico de Atividades</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTasks.map(task => (
                <motion.div 
                  key={task.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card overflow-hidden group border border-white/5 hover:border-brand-primary/20"
                >
                  <div className="aspect-video w-full relative overflow-hidden bg-bg-sidebar cursor-pointer" onClick={() => task.imageUrl && setLightboxUrl(task.imageUrl)}>
                    {task.imageUrl ? (
                      <img src={task.imageUrl} alt="Print" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/5">
                        <ImageOff size={32} className="text-gray-700" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-bg-main/90 via-bg-main/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-4">
                      {(userSession?.role ?? '').toLowerCase() === 'admin' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                          className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all backdrop-blur-sm"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      {(userSession?.role ?? '').toLowerCase() !== 'admin' && <div />}
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/20 border border-brand-primary/30 backdrop-blur-md">
                            <Clock size={12} className="text-brand-primary" />
                            <span className="text-[10px] font-bold text-brand-primary">{task.completionTime}</span>
                          </div>
                          <div className="px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-[8px] font-bold uppercase tracking-widest text-white">
                            {task.category}
                          </div>
                          <div className={`px-3 py-1 rounded-full border backdrop-blur-md text-[8px] font-bold uppercase tracking-widest ${
                            task.type === 'PreVendas' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-purple-500/20 border-purple-500/30 text-purple-400'
                          }`}>
                            {task.type === 'PreVendas' ? 'PRÉ-VENDAS' : 'VENDAS'}
                          </div>
                          {task.answered && (
                            <div className={`px-3 py-1 rounded-full border backdrop-blur-md text-[8px] font-bold uppercase tracking-widest ${
                              task.answered === 'Atendeu' ? 'bg-brand-primary/20 border-brand-primary/30 text-brand-primary' : 'bg-red-500/20 border-red-500/30 text-red-400'
                            }`}>
                              {task.answered}
                            </div>
                          )}
                          {task.touchpoint && (
                            <div className="px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-[8px] font-bold uppercase tracking-widest text-white">
                              Touchpoint: {task.touchpoint}
                            </div>
                          )}
                          {task.meetingStatus && (
                            <div className={`px-3 py-1 rounded-full border backdrop-blur-md text-[8px] font-bold uppercase tracking-widest ${
                              task.meetingStatus === 'Compareceu' ? 'bg-brand-primary/20 border-brand-primary/30 text-brand-primary' : 'bg-red-500/20 border-red-500/30 text-red-400'
                            }`}>
                              {task.meetingStatus}
                            </div>
                          )}
                          {task.scheduled && (
                            <div className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 backdrop-blur-md text-[8px] font-bold uppercase tracking-widest text-blue-400 flex items-center gap-1">
                              <Calendar size={10} /> Marcado
                            </div>
                          )}
                          {task.saleStatus && (
                            <div className={`px-3 py-1 rounded-full border backdrop-blur-md text-[8px] font-bold uppercase tracking-widest ${
                              task.saleStatus === 'Venda' ? 'bg-brand-primary/20 border-brand-primary/30 text-brand-primary' :
                              task.saleStatus === 'Marcou R2+' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' :
                              'bg-red-500/20 border-red-500/30 text-red-400'
                            }`}>
                              {task.saleStatus}
                            </div>
                          )}
                        </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3 bg-bg-card/50">
                    <div className="flex justify-between items-center">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                        {task.collaborator}
                      </div>
                      <div className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter">
                        ID: {task.id.split('-')[1]}
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-white/5 space-y-2">
                        {/* Ligação info */}
                        {task.category === 'Ligação' && (
                          <>
                            {task.answered && (
                              <div className="flex justify-between text-[10px]">
                                <span className="text-gray-500 uppercase font-bold">Status:</span>
                                <span className={task.answered === 'Atendeu' ? 'text-brand-primary font-bold' : 'text-red-400 font-bold'}>{task.answered}</span>
                              </div>
                            )}
                            {task.touchpoint !== undefined && (
                              <div className="flex justify-between text-[10px]">
                                <span className="text-gray-500 uppercase font-bold">Touchpoint:</span>
                                <span className="text-white font-bold">{task.touchpoint}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-[10px]">
                              <span className="text-gray-500 uppercase font-bold">Marcou reunião:</span>
                              <span className={task.scheduled ? 'text-brand-primary font-bold' : 'text-red-400 font-bold'}>
                                {task.scheduled ? 'Sim' : 'Não'}
                              </span>
                            </div>
                          </>
                        )}
                        {/* Reunião info */}
                        {task.category !== 'Ligação' && (
                          <>
                            {task.meetingStatus && (
                              <div className="flex justify-between text-[10px]">
                                <span className="text-gray-500 uppercase font-bold">Status:</span>
                                <span className={task.meetingStatus === 'Compareceu' ? 'text-brand-primary font-bold' : 'text-red-400 font-bold'}>{task.meetingStatus}</span>
                              </div>
                            )}
                            {task.saleStatus && (
                              <div className="flex justify-between text-[10px]">
                                <span className="text-gray-500 uppercase font-bold">Resultado:</span>
                                <span className={
                                  task.saleStatus === 'Venda' ? 'text-brand-primary font-bold' :
                                  task.saleStatus === 'Marcou R2+' ? 'text-blue-400 font-bold' :
                                  'text-red-400 font-bold'
                                }>{task.saleStatus}</span>
                              </div>
                            )}
                            {task.responsibleName && (
                              <div className="flex justify-between text-[10px]">
                                <span className="text-gray-500 uppercase font-bold">Responsável:</span>
                                <span className="text-white font-medium">{task.responsibleName}</span>
                              </div>
                            )}
                            {task.contractValue != null && (
                              <div className="flex justify-between text-[10px]">
                                <span className="text-gray-500 uppercase font-bold">Contrato:</span>
                                <span className="text-brand-primary font-bold">R$ {(task.contractValue ?? 0).toLocaleString()}</span>
                              </div>
                            )}
                            {task.cashCollect != null && (
                              <div className="flex justify-between text-[10px]">
                                <span className="text-gray-500 uppercase font-bold">Cash:</span>
                                <span className="text-brand-primary font-bold">R$ {(task.cashCollect ?? 0).toLocaleString()}</span>
                              </div>
                            )}
                            {task.nextMeetingDate && (
                              <div className="flex justify-between text-[10px]">
                                <span className="text-gray-500 uppercase font-bold">Próxima R2:</span>
                                <span className="text-blue-400 font-bold">{format(parseISO(task.nextMeetingDate), 'dd/MM HH:mm')}</span>
                              </div>
                            )}
                            {task.lossReason && (
                              <div className="text-[10px]">
                                <span className="text-red-400 uppercase font-bold block mb-1">Motivo Perda:</span>
                                <p className="text-gray-400 italic line-clamp-2">{task.lossReason}</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                    <div className="flex justify-between items-center mt-1">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{formatDate(task.createdAt)}</p>
                      {task.companyName && onOpenInCRM && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenInCRM(task.companyName!); }}
                          className="flex items-center gap-1 text-[9px] text-gray-500 hover:text-brand-primary transition-colors"
                          title="Ver no CRM"
                        >
                          <ExternalLink size={10} /> CRM
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
              {filteredTasks.length === 0 && (
                <div className="col-span-full py-20 text-center glass-card border-dashed border-2 border-white/5">
                  <AlertTriangle size={48} className="text-gray-800 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Nenhuma atividade registrada ainda.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Lightbox — imagem em tela cheia */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer"
            onClick={() => setLightboxUrl(null)}
          >
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              src={lightboxUrl} alt="Print completo"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task detail modal */}
      <AnimatePresence>
        {viewingTask && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setViewingTask(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="bg-bg-card border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Image */}
              <div className="relative w-full bg-black/40">
                {viewingTask.imageUrl ? (
                  <img src={viewingTask.imageUrl} alt="Print da atividade" className="w-full max-h-[50vh] object-contain" />
                ) : (
                  <div className="w-full h-48 flex items-center justify-center bg-white/5">
                    <ImageOff size={48} className="text-gray-700" />
                  </div>
                )}
                <button
                  onClick={() => setViewingTask(null)}
                  className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Details */}
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-brand-primary" />
                    <span className="text-sm font-bold text-white">{viewingTask.collaborator}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      viewingTask.type === 'PreVendas' ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400' : 'bg-purple-500/20 border border-purple-500/30 text-purple-400'
                    }`}>
                      {viewingTask.type === 'PreVendas' ? 'Pré-Vendas' : 'Vendas'}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] font-bold uppercase tracking-widest text-white">
                      {viewingTask.category}
                    </span>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4 grid grid-cols-2 gap-3">
                  <div className="flex justify-between text-xs col-span-2">
                    <span className="text-gray-500 uppercase font-bold">Horário:</span>
                    <span className="text-brand-primary font-bold">{viewingTask.completionTime}</span>
                  </div>
                  <div className="flex justify-between text-xs col-span-2">
                    <span className="text-gray-500 uppercase font-bold">Data:</span>
                    <span className="text-white font-bold">{formatDate(viewingTask.createdAt)}</span>
                  </div>

                  {viewingTask.category === 'Ligação' && (
                    <>
                      {viewingTask.answered && (
                        <div className="flex justify-between text-xs col-span-2">
                          <span className="text-gray-500 uppercase font-bold">Status:</span>
                          <span className={viewingTask.answered === 'Atendeu' ? 'text-brand-primary font-bold' : 'text-red-400 font-bold'}>{viewingTask.answered}</span>
                        </div>
                      )}
                      {viewingTask.touchpoint != null && (
                        <div className="flex justify-between text-xs col-span-2">
                          <span className="text-gray-500 uppercase font-bold">Touchpoint:</span>
                          <span className="text-white font-bold">{viewingTask.touchpoint}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs col-span-2">
                        <span className="text-gray-500 uppercase font-bold">Marcou reunião:</span>
                        <span className={viewingTask.scheduled ? 'text-brand-primary font-bold' : 'text-red-400 font-bold'}>
                          {viewingTask.scheduled ? 'Sim' : 'Não'}
                        </span>
                      </div>
                    </>
                  )}

                  {viewingTask.category !== 'Ligação' && (
                    <>
                      {viewingTask.meetingStatus && (
                        <div className="flex justify-between text-xs col-span-2">
                          <span className="text-gray-500 uppercase font-bold">Status:</span>
                          <span className={viewingTask.meetingStatus === 'Compareceu' ? 'text-brand-primary font-bold' : 'text-red-400 font-bold'}>{viewingTask.meetingStatus}</span>
                        </div>
                      )}
                      {viewingTask.saleStatus && (
                        <div className="flex justify-between text-xs col-span-2">
                          <span className="text-gray-500 uppercase font-bold">Resultado:</span>
                          <span className={
                            viewingTask.saleStatus === 'Venda' ? 'text-brand-primary font-bold' :
                            viewingTask.saleStatus === 'Marcou R2+' ? 'text-blue-400 font-bold' :
                            'text-red-400 font-bold'
                          }>{viewingTask.saleStatus}</span>
                        </div>
                      )}
                      {viewingTask.responsibleName && (
                        <div className="flex justify-between text-xs col-span-2">
                          <span className="text-gray-500 uppercase font-bold">Responsável:</span>
                          <span className="text-white font-medium">{viewingTask.responsibleName}</span>
                        </div>
                      )}
                      {viewingTask.contractValue != null && (
                        <div className="flex justify-between text-xs col-span-2">
                          <span className="text-gray-500 uppercase font-bold">Contrato:</span>
                          <span className="text-brand-primary font-bold">R$ {(viewingTask.contractValue ?? 0).toLocaleString()}</span>
                        </div>
                      )}
                      {viewingTask.cashCollect != null && (
                        <div className="flex justify-between text-xs col-span-2">
                          <span className="text-gray-500 uppercase font-bold">Cash Collect:</span>
                          <span className="text-brand-primary font-bold">R$ {(viewingTask.cashCollect ?? 0).toLocaleString()}</span>
                        </div>
                      )}
                      {viewingTask.nextMeetingDate && (
                        <div className="flex justify-between text-xs col-span-2">
                          <span className="text-gray-500 uppercase font-bold">Próxima Reunião:</span>
                          <span className="text-blue-400 font-bold">{format(parseISO(viewingTask.nextMeetingDate), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                      )}
                      {viewingTask.companyName && (
                        <div className="flex justify-between text-xs col-span-2">
                          <span className="text-gray-500 uppercase font-bold">Empresa:</span>
                          <span className="text-white font-medium">{viewingTask.companyName}</span>
                        </div>
                      )}
                      {viewingTask.lossReason && (
                        <div className="text-xs col-span-2">
                          <span className="text-red-400 uppercase font-bold block mb-1">Motivo Perda:</span>
                          <p className="text-gray-400 italic">{viewingTask.lossReason}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-white/5">
                  <span className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">ID: {viewingTask.id.split('-')[1]}</span>
                  {viewingTask.companyName && onOpenInCRM && (
                    <button
                      onClick={() => { onOpenInCRM(viewingTask.companyName!); setViewingTask(null); }}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-primary transition-colors"
                    >
                      <ExternalLink size={12} /> Ver no CRM
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedCrmTenantId, setSelectedCrmTenantId] = useState<string | null>(null);
  const [cookiesAccepted, setCookiesAccepted] = useState(() => localStorage.getItem('cookies_accepted') === 'true');

  // Role-based permission helper
  const canSee = (tab: string): boolean => {
    const role = (userSession?.role ?? '').toLowerCase();
    const permissions: Record<string, string[]> = {
      'admin':     ['Dashboard', 'Clientes', 'Kanban de Operação', 'Equipe', 'Demandas', 'Área do Cliente', 'Relatórios', 'Educação', 'Aquisição', 'Entrega', 'Playbooks', 'Configurações'],
      'comercial': ['Demandas', 'Educação', 'Aquisição', 'Playbooks'],
      'suporte':   ['Clientes', 'Kanban de Operação', 'Demandas', 'Área do Cliente', 'Relatórios', 'Educação', 'Entrega', 'Playbooks'],
      'entrega':   ['Clientes', 'Kanban de Operação', 'Demandas', 'Área do Cliente', 'Relatórios', 'Educação', 'Entrega', 'Playbooks'],
    };
    return (permissions[role] ?? permissions['admin']).includes(tab);
  };
  const [aquisicaoSubTab, setAquisicaoSubTab] = useState<'CRM' | 'Relatorio' | 'Dashboard' | 'Playbooks'>('CRM');
  const [entregaSubTab, setEntregaSubTab] = useState<'Kanban' | 'Demandas' | 'AreaCliente' | 'Educacao'>('Kanban');
  const [openCRMLeadName, setOpenCRMLeadName] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [allTags, setAllTags] = useState<Record<string, Tag>>(INITIAL_TAGS);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(INITIAL_TEAM_MEMBERS);
  const [agencyConfig, setAgencyConfig] = useState<AgencyConfig>(INITIAL_AGENCY_CONFIG);
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [crmClientSession, setCrmClientSession] = useState<{ user: CrmClientUser; tenant: CrmClientTenant } | null>(null);
  const [clientTab, setClientTab] = useState<'crm' | 'educacao' | 'materiais' | 'documentos'>('crm');
  const [showConsultorChat, setShowConsultorChat] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [demands, setDemands] = useState<Demand[]>([]);
  const [demandFilter, setDemandFilter] = useState<'todos' | 'pendente' | 'concluido'>('pendente');
  const [demandPriorityFilter, setDemandPriorityFilter] = useState<'todas' | 'alta' | 'media' | 'baixa'>('todas');
  const [deletingDemandId, setDeletingDemandId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportText, setSupportText] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [kanbanFilters, setKanbanFilters] = useState({ plans: [] as string[], responsible: 'all', status: 'Ativo' });

  // --- Global Task Alarm System ---
  const [tarefaAlarme, setTarefaAlarme] = useState<any>(null);
  const notificadosRef = useRef<Set<string>>(new Set());

  const playAlarm = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.3 + 0.2);
        osc.start(ctx.currentTime + i * 0.3);
        osc.stop(ctx.currentTime + i * 0.3 + 0.2);
      }
    } catch (e) { console.warn('[alarm]', e); }
  };

  useEffect(() => {
    if (!userSession) return;
    const userName = userSession.name || '';

    const checkTarefas = async () => {
      try {
        const agora = new Date();
        const daquiUmMinuto = new Date(agora.getTime() + 60000);

        const { data } = await supabase
          .from('crm_tarefas')
          .select('id, titulo, lead_id, data_agendada, responsavel, tipo')
          .eq('concluida', false)
          .eq('responsavel', userName)
          .lte('data_agendada', daquiUmMinuto.toISOString())
          .order('data_agendada', { ascending: true })
          .limit(5);

        if (data && data.length > 0) {
          for (const tarefa of data) {
            if (notificadosRef.current.has(tarefa.id)) continue;
            notificadosRef.current.add(tarefa.id);
            setTarefaAlarme(tarefa);
            playAlarm();
            break;
          }
        }
      } catch (e) { console.warn('[check tarefas]', e); }
    };

    checkTarefas();
    const interval = setInterval(checkTarefas, 30000);
    return () => clearInterval(interval);
  }, [userSession]);

  // Inject pulse animation for alarm
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `@keyframes alarmPulse { 0%, 100% { border-color: #d4af37; box-shadow: 0 4px 24px rgba(0,0,0,0.5); } 50% { border-color: #f0d060; box-shadow: 0 4px 32px rgba(212,175,55,0.3); } }`;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // --- Persistence ---
  useEffect(() => {
    const loadData = async () => {
      // Only show loading on initial mount
      if (!userSession && isLoading) setIsLoading(true);
      
      try {
        const [dbClients, dbTags, dbTeam, dbConfig, dbDemands] = await Promise.all([
          getClients(),
          getTags(),
          getTeamMembers(),
          getAgencyConfig(),
          getDemands()
        ]);
        setDemands(dbDemands);

        if (dbClients.length > 0) {
          setClients(dbClients);
        } else if (!userSession) {
          // Only show mock data if not logged in and no data found
          setClients(MOCK_CLIENTS);
        }

        if (dbTags.length > 0) {
          const tagsRecord = dbTags.reduce((acc, tag) => ({ ...acc, [tag.id]: tag }), {});
          setAllTags(tagsRecord);
        }
        
        if (dbTeam.length > 0) setTeamMembers(dbTeam);
        
        if (dbConfig) {
          // Migration: Update old name to new name if detected
          if (dbConfig.name.toUpperCase() === 'CLIENTOPS BLACK') {
            const updatedConfig = { ...dbConfig, name: 'HUB M2 BLACK' };
            setAgencyConfig(updatedConfig);
            updateAgencyConfig(updatedConfig).catch(err => console.error('Error migrating agency name:', err));
          } else {
            setAgencyConfig(dbConfig);
          }
        }

        // Restore session if not already set
        if (!userSession && !crmClientSession) {
          const savedSession = localStorage.getItem('hubm2black_session');
          if (savedSession) {
            setUserSession(JSON.parse(savedSession));
          }
          const savedCrmSession = localStorage.getItem('crmClientSession');
          if (savedCrmSession) {
            setCrmClientSession(JSON.parse(savedCrmSession));
          }
        }
      } catch (error) {
        console.error('Error loading data from Supabase:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [userSession]);

  useEffect(() => {
    if (userSession) {
      localStorage.setItem('hubm2black_session', JSON.stringify(userSession));
      const role = (userSession.role ?? '').toLowerCase();
      if (role === 'comercial') {
        setActiveTab('Aquisição');
        setAquisicaoSubTab('CRM');
      } else if (['suporte', 'entrega'].includes(role)) {
        setActiveTab('Clientes');
      }
    } else {
      localStorage.removeItem('hubm2black_session');
    }
  }, [userSession]);

  // --- Auto-generate Notifications ---
  useEffect(() => {
    const newNotifications: Notification[] = [];
    clients.forEach(c => {
      const completed = c.onboardingChecklist.filter(i => i.completed).length;
      const progress = (completed / c.onboardingChecklist.length) * 100;
      
      if (progress < 50 && c.status === 'Onboarding') {
        newNotifications.push({
          id: `notif-ob-${c.id}`,
          title: 'Onboarding Atrasado',
          message: `O cliente ${c.name} está com menos de 50% do checklist concluído.`,
          type: 'alert',
          date: formatDate(new Date().toISOString()),
          read: false
        });
      }

      const nextMeeting = c.monthlyMeetings.find(m => !m.completed);
      if (nextMeeting && nextMeeting.month === format(new Date(), 'MMMM', { locale: ptBR })) {
        newNotifications.push({
          id: `notif-meet-${c.id}`,
          title: 'Reunião Próxima',
          message: `Reunião mensal de ${nextMeeting.month} com ${c.name} pendente.`,
          type: 'info',
          date: formatDate(new Date().toISOString()),
          read: false
        });
      }
    });
    setNotifications(newNotifications);
  }, [clients]);

  // --- Global Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const selectedClient = useMemo(() => 
    clients.find(c => c.id === selectedClientId) || null
  , [clients, selectedClientId]);

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPlan = kanbanFilters.plans.length === 0 || kanbanFilters.plans.includes(c.plan.toUpperCase());
      const matchesResponsible = kanbanFilters.responsible === 'all' || c.responsible === kanbanFilters.responsible;
      const matchesStatus = kanbanFilters.status === 'Ativo' ? c.isActive : !c.isActive;
      return matchesSearch && matchesPlan && matchesResponsible && matchesStatus;
    });
  }, [clients, searchQuery, kanbanFilters]);

  const handleUpdateClient = async (updated: Client, oldName?: string) => {
    try {
      const result = await updateClient(updated);
      setClients(clients.map(c => c.id === result.id ? result : c));

      // Atualizar nome do cliente nas demandas existentes
      if (oldName && oldName !== updated.name) {
        const affectedDemands = demands.filter(d => d.clientId === updated.id);
        for (const d of affectedDemands) {
          const updatedDemand = { ...d, clientName: updated.name };
          const saved = await updateDemand(updatedDemand);
          setDemands(prev => prev.map(dd => dd.id === saved.id ? saved : dd));
        }
      }
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Erro ao atualizar cliente no banco de dados.');
    }
  };

  const handleSaveTeamMember = async (memberData: Partial<TeamMember>) => {
    try {
      if (editingMember) {
        const updated = await updateTeamMember({ ...editingMember, ...memberData } as TeamMember);
        setTeamMembers(teamMembers.map(m => m.id === updated.id ? updated : m));
      } else {
        const created = await createTeamMember(memberData as TeamMember);
        setTeamMembers([...teamMembers, created]);
      }
    } catch (error) {
      console.error('Error saving team member:', error);
      alert('Erro ao salvar membro da equipe.');
    }
  };

  const handleDeleteTeamMember = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este membro?')) return;
    try {
      await deleteTeamMember(id);
      setTeamMembers(teamMembers.filter(m => m.id !== id));
    } catch (error) {
      console.error('Error deleting team member:', error);
      alert('Erro ao remover membro da equipe.');
    }
  };

  const handleCreateClient = async (data: Partial<Client>) => {
    const newClient: Client = {
      id: Date.now().toString(),
      name: data.name || 'Novo Cliente',
      plan: data.plan || 'Lite',
      responsible: data.responsible || 'Thalisson',
      status: 'Onboarding',
      tags: [],
      platforms: [],
      funnels: [],
      situation: 'Novo cliente adicionado ao sistema.',
      docs: { 
        access: (data as any).docsAccess || '', 
        transcription: (data as any).docsTranscription || '' 
      },
      comments: [],
      offers: [],
      onboardingChecklist: DEFAULT_ONBOARDING_ITEMS.map((label, i) => ({
        id: `ob-${i}-${Date.now()}`,
        label,
        completed: false
      })),
      monthlyMeetings: generateMeetings(
        data.entryDate || new Date().toISOString().split('T')[0],
        data.contractDuration || 3
      ),
      entryDate: data.entryDate || new Date().toISOString().split('T')[0],
      contractDuration: data.contractDuration || 3,
      exitDate: data.exitDate || '',
      isActive: true
    };
    
    try {
      const created = await createClient(newClient);
      setClients([created, ...clients]);
    } catch (error) {
      console.error('Error creating client:', error);
      alert('Erro ao criar cliente no banco de dados.');
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const activeClients = clients.filter(c => c.isActive);
    const monthlyRevenue = activeClients.reduce((acc, c) => acc + (agencyConfig.planPricing[c.plan] || 0), 0);

    doc.setFontSize(20);
    doc.text(`Relatório ${agencyConfig.name}`, 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Data: ${formatDate(new Date().toISOString())}`, 14, 32);
    doc.text(`Total de Clientes: ${clients.length}`, 14, 40);
    doc.text(`Receita Mensal: R$ ${monthlyRevenue.toLocaleString()}`, 14, 48);

    const tableData = clients.map(c => [
      c.name,
      c.responsible,
      c.plan,
      formatDate(c.entryDate),
      c.status,
      c.isActive ? 'Ativo' : 'Inativo'
    ]);

    (doc as any).autoTable({
      head: [['Empresa', 'Responsável', 'Plano', 'Entrada', 'Status', 'Situação']],
      body: tableData,
      startY: 60,
      theme: 'grid',
      headStyles: { fillColor: [0, 255, 136], textColor: [10, 10, 10] }
    });

    doc.save(`relatorio-hubm2black-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const revenueChartData = useMemo(() => {
    const months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date()
    });

    return months.map(month => {
      const monthStr = format(month, 'yyyy-MM');
      const clientsInMonth = clients.filter(c => {
        const entry = parseISO(c.entryDate);
        const exit = c.exitDate ? parseISO(c.exitDate) : null;
        return entry <= endOfMonth(month) && (!exit || exit >= startOfMonth(month));
      });

      const revenue = clientsInMonth.reduce((acc, c) => acc + (agencyConfig.planPricing[c.plan] || 0), 0);
      
      return {
        name: format(month, 'MMM', { locale: ptBR }),
        receita: revenue
      };
    });
  }, [clients, agencyConfig]);

  const planDistributionData = useMemo(() => {
    const active = clients.filter(c => c.isActive);
    return [
      { label: 'Pro', count: active.filter(c => c.plan === 'Pro').length, color: 'bg-purple-500' },
      { label: 'Basic', count: active.filter(c => c.plan === 'Basic').length, color: 'bg-blue-500' },
      { label: 'Lite', count: active.filter(c => c.plan === 'Lite').length, color: 'bg-gray-500' },
    ];
  }, [clients]);

  const handleSaveTag = async (tag: Tag) => {
    try {
      const saved = await saveTag(tag);
      setAllTags({ ...allTags, [saved.id]: saved });
    } catch (error) {
      console.error('Error saving tag:', error);
      alert('Erro ao salvar etiqueta.');
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta etiqueta?')) return;
    try {
      await deleteTag(id);
      const next = { ...allTags };
      delete next[id];
      setAllTags(next);
    } catch (error) {
      console.error('Error deleting tag:', error);
      alert('Erro ao excluir etiqueta.');
    }
  };

  if (isLoading && !crmClientSession) return <LoadingScreen />;

  if (!userSession && !crmClientSession) {
    return <LoginScreen
      onLogin={(u) => { setUserSession(u); localStorage.setItem('hubm2black_session', JSON.stringify(u)); }}
      onCrmLogin={(user, tenant) => {
        setCrmClientSession({ user, tenant });
        setIsLoading(false);
        localStorage.setItem('crmClientSession', JSON.stringify({ user, tenant }));
      }}
      teamMembers={teamMembers}
      agencyConfig={agencyConfig}
    />;
  }

  // Se é um cliente CRM, mostra apenas o CRM dele
  if (crmClientSession) {
    return (
      <div className="min-h-screen bg-bg-main flex flex-col">
        {/* Header para cliente */}
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            {agencyConfig.logoUrl && (
              <img src={agencyConfig.logoUrl} alt="" className="w-8 h-8 rounded-lg" referrerPolicy="no-referrer" />
            )}
            <span className="text-white font-bold">{agencyConfig.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setClientTab('crm')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${clientTab === 'crm' ? 'bg-brand-primary/10 text-brand-primary' : 'text-white/40 hover:text-white/60'}`}>CRM</button>
            <button onClick={() => setClientTab('materiais')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${clientTab === 'materiais' ? 'bg-brand-primary/10 text-brand-primary' : 'text-white/40 hover:text-white/60'}`}>Materiais</button>
            <button onClick={() => setClientTab('documentos')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${clientTab === 'documentos' ? 'bg-brand-primary/10 text-brand-primary' : 'text-white/40 hover:text-white/60'}`}>Documentos</button>
            <button onClick={() => setClientTab('educacao')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${clientTab === 'educacao' ? 'bg-brand-primary/10 text-brand-primary' : 'text-white/40 hover:text-white/60'}`}>Educação</button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{crmClientSession.user.nome}</span>
            <button onClick={() => { signOut(); setCrmClientSession(null); localStorage.removeItem('crmClientSession'); }}
              className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"><LogOut size={14} /> Sair</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {clientTab === 'crm' && <ClientCRMView tenantId={crmClientSession.tenant.id} userName={crmClientSession.user.nome} />}
          {clientTab === 'materiais' && <MateriaisClienteView tenantId={crmClientSession.tenant.id} />}
          {clientTab === 'documentos' && <DocumentosClienteView tenantId={crmClientSession.tenant.id} />}
          {clientTab === 'educacao' && <EducacaoView userEmail={crmClientSession.user.email} isAdmin={false} />}
        </div>

        {/* Botão flutuante do Consultor IA */}
        <AnimatePresence>
          {!showConsultorChat && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-6 right-6 z-50 flex items-end gap-3"
            >
              {/* Balão de fala */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="bg-white rounded-2xl rounded-br-sm px-4 py-3 shadow-xl max-w-[200px] cursor-pointer"
                onClick={() => setShowConsultorChat(true)}
              >
                <p className="text-gray-800 text-sm font-medium leading-snug">Com problemas comerciais? Posso te ajudar! 💬</p>
              </motion.div>
              {/* Avatar pulsante */}
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowConsultorChat(true)}
                className="relative w-16 h-16 rounded-full shadow-2xl shadow-brand-primary/40 overflow-hidden flex-shrink-0"
              >
                <span className="absolute inset-0 rounded-full border-2 border-brand-primary animate-ping opacity-30" />
                <img src="/consultor-avatar.jpg" alt="Taleco" className="w-full h-full object-cover relative z-10" />
                <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-brand-primary rounded-full border-2 border-[#0a0f1e] z-20" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Painel lateral do Consultor IA */}
        <AnimatePresence>
          {showConsultorChat && (
            <>
              {/* Backdrop semi-transparente */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-40"
                onClick={() => setShowConsultorChat(false)}
              />
              {/* Painel */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="fixed top-0 right-0 h-full w-full sm:w-[440px] bg-[#0a0f1e] border-l border-white/10 shadow-2xl shadow-black/60 z-50 flex flex-col overflow-hidden"
              >
                <ConsultorIAView
                  tenantId={crmClientSession.tenant.id}
                  userName={crmClientSession.user.nome}
                  onClose={() => setShowConsultorChat(false)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const renderDemandas = () => {
    const myName = userSession?.name ?? '';
    const filtered = demands.filter(d => {
      // Mostra: demandas atribuídas a mim OU criadas por mim
      if (d.assignedName !== myName && d.commentAuthor !== myName) return false;
      if (demandFilter !== 'todos' && d.status !== demandFilter) return false;
      if (demandPriorityFilter !== 'todas' && d.priority !== demandPriorityFilter) return false;
      return true;
    });

    const priorityColors = { alta: 'text-red-400 bg-red-500/10 border-red-500/20', media: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', baixa: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    const priorityLabels = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Demandas</h1>
          <p className="text-gray-400 mt-1">Tarefas geradas a partir de menções nos comentários dos clientes.</p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
            {(['pendente', 'concluido', 'todos'] as const).map(f => (
              <button key={f} onClick={() => setDemandFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${demandFilter === f ? 'bg-brand-primary/20 text-brand-primary' : 'text-gray-400 hover:text-white'}`}
              >{f === 'pendente' ? 'Pendentes' : f === 'concluido' ? 'Concluídos' : 'Todos'}</button>
            ))}
          </div>
          <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
            {(['todas', 'alta', 'media', 'baixa'] as const).map(p => (
              <button key={p} onClick={() => setDemandPriorityFilter(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${demandPriorityFilter === p ? 'bg-brand-primary/20 text-brand-primary' : 'text-gray-400 hover:text-white'}`}
              >{p === 'todas' ? 'Todas' : priorityLabels[p]}</button>
            ))}
          </div>
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <ClipboardList size={48} className="mb-4 opacity-30" />
            <p className="font-medium">Nenhuma demanda {demandFilter === 'pendente' ? 'pendente' : demandFilter === 'concluido' ? 'concluída' : ''}</p>
            <p className="text-sm mt-1">Mencione @colaborador nos comentários para criar demandas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(demand => (
              <motion.div
                key={demand.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-xl border transition-all ${demand.status === 'concluido' ? 'bg-white/[0.02] border-white/5 opacity-60' : 'glass-card'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-bold text-brand-primary">{demand.clientName}</span>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${priorityColors[demand.priority]}`}>
                        {priorityLabels[demand.priority]}
                      </span>
                    </div>
                    <p className={`text-sm ${demand.status === 'concluido' ? 'line-through text-gray-600' : 'text-white'}`}>{demand.text}</p>
                    <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
                      <span>Para: <strong className="text-gray-300">{demand.assignedName}</strong></span>
                      <span>Por: {demand.commentAuthor}</span>
                      <span>{new Date(demand.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Prioridade */}
                    <select
                      value={demand.priority}
                      onChange={async (e) => {
                        const updated = { ...demand, priority: e.target.value as Demand['priority'] };
                        const saved = await updateDemand(updated);
                        setDemands(prev => prev.map(d => d.id === saved.id ? saved : d));
                      }}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-gray-300 focus:outline-none"
                    >
                      <option value="alta">Alta</option>
                      <option value="media">Média</option>
                      <option value="baixa">Baixa</option>
                    </select>
                    {/* Botão concluir */}
                    <button
                      onClick={async () => {
                        const updated = { ...demand, status: demand.status === 'pendente' ? 'concluido' as const : 'pendente' as const };
                        const saved = await updateDemand(updated);
                        setDemands(prev => prev.map(d => d.id === saved.id ? saved : d));
                      }}
                      className={`p-2 rounded-lg transition-all ${demand.status === 'concluido' ? 'bg-brand-primary/20 text-brand-primary' : 'bg-white/5 text-gray-400 hover:text-brand-primary hover:bg-brand-primary/10'}`}
                    >
                      <Check size={16} />
                    </button>
                    {/* Só quem criou pode excluir */}
                    {demand.commentAuthor === myName && (
                      <button
                        onClick={() => setDeletingDemandId(demand.id)}
                        className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Modal de confirmação de exclusão */}
        <AnimatePresence>
          {deletingDemandId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={() => setDeletingDemandId(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-bg-main border border-white/10 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-6 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                    <Trash2 size={24} className="text-red-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Excluir demanda?</h3>
                  <p className="text-sm text-gray-400 mb-6">Essa ação não pode ser desfeita.</p>
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => setDeletingDemandId(null)}
                      className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-gray-300 hover:bg-white/10 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await deleteDemand(deletingDemandId);
                          setDemands(prev => prev.filter(d => d.id !== deletingDemandId));
                        } catch { /* ignore */ }
                        setDeletingDemandId(null);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-sm font-semibold text-red-400 hover:bg-red-500/30 transition-all"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderEquipe = () => (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Equipe</h1>
          <p className="text-gray-400 mt-1">Gerencie os membros da sua agência e suas permissões.</p>
        </div>
        <button 
          onClick={() => {
            setEditingMember(null);
            setIsTeamModalOpen(true);
          }}
          className="px-6 py-3 rounded-xl bg-brand-primary text-bg-main font-bold text-sm shadow-glow flex items-center gap-2 hover:scale-105 transition-all"
        >
          <Plus size={20} /> Adicionar Membro
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {teamMembers.map(member => (
          <motion.div 
            key={member.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-6 flex flex-col items-center text-center relative group"
          >
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => {
                  setEditingMember(member);
                  setIsTeamModalOpen(true);
                }}
                className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-brand-primary transition-colors"
              >
                <Edit2 size={14} />
              </button>
              <button 
                onClick={() => handleDeleteTeamMember(member.id)}
                className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {member.photoUrl ? (
              <div className="w-20 h-20 rounded-2xl overflow-hidden mb-4 shadow-glow" style={{ border: `1px solid ${member.color}44` }}>
                <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black mb-4 shadow-glow"
                style={{ backgroundColor: `${member.color}22`, color: member.color, border: `1px solid ${member.color}44` }}
              >
                {member.name.split(' ').map(n => n[0]).join('')}
              </div>
            )}

            <h3 className="text-lg font-bold text-white">{member.name}</h3>
            <p className="text-brand-primary text-xs font-bold uppercase tracking-widest mt-1">{member.role}</p>
            <p className="text-gray-500 text-xs mt-3">{member.email}</p>
            {member.phone && <p className="text-gray-600 text-[10px] mt-1 mb-4">{member.phone}</p>}
            {!member.phone && <div className="mb-6" />}

            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
              <div className={`w-1.5 h-1.5 rounded-full ${member.status === 'Ativo' ? 'bg-brand-primary shadow-[0_0_8px_rgba(0,255,136,0.5)]' : 'bg-gray-600'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-tighter ${member.status === 'Ativo' ? 'text-brand-primary' : 'text-gray-500'}`}>
                {member.status}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderDashboard = () => <DashboardView userSession={userSession} />;

  const renderKanban = () => (
    <div className="h-full flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kanban de Operação</h1>
          <p className="text-gray-400 mt-1">Gerencie o fluxo de entrega e ativação dos clientes.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input 
              type="text" 
              placeholder="Buscar cliente..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-brand-primary/50 transition-all w-64"
            />
          </div>
          <div className="relative">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`p-2 rounded-lg border transition-all ${isFilterOpen ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
            >
              <Filter size={20} />
            </button>
            <KanbanFilterPanel 
              isOpen={isFilterOpen} 
              onClose={() => setIsFilterOpen(false)} 
              filters={kanbanFilters} 
              onFilterChange={setKanbanFilters}
              teamMembers={teamMembers}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto custom-scrollbar pb-4">
        <div className="flex gap-6 h-full min-h-[600px]">
          {COLUMNS.map(column => (
            <div key={column.id} className="kanban-column">
              <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">{column.title}</h3>
                  <span className="text-[10px] font-bold bg-white/5 px-2 py-0.5 rounded-full text-gray-500">
                    {filteredClients.filter(c => c.status === column.id).length}
                  </span>
                </div>
              </div>
              
              <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-1">
                {filteredClients
                  .filter(c => c.status === column.id)
                  .map(client => (
                    <ClientCard 
                      key={client.id} 
                      client={client} 
                      allTags={allTags}
                      onClick={() => setSelectedClientId(client.id)} 
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderClientes = () => (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Clientes</h1>
          <p className="text-gray-400 mt-1">Lista completa de parceiros e contratos ativos.</p>
        </div>
        <button 
          onClick={() => setIsRegistrationModalOpen(true)}
          className="px-6 py-3 rounded-xl bg-brand-primary text-bg-main font-bold text-sm shadow-glow flex items-center gap-2 hover:scale-105 transition-all"
        >
          <Plus size={20} /> Novo Cliente
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Empresa</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Responsável</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Plano</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Entrada</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Saída Prevista</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Status</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => (
                <tr key={client.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-xs">
                        {client.name[0]}
                      </div>
                      <span className="font-semibold text-sm">{client.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-400">{client.responsible}</td>
                  <td className="p-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      client.plan === 'Pro' ? 'bg-purple-500/20 text-purple-400' :
                      client.plan === 'Basic' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {client.plan}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-400">{formatDate(client.entryDate)}</td>
                  <td className="p-4 text-sm text-gray-400">{formatDate(client.exitDate)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${client.isActive ? 'bg-brand-primary shadow-[0_0_8px_rgba(0,255,136,0.5)]' : 'bg-gray-600'}`} />
                      <span className={`text-xs font-medium ${client.isActive ? 'text-brand-primary' : 'text-gray-500'}`}>
                        {client.isActive ? 'Ativo' : 'Encerrado'}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setSelectedClientId(client.id)}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-brand-primary hover:border-brand-primary/20 transition-all"
                        title="Visualizar"
                      >
                        <Eye size={14} />
                      </button>
                      <button 
                        onClick={() => setSelectedClientId(client.id)}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={async () => {
                          if (confirm('Deseja realmente excluir este cliente?')) {
                            try {
                              await deleteClient(client.id);
                              setClients(clients.filter(c => c.id !== client.id));
                            } catch (error) {
                              console.error('Error deleting client:', error);
                              alert('Erro ao excluir cliente.');
                            }
                          }
                        }}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-400/20 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-bg-main overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 0 : 256, padding: sidebarCollapsed ? 0 : 24 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="bg-bg-sidebar border-r border-white/5 flex flex-col z-40 overflow-hidden flex-shrink-0"
      >
        <div className="min-w-[208px] flex flex-col h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="flex items-center gap-3 mb-10 px-2">
          {agencyConfig.logoUrl ? (
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-glow border border-white/10">
              <img 
                src={agencyConfig.logoUrl} 
                alt={agencyConfig.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-glow">
              <KanbanIcon size={24} className="text-bg-main font-bold" />
            </div>
          )}
          <div>
            <h2 className="font-black text-lg tracking-tighter leading-none">{agencyConfig.name.split(' ').slice(0, -1).join(' ')}</h2>
            <span className="text-[10px] font-bold text-brand-primary tracking-[0.2em] uppercase">{agencyConfig.name.split(' ').slice(-1)}</span>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {canSee('Dashboard') && !canSee('Aquisição') && <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'Dashboard'} onClick={() => setActiveTab('Dashboard')} />}
          {canSee('Clientes') && <SidebarItem icon={Users} label="Clientes" active={activeTab === 'Clientes'} onClick={() => setActiveTab('Clientes')} />}
          {canSee('Equipe') && <SidebarItem icon={Users} label="Equipe" active={activeTab === 'Equipe'} onClick={() => setActiveTab('Equipe')} />}
          {canSee('Relatórios') && <SidebarItem icon={BarChart3} label="Relatórios" active={activeTab === 'Relatórios'} onClick={() => setActiveTab('Relatórios')} />}
          {canSee('Playbooks') && !canSee('Aquisição') && !canSee('Entrega') && <SidebarItem icon={BookOpen} label="Playbooks" active={activeTab === 'Playbooks'} onClick={() => setActiveTab('Playbooks')} />}

          {/* Entrega */}
          <div className="space-y-1">
            {canSee('Entrega') && (
              <SidebarItem
                icon={Package}
                label="Entrega"
                active={activeTab === 'Entrega'}
                onClick={() => { setActiveTab('Entrega'); setEntregaSubTab('Kanban'); }}
              />
            )}
            {activeTab === 'Entrega' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="ml-9 space-y-1"
              >
                <button
                  onClick={() => setEntregaSubTab('Kanban')}
                  className={`w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${entregaSubTab === 'Kanban' ? 'text-brand-primary bg-white/5' : 'text-gray-500 hover:text-white'}`}
                >
                  Kanban
                </button>
                <button
                  onClick={() => setEntregaSubTab('Demandas')}
                  className={`w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${entregaSubTab === 'Demandas' ? 'text-brand-primary bg-white/5' : 'text-gray-500 hover:text-white'}`}
                >
                  Demandas
                  {demands.filter(d => d.status === 'pendente').length > 0 && (
                    <span className="ml-2 bg-brand-primary text-black text-[9px] font-bold rounded-full px-1.5 py-0.5">
                      {demands.filter(d => d.status === 'pendente').length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { setEntregaSubTab('AreaCliente'); setSelectedCrmTenantId(null); }}
                  className={`w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${entregaSubTab === 'AreaCliente' ? 'text-brand-primary bg-white/5' : 'text-gray-500 hover:text-white'}`}
                >
                  Área do Cliente
                </button>
                <button
                  onClick={() => setEntregaSubTab('Educacao')}
                  className={`w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${entregaSubTab === 'Educacao' ? 'text-brand-primary bg-white/5' : 'text-gray-500 hover:text-white'}`}
                >
                  Educação
                </button>
              </motion.div>
            )}
          </div>
          
          <div className="space-y-1">
            {canSee('Aquisição') && <SidebarItem icon={Briefcase} label="Aquisição" active={activeTab === 'Aquisição'} onClick={() => { setActiveTab('Aquisição'); setAquisicaoSubTab('CRM'); }} />}
            {activeTab === 'Aquisição' && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="ml-9 space-y-1"
              >
                <div className="space-y-1">
                  {canSee('Dashboard') && (
                    <button
                      onClick={() => setAquisicaoSubTab('Dashboard')}
                      className={`w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${aquisicaoSubTab === 'Dashboard' ? 'text-brand-primary bg-white/5' : 'text-gray-500 hover:text-white'}`}
                    >
                      Dashboard
                    </button>
                  )}
                  <button
                    onClick={() => setAquisicaoSubTab('CRM')}
                    className={`w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${aquisicaoSubTab === 'CRM' ? 'text-brand-primary bg-white/5' : 'text-gray-500 hover:text-white'}`}
                  >
                    CRM
                  </button>
                  <button
                    onClick={() => setAquisicaoSubTab('Relatorio')}
                    className={`w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${aquisicaoSubTab === 'Relatorio' ? 'text-brand-primary bg-white/5' : 'text-gray-500 hover:text-white'}`}
                  >
                    Relatório
                  </button>
                  {canSee('Playbooks') && (
                    <button
                      onClick={() => setAquisicaoSubTab('Playbooks')}
                      className={`w-full text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${aquisicaoSubTab === 'Playbooks' ? 'text-brand-primary bg-white/5' : 'text-gray-500 hover:text-white'}`}
                    >
                      Playbooks
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5 relative">
          <SidebarItem icon={HelpCircle} label="Suporte" active={false} onClick={() => setIsSupportModalOpen(true)} />
          {canSee('Configurações') && <SidebarItem icon={Settings} label="Configurações" active={activeTab === 'Configurações'} onClick={() => setActiveTab('Configurações')} />}
          <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3 relative">
            {(() => { const me = teamMembers.find(t => t.name === userSession.name); return me?.photoUrl ? (
              <img src={me.photoUrl} alt={me.name} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: userSession.color + '33', color: userSession.color }}>
                {userSession.name.split(' ').map(n => n[0]).join('')}
              </div>
            ); })()}
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{userSession.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{userSession.role}</p>
                </div>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="text-gray-600 hover:text-white transition-colors"
                >
                  <MoreVertical size={14} />
                </button>
              </>
            )}
            {sidebarCollapsed && (
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="absolute inset-0 rounded-xl"
                title={userSession.name}
              />
            )}
            <UserMenu
              isOpen={isUserMenuOpen}
              onClose={() => setIsUserMenuOpen(false)}
              user={userSession}
              onLogout={() => { signOut(); setUserSession(null); localStorage.removeItem('hubm2black_session'); setActiveTab('Dashboard'); }}
            />
          </div>
        </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Navbar */}
        <header className="h-16 border-b border-white/5 px-8 flex items-center justify-between bg-bg-main/50 backdrop-blur-md z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-brand-primary hover:bg-white/5 transition-all"
              title={sidebarCollapsed ? 'Mostrar menu' : 'Esconder menu'}
            >
              {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{agencyConfig.name}</span>
            <ChevronRight size={14} className="text-gray-700" />
            <span className="text-xs font-bold text-white">{activeTab}</span>
            {activeTab === 'Aquisição' && (
              <>
                <ChevronRight size={14} className="text-gray-700" />
                <span className="text-xs font-bold text-white">
                  {aquisicaoSubTab === 'CRM' ? 'CRM' : aquisicaoSubTab === 'Relatorio' ? 'Relatório' : aquisicaoSubTab === 'Dashboard' ? 'Dashboard' : 'Playbooks'}
                </span>
              </>
            )}
            {activeTab === 'Entrega' && (
              <>
                <ChevronRight size={14} className="text-gray-700" />
                <span className="text-xs font-bold text-white">
                  {entregaSubTab === 'Kanban' ? 'Kanban de Operação' : entregaSubTab === 'Demandas' ? 'Demandas' : entregaSubTab === 'AreaCliente' ? 'Área do Cliente' : 'Educação'}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div 
              onClick={() => setIsSearchModalOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-500 text-xs cursor-pointer hover:bg-white/10 transition-all"
            >
              <Search size={14} />
              <span>Pressione <kbd className="bg-white/10 px-1 rounded">⌘</kbd> <kbd className="bg-white/10 px-1 rounded">K</kbd></span>
            </div>
            <div className="relative">
              <button 
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="text-gray-400 hover:text-white transition-colors relative"
              >
                <Bell size={20} />
                {notifications.some(n => !n.read) && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-brand-primary rounded-full border-2 border-bg-main" />
                )}
              </button>
              <NotificationPanel 
                isOpen={isNotificationOpen} 
                onClose={() => setIsNotificationOpen(false)} 
                notifications={notifications}
                onMarkRead={(id) => setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n))}
              />
            </div>
            {(() => { const me = teamMembers.find(t => t.name === userSession?.name); return me?.photoUrl ? (
              <img src={me.photoUrl} alt={me.name} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full" style={{ backgroundColor: userSession.color }} />
            ); })()}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === 'Dashboard' && renderDashboard()}
              {activeTab === 'Clientes' && renderClientes()}
              {activeTab === 'Kanban de Operação' && !canSee('Entrega') && renderKanban()}
              {activeTab === 'Equipe' && renderEquipe()}
              {activeTab === 'Demandas' && !canSee('Entrega') && renderDemandas()}
              {activeTab === 'Configurações' && (
                <SettingsView 
                  config={agencyConfig} 
                  onSave={async (newConfig) => {
                    try {
                      const updated = await updateAgencyConfig(newConfig);
                      setAgencyConfig(updated);
                    } catch (error) {
                      console.error('Error updating agency config:', error);
                      alert('Erro ao salvar configurações.');
                    }
                  }} 
                  allTags={allTags} 
                  onSaveTag={handleSaveTag}
                  onDeleteTag={handleDeleteTag}
                />
              )}
              {activeTab === 'Relatórios' && <ReportsView clients={clients} config={agencyConfig} />}
              {activeTab === 'Educação' && !canSee('Entrega') && <EducacaoView userEmail={userSession.email} isAdmin={userSession.role.toLowerCase() === 'admin'} />}
              {activeTab === 'Playbooks' && !canSee('Aquisição') && !canSee('Entrega') && <PlaybooksView />}
              {activeTab === 'Área do Cliente' && !canSee('Entrega') && <ClientCRMView clients={clients} selectedTenantId={selectedCrmTenantId} onBack={() => setSelectedCrmTenantId(null)} />}
              {activeTab === 'Entrega' && entregaSubTab === 'Kanban' && renderKanban()}
              {activeTab === 'Entrega' && entregaSubTab === 'Demandas' && renderDemandas()}
              {activeTab === 'Entrega' && entregaSubTab === 'AreaCliente' && (
                <ClientCRMView clients={clients} selectedTenantId={selectedCrmTenantId} onBack={() => setSelectedCrmTenantId(null)} />
              )}
              {activeTab === 'Entrega' && entregaSubTab === 'Educacao' && (
                <EducacaoView userEmail={userSession.email} isAdmin={userSession.role.toLowerCase() === 'admin'} />
              )}
              {activeTab === 'Aquisição' && aquisicaoSubTab === 'Dashboard' && (
                <DashboardView userSession={userSession} />
              )}
              {activeTab === 'Aquisição' && aquisicaoSubTab === 'CRM' && (
                <div className="glass-card p-6">
                  <CRMView userSession={userSession} teamMembers={teamMembers} openLeadByName={openCRMLeadName} onLeadOpened={() => setOpenCRMLeadName('')} />
                </div>
              )}
              {activeTab === 'Aquisição' && aquisicaoSubTab === 'Relatorio' && (
                <ComercialView
                  teamMembers={teamMembers}
                  userSession={userSession}
                  onOpenInCRM={(name) => { setOpenCRMLeadName(name); setAquisicaoSubTab('CRM'); }}
                />
              )}
              {activeTab === 'Aquisição' && aquisicaoSubTab === 'Playbooks' && (
                <PlaybooksView />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Global Task Alarm Popup */}
      {tarefaAlarme && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, maxWidth: 360, width: 'calc(100% - 32px)' }}>
          <div style={{
            background: '#1a1a2e', border: '2px solid #d4af37', borderRadius: 12,
            padding: '16px 20px', animation: 'alarmPulse 1.5s ease-in-out infinite',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#d4af37' }}>Tarefa agendada</span>
              <button onClick={() => setTarefaAlarme(null)}
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18, padding: 0 }}>x</button>
            </div>
            <p style={{ fontSize: 15, fontWeight: 500, color: '#fff', margin: '0 0 4px' }}>{tarefaAlarme.titulo}</p>
            <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 12px' }}>
              {tarefaAlarme.data_agendada ? new Date(tarefaAlarme.data_agendada).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
              }) : ''}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={async () => {
                await supabase.from('crm_tarefas').update({ concluida: true }).eq('id', tarefaAlarme.id);
                setTarefaAlarme(null);
              }} style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                background: '#d4af37', color: '#000', border: 'none',
                fontWeight: 600, cursor: 'pointer', fontSize: 13,
              }}>Concluir</button>
              <button onClick={() => setTarefaAlarme(null)} style={{
                flex: 1, padding: '8px 12px', borderRadius: 8,
                background: 'transparent', color: '#aaa',
                border: '1px solid #444', cursor: 'pointer', fontSize: 13,
              }}>Dispensar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <GlobalSearchModal
        isOpen={isSearchModalOpen} 
        onClose={() => setIsSearchModalOpen(false)} 
        clients={clients} 
        onSelectClient={(id) => {
          setSelectedClientId(id);
          setActiveTab('Kanban de Operação');
        }}
      />

      <AnimatePresence>
        {selectedClient && (
          <ClientModal
            client={selectedClient}
            allTags={allTags}
            teamMembers={teamMembers}
            onClose={() => setSelectedClientId(null)}
            onUpdateClient={handleUpdateClient}
            onSaveTag={handleSaveTag}
            onDeleteTag={handleDeleteTag}
            userSession={userSession!}
            onOpenClientCrm={(tenantId) => { setSelectedCrmTenantId(tenantId); setActiveTab('Área do Cliente'); }}
            onCreateDemand={async (demand) => {
              try {
                const saved = await createDemand(demand);
                setDemands(prev => [saved, ...prev]);
                // Dispara webhook Kentro para o colaborador
                const assignedMember = teamMembers.find(m => m.name === demand.assignedName);
                if (assignedMember?.webhookKentro) {
                  fetch(assignedMember.webhookKentro, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      telefone: assignedMember.phone || '',
                      nome_colaborador: demand.assignedName,
                      texto_demanda: demand.text,
                      cliente: demand.clientName,
                      criado_por: demand.commentAuthor,
                      prioridade: demand.priority === 'alta' ? 'Alta' : demand.priority === 'baixa' ? 'Baixa' : 'Média',
                      data: new Date().toLocaleString('pt-BR'),
                    }),
                  }).catch(err => console.error('Erro ao enviar webhook Kentro:', err));
                }
              } catch (err) { console.error('Erro ao criar demanda:', err); }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        <TeamMemberModal 
          isOpen={isTeamModalOpen}
          member={editingMember}
          onClose={() => {
            setIsTeamModalOpen(false);
            setEditingMember(null);
          }}
          onSave={handleSaveTeamMember}
        />
      </AnimatePresence>

      <AnimatePresence>
        <ClientRegistrationModal
          isOpen={isRegistrationModalOpen}
          onClose={() => setIsRegistrationModalOpen(false)}
          onCreate={handleCreateClient}
        />
      </AnimatePresence>

      {/* Modal de Suporte */}
      <AnimatePresence>
        {isSupportModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
            onClick={() => setIsSupportModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-bg-card border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-brand-primary/20 flex items-center justify-center">
                  <HelpCircle size={20} className="text-brand-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Suporte</h3>
                  <p className="text-xs text-gray-500">Reporte um problema ou dificuldade</p>
                </div>
                <button onClick={() => setIsSupportModalOpen(false)} className="ml-auto text-gray-500 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <textarea
                value={supportText}
                onChange={e => setSupportText(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-primary transition-all resize-none h-32"
                placeholder="Descreva o problema ou dificuldade que está tendo..."
                autoFocus
              />
              <button
                disabled={!supportText.trim()}
                onClick={async () => {
                  if (!supportText.trim()) return;
                  try {
                    const demand: Demand = {
                      id: `dem-${Date.now()}`,
                      clientId: 'suporte',
                      clientName: 'Suporte App',
                      assignedTo: teamMembers.find(m => m.name === 'Thalisson')?.id || '',
                      assignedName: 'Thalisson',
                      text: `[SUPORTE] ${supportText.trim()}`,
                      priority: 'alta',
                      status: 'pendente',
                      commentAuthor: userSession.name,
                      createdAt: new Date().toISOString(),
                    };
                    const saved = await createDemand(demand);
                    setDemands(prev => [saved, ...prev]);
                    setSupportText('');
                    setIsSupportModalOpen(false);
                  } catch (err) {
                    console.error('Erro ao criar suporte:', err);
                    alert('Erro ao enviar reporte.');
                  }
                }}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-brand-primary text-black font-bold py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={16} />
                Enviar Reporte
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banner LGPD / Cookies */}
      {!cookiesAccepted && (
        <div className="fixed bottom-0 left-0 right-0 z-[300] bg-[#0d1117] border-t border-white/10 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm text-gray-300">
                Este site utiliza cookies essenciais para o funcionamento da plataforma.
                Ao continuar navegando, você concorda com a nossa{' '}
                <span className="text-brand-primary">Política de Privacidade</span> e com o
                tratamento dos seus dados conforme a LGPD (Lei 13.709/2018).
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setCookiesAccepted(true); localStorage.setItem('cookies_accepted', 'true'); }}
                className="px-6 py-2 bg-brand-primary text-bg-main font-bold rounded-lg text-sm hover:scale-105 transition-transform"
              >
                Aceitar
              </button>
              <button
                onClick={() => { setCookiesAccepted(true); localStorage.setItem('cookies_accepted', 'true'); }}
                className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-sm hover:bg-white/10 transition-colors"
              >
                Apenas essenciais
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
