export type Plan = 'Pro' | 'Basic' | 'Lite';

export type Tag = {
  id: string;
  label: string;
  color: string;
};

export type ClientComment = {
  id: string;
  author: string;
  text: string;
  date: string;
};

export type Offer = {
  id: string;
  name: string;
  situation: string;
  platform: 'Google Ads' | 'Meta Ads' | 'Ambos';
  captureUrl?: string;
};

export type OnboardingItem = {
  id: string;
  label: string;
  completed: boolean;
};

export type MeetingActionItem = {
  id: string;
  text: string;
  completed: boolean;
};

export type MonthlyMeeting = {
  id: string;
  number: number;
  month: string;
  year: number;
  completed: boolean;
  completionDate?: string;
  transcriptionUrl?: string;
  transcriptionText?: string;
  actionItems?: MeetingActionItem[];
  meetingSummary?: string;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  password?: string;
  status: 'Ativo' | 'Inativo';
  color: string;
  photoUrl?: string;
  phone?: string;
  webhookKentro?: string;
  auth_user_id?: string;
};

export type Client = {
  id: string;
  name: string;
  plan: Plan;
  responsible: string;
  status: 'Onboarding' | 'Material' | 'Apresentação' | 'Ativação' | 'Ativos' | 'Churn';
  tags: string[];
  platforms: string[];
  funnels: string[];
  situation: string;
  docs: {
    access: string;
    transcription: string;
  };
  comments: ClientComment[];
  offers: Offer[];
  onboardingChecklist: OnboardingItem[];
  monthlyMeetings: MonthlyMeeting[];
  entryDate: string;
  contractDuration: number;
  exitDate: string;
  isActive: boolean;
  // Dados cadastrais (venda)
  razaoSocial?: string;
  tipoPessoa?: string;
  cpfCnpj?: string;
  endereco?: string;
  emailContato?: string;
  telefoneContato?: string;
  nomeResponsavelFinanceiro?: string;
  valorContrato?: number;
  valorCc?: number;
  valorMrr?: number;
  formaPagamento?: string;
  dataPrimeiroVencimento?: string;
};

export type Column = {
  id: Client['status'];
  title: string;
};

export type PlanConfig = {
  id: Plan;
  value: number;
};

export type AgencyConfig = {
  name: string;
  logoUrl: string;
  contactEmail: string;
  planPricing: Record<Plan, number>;
};

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: 'alert' | 'info' | 'success';
  date: string;
  read: boolean;
};

export type UserSession = {
  userId: string;
  name: string;
  email: string;
  role: string;
  color: string;
};

export type ComercialTask = {
  id: string;
  type: 'PreVendas' | 'Vendas';
  category: 'Ligação' | 'Reunião';
  collaborator: string;
  imageUrl: string;
  completionTime: string;
  answered: 'Atendeu' | 'Não atendeu' | null;
  meetingStatus?: 'Compareceu' | 'Não compareceu' | null;
  scheduled: boolean;
  touchpoint?: number;
  // Vendas specific fields
  saleStatus?: 'Venda' | 'Marcou R2+' | 'Perdido' | null;
  contractValue?: number;
  cashCollect?: number;
  termMonths?: number;
  companyName?: string;
  cnpj?: string;
  address?: string;
  contactEmail?: string;
  phone?: string;
  responsibleName?: string;
  meetingSummary?: string;
  nextMeetingDate?: string;
  lossReason?: string;
  createdAt: string;
};

// ── CRM Clientes (multi-tenant) ──────────────────────────

export type CrmClientTenant = {
  id: string;
  clientId: string;
  slug: string;
  ativo: boolean;
  criadoEm: string;
};

export type CrmClientPipeline = {
  id: string;
  tenantId: string;
  nome: string;
  criadoEm: string;
};

export type CrmClientStage = {
  id: string;
  pipelineId: string;
  tenantId: string;
  nome: string;
  ordem: number;
  cor: string;
};

export type CrmClientLead = {
  id: string;
  tenantId: string;
  stageId: string;
  nome: string;
  telefone: string;
  email: string;
  segmento: string;
  ticketEstimado: number;
  responsavel: string;
  etiquetas: string[];
  observacoes: string;
  empresa: string;
  faturamento: string;
  area: string;
  origem: string;
  valorContrato: number;
  valorCc: number;
  valorMrr: number;
  status: string;
  motivoPerda: string;
  proximaReuniao: string;
  criadoEm: string;
  atualizadoEm: string;
};

export type CrmClientLeadActivity = {
  id: string;
  leadId: string;
  tenantId: string;
  tipo: string;
  subtipo: string;
  conteudo: string;
  autor: string;
  imagemUrl: string;
  dados: Record<string, unknown>;
  criadoEm: string;
};

export type CrmClientTarefa = {
  id: string;
  tenantId: string;
  leadId: string;
  titulo: string;
  dataAgendada: string;
  responsavel: string;
  concluida: boolean;
  imagemUrl: string;
  criadoEm: string;
};

export type CrmClientTag = {
  id: string;
  tenantId: string;
  nome: string;
  cor: string;
};

export type CrmClientUser = {
  id: string;
  tenantId: string;
  nome: string;
  email: string;
  senha: string;
  role: 'admin' | 'member';
  ativo: boolean;
  criadoEm: string;
};

// ── Educação ──────────────────────────────────────────────
export type EducacaoModulo = {
  id: string;
  titulo: string;
  descricao: string;
  ordem: number;
  thumbnailUrl: string;
  ativo: boolean;
  criadoEm: string;
};

export type EducacaoAula = {
  id: string;
  moduloId: string;
  titulo: string;
  descricao: string;
  videoUrl: string;
  duracao: string;
  ordem: number;
  ativo: boolean;
  criadoEm: string;
};

export type EducacaoProgresso = {
  id: string;
  aulaId: string;
  userEmail: string;
  concluida: boolean;
  atualizadoEm: string;
};

export type Demand = {
  id: string;
  clientId: string;
  clientName: string;
  assignedTo: string;
  assignedName: string;
  text: string;
  priority: 'alta' | 'media' | 'baixa';
  status: 'pendente' | 'concluido';
  commentAuthor: string;
  createdAt: string;
};

// ── CRM Types ──────────────────────────────────────────────────

export interface CRMLead {
  id: string;
  lead_externo_id?: string;
  nome: string;
  telefone?: string;
  email?: string;
  empresa?: string;
  faturamento?: string;
  area?: string;
  closer_responsavel?: string;
  sdr_responsavel?: string;
  etapa: string;
  status: string;
  origem: string;
  anuncio?: string;
  programa_apresentado?: string;
  valor_contrato?: number;
  valor_cc?: number;
  valor_mrr?: number;
  motivo_perda?: string;
  proxima_reuniao?: string;
  lead_score?: number;
  lead_grade?: string;
  investimento?: string;
  funcionarios?: string;
  tags?: string[];
  observacoes?: string;
  created_at: string;
  updated_at: string;
  etapa_desde?: string;
}

export interface CRMAtividade {
  id: string;
  lead_id: string;
  tipo: string;
  titulo?: string;
  descricao?: string;
  data_atividade: string;
  realizado_por?: string;
  status_chamada?: string;
  agendou?: boolean;
  touchpoint?: number;
  status_reuniao?: string;
  resultado?: string;
  imagem_url?: string;
  created_at: string;
}

export interface CRMTarefa {
  id: string;
  lead_id: string;
  titulo: string;
  tipo?: 'ligacao' | 'reuniao';
  data_agendada?: string;
  responsavel?: string;
  concluida: boolean;
}

export interface CRMDemandaVenda {
  id: string;
  lead_id: string;
  contrato_feito: boolean;
  contrato_assinado: boolean;
  sinal_pago: boolean;
  entrada_paga: boolean;
  onboarding_agendado: boolean;
  grupo_criado: boolean;
  membros_adicionados: boolean;
  mensagem_saudacao: boolean;
  created_at: string;
  updated_at: string;
}

// ── Dashboard Types ────────────────────────────────────────────

export type DashboardPage = 'overview' | 'metas' | 'semanal' | 'reunioes' | 'analise' | 'anuncios' | 'sdr';

export interface DateRange {
  inicio: string;
  fim: string;
}
