import { supabase } from './supabase';
import type { Client, TeamMember, AgencyConfig, Tag, ComercialTask } from '../types';

// --- Mappers Client camelCase <-> snake_case ---
function clientToDb(c: Client): Record<string, unknown> {
  return {
    id: c.id,
    name: c.name,
    responsible: c.responsible,
    plan: c.plan,
    status: c.status,
    entry_date: c.entryDate,
    exit_date: c.exitDate ?? '',
    contract_duration: c.contractDuration,
    tags: c.tags ?? [],
    platforms: c.platforms ?? [],
    funnels: c.funnels ?? [],
    situation: c.situation ?? '',
    docs: c.docs ?? { access: '', transcription: '' },
    comments: c.comments ?? [],
    offers: c.offers ?? [],
    onboarding_checklist: c.onboardingChecklist ?? [],
    monthly_meetings: c.monthlyMeetings ?? [],
    razao_social: c.razaoSocial ?? '',
    tipo_pessoa: c.tipoPessoa ?? '',
    cpf_cnpj: c.cpfCnpj ?? '',
    endereco: c.endereco ?? '',
    email_contato: c.emailContato ?? '',
    telefone_contato: c.telefoneContato ?? '',
    nome_responsavel_financeiro: c.nomeResponsavelFinanceiro ?? '',
    valor_contrato: c.valorContrato ?? 0,
    valor_cc: c.valorCc ?? 0,
    valor_mrr: c.valorMrr ?? 0,
    forma_pagamento: c.formaPagamento ?? '',
    data_primeiro_vencimento: c.dataPrimeiroVencimento ?? '',
  };
}

function dbToClient(row: Record<string, unknown>): Client {
  return {
    id: row.id as string,
    name: row.name as string,
    responsible: row.responsible as string,
    plan: row.plan as Client['plan'],
    status: row.status as Client['status'],
    entryDate: row.entry_date as string,
    exitDate: row.exit_date as string,
    contractDuration: row.contract_duration as number,
    tags: (row.tags as string[]) ?? [],
    platforms: (row.platforms as string[]) ?? [],
    funnels: (row.funnels as string[]) ?? [],
    situation: (row.situation as string) ?? '',
    docs: (row.docs as Client['docs']) ?? { access: '', transcription: '' },
    comments: (row.comments as Client['comments']) ?? [],
    offers: (row.offers as Client['offers']) ?? [],
    onboardingChecklist: (row.onboarding_checklist as Client['onboardingChecklist']) ?? [],
    monthlyMeetings: (row.monthly_meetings as Client['monthlyMeetings']) ?? [],
    isActive: true,
    razaoSocial: (row.razao_social as string) ?? '',
    tipoPessoa: (row.tipo_pessoa as string) ?? '',
    cpfCnpj: (row.cpf_cnpj as string) ?? '',
    endereco: (row.endereco as string) ?? '',
    emailContato: (row.email_contato as string) ?? '',
    telefoneContato: (row.telefone_contato as string) ?? '',
    nomeResponsavelFinanceiro: (row.nome_responsavel_financeiro as string) ?? '',
    valorContrato: (row.valor_contrato as number) ?? 0,
    valorCc: (row.valor_cc as number) ?? 0,
    valorMrr: (row.valor_mrr as number) ?? 0,
    formaPagamento: (row.forma_pagamento as string) ?? '',
    dataPrimeiroVencimento: (row.data_primeiro_vencimento as string) ?? '',
  };
}

// --- Mappers TeamMember camelCase <-> snake_case ---
function memberToDb(m: TeamMember): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    status: m.status,
    color: m.color,
    photo_url: m.photoUrl ?? '',
  };
  if (m.password) row.password = m.password;
  return row;
}

function dbToMember(row: Record<string, unknown>): TeamMember {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    role: row.role as string,
    password: row.password as string,
    status: row.status as TeamMember['status'],
    color: (row.color as string) ?? '#00FF88',
    photoUrl: (row.photo_url as string) || '',
  };
}

// --- CLIENTS ---
export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => dbToClient(row as Record<string, unknown>));
}

export async function createClient(client: Client): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert(clientToDb(client))
    .select()
    .single();
  if (error) throw error;
  return dbToClient(data as Record<string, unknown>);
}

export async function updateClient(client: Client): Promise<Client> {
  const { id, ...dbData } = clientToDb(client);
  const { data, error } = await supabase
    .from('clients')
    .update(dbData)
    .eq('id', client.id)
    .select()
    .single();
  if (error) throw error;
  return dbToClient(data as Record<string, unknown>);
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

// --- TEAM MEMBERS ---
export async function getTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => dbToMember(row as Record<string, unknown>));
}

export async function createTeamMember(member: TeamMember): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('team_members')
    .insert(memberToDb(member))
    .select()
    .single();
  if (error) throw error;
  return dbToMember(data as Record<string, unknown>);
}

export async function updateTeamMember(member: TeamMember): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('team_members')
    .update(memberToDb(member))
    .eq('id', member.id)
    .select()
    .single();
  if (error) throw error;
  return dbToMember(data as Record<string, unknown>);
}

export async function deleteTeamMember(id: string): Promise<void> {
  const { error } = await supabase.from('team_members').delete().eq('id', id);
  if (error) throw error;
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<TeamMember | null> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('email', email)
    .eq('password', password)
    .single();
  if (error || !data) return null;
  return dbToMember(data as Record<string, unknown>);
}

// --- TAGS ---
// Tags table: id (text), label (text), color (text), created_at
export async function getTags(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('label', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return { id: r.id as string, label: r.label as string, color: r.color as string };
  });
}

export async function createTag(tag: Tag): Promise<Tag> {
  const dbRow = { id: tag.id, label: tag.label, color: tag.color };
  const { data, error } = await supabase
    .from('tags')
    .insert(dbRow)
    .select()
    .single();
  if (error) throw error;
  const r = data as Record<string, unknown>;
  return { id: r.id as string, label: r.label as string, color: r.color as string };
}

export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', id);
  if (error) throw error;
}

// Alias for backward compatibility
export const saveTag = createTag;

// --- AGENCY CONFIG ---
// agency_config table: id, agency_name, logo_url, contact_email, plan_prices, updated_at
export async function getAgencyConfig(): Promise<AgencyConfig | null> {
  const { data, error } = await supabase
    .from('agency_config')
    .select('*')
    .limit(1)
    .single();
  if (error) return null;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    name: (row.agency_name ?? '') as string,
    logoUrl: (row.logo_url ?? '') as string,
    contactEmail: (row.contact_email ?? '') as string,
    planPricing: (row.plan_prices ?? { Pro: 0, Basic: 0, Lite: 0 }) as AgencyConfig['planPricing'],
  };
}

export async function updateAgencyConfig(config: AgencyConfig): Promise<void> {
  const { data: existing } = await supabase
    .from('agency_config')
    .select('id')
    .limit(1)
    .single();

  const dbRow = {
    agency_name: config.name,
    logo_url: config.logoUrl ?? '',
    contact_email: config.contactEmail ?? '',
    plan_prices: config.planPricing,
  };

  if (existing) {
    const { error } = await supabase
      .from('agency_config')
      .update(dbRow)
      .eq('id', (existing as Record<string, unknown>).id as string);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('agency_config').insert(dbRow);
    if (error) throw error;
  }
}

// --- COMERCIAL TASKS ---
function taskToDb(t: ComercialTask): Record<string, unknown> {
  return {
    id: t.id, type: t.type, category: t.category, collaborator: t.collaborator,
    image_url: t.imageUrl, completion_time: t.completionTime,
    answered: t.answered ?? null, meeting_status: t.meetingStatus ?? null,
    scheduled: t.scheduled, sale_status: t.saleStatus ?? null,
    contract_value: t.contractValue ?? null, cash_collect: t.cashCollect ?? null,
    term_months: t.termMonths ?? null, company_name: t.companyName ?? null,
    cnpj: t.cnpj ?? null, address: t.address ?? null,
    contact_email: t.contactEmail ?? null, phone: t.phone ?? null,
    meeting_summary: t.meetingSummary ?? null, next_meeting_date: t.nextMeetingDate ?? null,
    loss_reason: t.lossReason ?? null, touchpoint: t.touchpoint ?? null,
    responsible_name: t.responsibleName ?? null, created_at: t.createdAt,
  };
}
function dbToTask(row: Record<string, unknown>): ComercialTask {
  return {
    id: row.id as string, type: row.type as ComercialTask['type'],
    category: row.category as ComercialTask['category'], collaborator: row.collaborator as string,
    imageUrl: row.image_url as string, completionTime: row.completion_time as string,
    answered: (row.answered as ComercialTask['answered']) ?? null,
    meetingStatus: (row.meeting_status as ComercialTask['meetingStatus']) ?? null,
    scheduled: (row.scheduled as boolean) ?? false,
    saleStatus: (row.sale_status as ComercialTask['saleStatus']) ?? null,
    contractValue: row.contract_value as number | undefined,
    cashCollect: row.cash_collect as number | undefined,
    termMonths: row.term_months as number | undefined,
    companyName: row.company_name as string | undefined,
    cnpj: row.cnpj as string | undefined, address: row.address as string | undefined,
    contactEmail: row.contact_email as string | undefined, phone: row.phone as string | undefined,
    meetingSummary: row.meeting_summary as string | undefined,
    nextMeetingDate: row.next_meeting_date as string | undefined,
    lossReason: row.loss_reason as string | undefined,
    touchpoint: row.touchpoint as number | undefined,
    responsibleName: row.responsible_name as string | undefined,
    createdAt: row.created_at as string,
  };
}
export async function getComercialTasks(): Promise<ComercialTask[]> {
  const { data, error } = await supabase.from('comercial_tasks').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => dbToTask(row as Record<string, unknown>));
}
export async function createComercialTask(task: ComercialTask): Promise<ComercialTask> {
  const { data, error } = await supabase.from('comercial_tasks').insert(taskToDb(task)).select().single();
  if (error) throw error;
  return dbToTask(data as Record<string, unknown>);
}
export async function deleteComercialTask(id: string): Promise<void> {
  const { error } = await supabase.from('comercial_tasks').delete().eq('id', id);
  if (error) throw error;
}
