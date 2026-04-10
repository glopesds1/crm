import type { AgencyConfig, Client, Column, Tag, TeamMember } from './types';

export const COLUMNS: Column[] = [
  { id: 'Onboarding', title: 'Onboarding' },
  { id: 'Material', title: 'Material' },
  { id: 'Apresentação', title: 'Apresentação' },
  { id: 'Ativação', title: 'Ativação' },
  { id: 'Ativos', title: 'Ativos' },
  { id: 'Churn', title: 'Churn' },
];

export const FUNNEL_OPTIONS = ["Placa de obra", "Tráfego", "Parceria", "Indicação", "GMN"];
export const PLATFORM_OPTIONS = ["Google Ads", "Meta Ads"];

export const DEFAULT_ONBOARDING_ITEMS = [
  "Pegar conta de anúncio Meta Ads",
  "Pegar conta de anúncio Google Ads",
  "Recolher materiais de mídia",
  "Pegar domínio",
  "Fazer criativos",
  "Criar sites",
  "Script de vídeo",
  "Fazer CRM",
  "Enviar IA de pré-atendimento",
  "Estruturar Instagram",
  "Tutoria comercial"
];

export const COLOR_PALETTE = [
  '#00FF88', '#00D1B2', '#00B894', '#00CEC9', '#0984E3',
  '#6C5CE7', '#A29BFE', '#E84393', '#FF7675', '#FAB1A0',
  '#FDCB6E', '#FFEAA7'
];

export const INITIAL_TAGS: Record<string, Tag> = {
  'pendencia': { id: 'pendencia', label: 'pendência', color: '#FF4D4D' },
  'urgente': { id: 'urgente', label: 'urgente', color: '#FF8C00' },
  'trafego': { id: 'trafego', label: 'tráfego', color: '#00FF88' },
  'criativo': { id: 'criativo', label: 'criativo', color: '#A29BFE' },
  'comercial': { id: 'comercial', label: 'comercial', color: '#FDCB6E' },
  'suporte': { id: 'suporte', label: 'suporte', color: '#00B894' },
};

export const INITIAL_TEAM_MEMBERS: TeamMember[] = [
  { id: 'tm-1', name: 'Alex Silva', email: 'alex@m2black.com', role: 'Gestor de Tráfego', status: 'Ativo', color: '#00FF88' },
  { id: 'tm-2', name: 'Mariana Costa', email: 'mariana@m2black.com', role: 'Criativo', status: 'Ativo', color: '#A29BFE' },
  { id: 'tm-3', name: 'Ricardo Oliveira', email: 'ricardo@m2black.com', role: 'Comercial', status: 'Ativo', color: '#FDCB6E' },
  { id: 'tm-4', name: 'Thalisson', email: 'thalisson@m2black.com', role: 'Admin', status: 'Ativo', color: '#0984E3' },
];

export const INITIAL_AGENCY_CONFIG: AgencyConfig = {
  name: "HUB M2 BLACK",
  logoUrl: "https://ais-pre-wji7sz7lixoztosem5x3xz-2959604678.us-west2.run.app/api/attachments/86646788-0677-4348-8446-267889604678",
  contactEmail: "contato@m2black.com",
  planPricing: {
    'Basic': 2000,
    'Pro': 4500,
    'Lite': 1000
  }
};

export const MOCK_CLIENTS: Client[] = [
  {
    id: '1',
    name: 'TechFlow Solutions',
    plan: 'Pro',
    responsible: 'Alex Silva',
    status: 'Ativos',
    tags: ['trafego', 'comercial'],
    platforms: ['Google Ads', 'Meta Ads'],
    funnels: ['Tráfego', 'Indicação'],
    situation: 'Operação rodando com ROI de 4.5x. Foco em escala no próximo mês.',
    docs: {
      access: 'https://docs.google.com/document/d/1access-techflow',
      transcription: 'https://docs.google.com/document/d/1trans-techflow',
    },
    comments: [
      { id: 'c1', author: 'Alex Silva', text: 'Reunião de alinhamento concluída. Cliente satisfeito.', date: '2024-03-10 14:30' },
      { id: 'c2', author: 'Mariana Costa', text: 'Novos criativos aprovados.', date: '2024-03-12 09:15' },
    ],
    offers: [
      { id: 'o1', name: 'Oferta Black Friday', situation: 'Em pausa, aguardando novembro.', platform: 'Ambos' },
      { id: 'o2', name: 'Oferta Verão 2024', situation: 'Ativa e performando bem.', platform: 'Meta Ads' }
    ],
    onboardingChecklist: DEFAULT_ONBOARDING_ITEMS.map((label, i) => ({ id: `ob-${i}`, label, completed: i < 4 })),
    monthlyMeetings: [
      { id: 'm1', number: 1, month: 'Fevereiro', year: 2024, completed: true, completionDate: '2024-02-15' },
      { id: 'm2', number: 2, month: 'Março', year: 2024, completed: false },
      { id: 'm3', number: 3, month: 'Abril', year: 2024, completed: false },
      { id: 'm4', number: 4, month: 'Maio', year: 2024, completed: false },
      { id: 'm5', number: 5, month: 'Junho', year: 2024, completed: false },
      { id: 'm6', number: 6, month: 'Julho', year: 2024, completed: false },
    ],
    entryDate: '2024-01-15',
    contractDuration: 6,
    exitDate: '2024-07-15',
    isActive: true
  },
  {
    id: '2',
    name: 'EcoVibe Store',
    plan: 'Basic',
    responsible: 'Mariana Costa',
    status: 'Onboarding',
    tags: ['pendencia', 'criativo'],
    platforms: ['Meta Ads'],
    funnels: ['Tráfego'],
    situation: 'Aguardando envio dos acessos da Shopify para integração.',
    docs: {
      access: 'https://docs.google.com/document/d/1access-ecovibe',
      transcription: 'https://docs.google.com/document/d/1trans-ecovibe',
    },
    comments: [
      { id: 'c3', author: 'Mariana Costa', text: 'Onboarding call agendada para amanhã.', date: '2024-03-14 16:00' },
    ],
    offers: [],
    onboardingChecklist: DEFAULT_ONBOARDING_ITEMS.map((label, i) => ({ id: `ob-${i}`, label, completed: false })),
    monthlyMeetings: [
      { id: 'm1', number: 1, month: 'Abril', year: 2024, completed: false },
      { id: 'm2', number: 2, month: 'Maio', year: 2024, completed: false },
      { id: 'm3', number: 3, month: 'Junho', year: 2024, completed: false },
    ],
    entryDate: '2024-03-01',
    contractDuration: 3,
    exitDate: '2024-06-01',
    isActive: true
  },
];

// ── CRM Constants ──────────────────────────────────────────────

export const ETAPAS = [
  { id: 'base',           label: 'Base de Leads',       color: 'border-gray-600',      badge: 'bg-gray-700 text-gray-300' },
  { id: 'triagem',        label: 'Triagem / Pré-venda', color: 'border-blue-600',      badge: 'bg-blue-900/50 text-blue-300' },
  { id: 'rm_marcada',     label: 'Reunião Marcada',     color: 'border-yellow-500',    badge: 'bg-yellow-900/50 text-yellow-300' },
  { id: 'rm_realizada',   label: 'Reunião Realizada',   color: 'border-orange-500',    badge: 'bg-orange-900/50 text-orange-300' },
  { id: 'fup_ativa',      label: 'FUP Ativa',           color: 'border-purple-500',    badge: 'bg-purple-900/50 text-purple-300' },
  { id: 'fechado',        label: 'Fechado',             color: 'border-brand-primary', badge: 'bg-green-900/50 text-green-300' },
  { id: 'perdido',        label: 'Perdido',             color: 'border-red-600',       badge: 'bg-red-900/50 text-red-300' },
  { id: 'congelado',      label: 'Congelado',           color: 'border-cyan-700',      badge: 'bg-cyan-900/50 text-cyan-300' },
  { id: 'desqualificado', label: 'Desqualificado',      color: 'border-gray-700',      badge: 'bg-gray-800/50 text-gray-500' },
];

export const ETAPA_MAP = Object.fromEntries(ETAPAS.map(e => [e.id, e]));

export const CRM_TAGS_CONFIG: Record<string, string> = {
  'MQL':             'bg-blue-900/50 text-blue-300 border-blue-700/50',
  'No-show':         'bg-red-900/50 text-red-300 border-red-700/50',
  'Programa Pro':    'bg-yellow-900/50 text-yellow-400 border-yellow-700/50',
  'Programa Lite':   'bg-gray-800/50 text-gray-300 border-gray-600/50',
  'Programa Basic':  'bg-blue-900/50 text-blue-400 border-blue-700/50',
  'Contrato na Mão': 'bg-green-900/50 text-green-300 border-green-700/50',
  'Link na Mão':     'bg-cyan-900/50 text-cyan-300 border-cyan-700/50',
};

export const CRM_ALL_TAGS = Object.keys(CRM_TAGS_CONFIG);

export const SLOT_HOURS = ['09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00'];
export const MAX_POR_SLOT = 2;

export const GRADE_STYLE: Record<string, { background: string; color: string; border: string }> = {
  A: { background: '#22c55e22', color: '#22c55e', border: '#22c55e44' },
  B: { background: '#d4af3722', color: '#d4af37', border: '#d4af3744' },
  C: { background: '#60a5fa22', color: '#60a5fa', border: '#60a5fa44' },
  D: { background: '#ef444422', color: '#ef4444', border: '#ef444444' },
};

export const BRAND = '#00FF88';
export const CHART_COLORS = ['#00FF88', '#00B4D8', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
