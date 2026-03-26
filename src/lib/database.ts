import { supabase } from './supabase';
import type { Client, TeamMember, AgencyConfig, Tag, ComercialTask, Demand } from '../types';

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
    phone: m.phone ?? '',
    webhook_kentro: m.webhookKentro ?? '',
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
    phone: (row.phone as string) || '',
    webhookKentro: (row.webhook_kentro as string) || '',
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

// --- DEMANDS ---
function demandToDb(d: Demand): Record<string, unknown> {
  return {
    id: d.id,
    client_id: d.clientId,
    client_name: d.clientName,
    assigned_to: d.assignedTo,
    assigned_name: d.assignedName,
    text: d.text,
    priority: d.priority,
    status: d.status,
    comment_author: d.commentAuthor,
  };
}
function dbToDemand(row: Record<string, unknown>): Demand {
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    clientName: row.client_name as string,
    assignedTo: row.assigned_to as string,
    assignedName: row.assigned_name as string,
    text: row.text as string,
    priority: (row.priority as Demand['priority']) ?? 'media',
    status: (row.status as Demand['status']) ?? 'pendente',
    commentAuthor: row.comment_author as string,
    createdAt: row.created_at as string,
  };
}
export async function getDemands(): Promise<Demand[]> {
  const { data, error } = await supabase.from('demands').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => dbToDemand(row as Record<string, unknown>));
}
export async function createDemand(demand: Demand): Promise<Demand> {
  const { data, error } = await supabase.from('demands').insert(demandToDb(demand)).select().single();
  if (error) throw error;
  return dbToDemand(data as Record<string, unknown>);
}
export async function updateDemand(demand: Demand): Promise<Demand> {
  const { id, ...dbData } = demandToDb(demand);
  const { data, error } = await supabase.from('demands').update(dbData).eq('id', demand.id).select().single();
  if (error) throw error;
  return dbToDemand(data as Record<string, unknown>);
}
export async function deleteDemand(id: string): Promise<void> {
  const { error } = await supabase.from('demands').delete().eq('id', id);
  if (error) throw error;
}

// ── CRM Clientes (multi-tenant) ──────────────────────────

import type { CrmClientTenant, CrmClientPipeline, CrmClientStage, CrmClientLead, CrmClientLeadActivity, CrmClientTag } from '../types';

// Mappers
function dbToTenant(d: Record<string, unknown>): CrmClientTenant {
  return { id: d.id as string, clientId: d.client_id as string, slug: d.slug as string, ativo: d.ativo as boolean, criadoEm: d.criado_em as string };
}
function dbToPipeline(d: Record<string, unknown>): CrmClientPipeline {
  return { id: d.id as string, tenantId: d.tenant_id as string, nome: d.nome as string, criadoEm: d.criado_em as string };
}
function dbToStage(d: Record<string, unknown>): CrmClientStage {
  return { id: d.id as string, pipelineId: d.pipeline_id as string, tenantId: d.tenant_id as string, nome: d.nome as string, ordem: d.ordem as number, cor: d.cor as string };
}
function dbToClientLead(d: Record<string, unknown>): CrmClientLead {
  return {
    id: d.id as string, tenantId: d.tenant_id as string, stageId: d.stage_id as string,
    nome: d.nome as string, telefone: (d.telefone ?? '') as string, email: (d.email ?? '') as string,
    segmento: (d.segmento ?? '') as string, ticketEstimado: +(d.ticket_estimado ?? 0),
    responsavel: (d.responsavel ?? '') as string,
    etiquetas: Array.isArray(d.etiquetas) ? d.etiquetas as string[] : [],
    observacoes: (d.observacoes ?? '') as string,
    criadoEm: d.criado_em as string, atualizadoEm: d.atualizado_em as string,
  };
}
function clientLeadToDb(l: CrmClientLead): Record<string, unknown> {
  return {
    id: l.id, tenant_id: l.tenantId, stage_id: l.stageId, nome: l.nome,
    telefone: l.telefone, email: l.email, segmento: l.segmento,
    ticket_estimado: l.ticketEstimado, responsavel: l.responsavel,
    etiquetas: l.etiquetas, observacoes: l.observacoes, atualizado_em: new Date().toISOString(),
  };
}
function dbToActivity(d: Record<string, unknown>): CrmClientLeadActivity {
  return { id: d.id as string, leadId: d.lead_id as string, tenantId: d.tenant_id as string, tipo: d.tipo as string, conteudo: d.conteudo as string, autor: d.autor as string, criadoEm: d.criado_em as string };
}
function dbToTag(d: Record<string, unknown>): CrmClientTag {
  return { id: d.id as string, tenantId: d.tenant_id as string, nome: d.nome as string, cor: d.cor as string };
}

// ── Tenant ──
export async function getTenantByClientId(clientId: string): Promise<CrmClientTenant | null> {
  const { data, error } = await supabase.from('crm_client_tenants').select('*').eq('client_id', clientId).maybeSingle();
  if (error) throw error;
  return data ? dbToTenant(data as Record<string, unknown>) : null;
}
export async function getAllTenants(): Promise<CrmClientTenant[]> {
  const { data, error } = await supabase.from('crm_client_tenants').select('*').eq('ativo', true).order('criado_em', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => dbToTenant(r as Record<string, unknown>));
}

// ── Ativar CRM (cria tenant + pipeline + stages padrão) ──
const DEFAULT_STAGES = [
  { nome: 'Novo', ordem: 0, cor: '#00FF88' },
  { nome: 'Contato', ordem: 1, cor: '#3B82F6' },
  { nome: 'Qualificado', ordem: 2, cor: '#8B5CF6' },
  { nome: 'Proposta', ordem: 3, cor: '#F59E0B' },
  { nome: 'Negociação', ordem: 4, cor: '#EC4899' },
  { nome: 'Fechado', ordem: 5, cor: '#10B981' },
  { nome: 'Perdido', ordem: 6, cor: '#EF4444' },
];

export async function activateCrmForClient(clientId: string, clientName: string): Promise<CrmClientTenant> {
  const slug = clientName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  // 1. Criar tenant
  const { data: tenant, error: e1 } = await supabase.from('crm_client_tenants').insert({ client_id: clientId, slug }).select().single();
  if (e1) throw e1;
  const tenantId = tenant.id;
  // 2. Criar pipeline
  const { data: pipeline, error: e2 } = await supabase.from('crm_client_pipelines').insert({ tenant_id: tenantId, nome: 'Pipeline Principal' }).select().single();
  if (e2) throw e2;
  // 3. Criar stages padrão
  const stagesData = DEFAULT_STAGES.map(s => ({ ...s, pipeline_id: pipeline.id, tenant_id: tenantId }));
  const { error: e3 } = await supabase.from('crm_client_stages').insert(stagesData);
  if (e3) throw e3;
  return dbToTenant(tenant as Record<string, unknown>);
}

// ── Pipeline & Stages ──
export async function getStagesByTenant(tenantId: string): Promise<CrmClientStage[]> {
  const { data, error } = await supabase.from('crm_client_stages').select('*').eq('tenant_id', tenantId).order('ordem');
  if (error) throw error;
  return (data ?? []).map((r) => dbToStage(r as Record<string, unknown>));
}

// ── Leads ──
export async function getClientLeads(tenantId: string): Promise<CrmClientLead[]> {
  const { data, error } = await supabase.from('crm_client_leads').select('*').eq('tenant_id', tenantId).order('criado_em', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => dbToClientLead(r as Record<string, unknown>));
}
export async function createClientLead(lead: Omit<CrmClientLead, 'id' | 'criadoEm' | 'atualizadoEm'>): Promise<CrmClientLead> {
  const { data, error } = await supabase.from('crm_client_leads').insert({
    tenant_id: lead.tenantId, stage_id: lead.stageId, nome: lead.nome,
    telefone: lead.telefone, email: lead.email, segmento: lead.segmento,
    ticket_estimado: lead.ticketEstimado, responsavel: lead.responsavel,
    etiquetas: lead.etiquetas, observacoes: lead.observacoes,
  }).select().single();
  if (error) throw error;
  return dbToClientLead(data as Record<string, unknown>);
}
export async function updateClientLead(lead: CrmClientLead): Promise<CrmClientLead> {
  const { id, ...dbData } = clientLeadToDb(lead);
  const { data, error } = await supabase.from('crm_client_leads').update(dbData).eq('id', lead.id).select().single();
  if (error) throw error;
  return dbToClientLead(data as Record<string, unknown>);
}
export async function deleteClientLead(id: string): Promise<void> {
  const { error } = await supabase.from('crm_client_leads').delete().eq('id', id);
  if (error) throw error;
}

// ── Activities ──
export async function getLeadActivities(leadId: string): Promise<CrmClientLeadActivity[]> {
  const { data, error } = await supabase.from('crm_client_lead_activities').select('*').eq('lead_id', leadId).order('criado_em', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => dbToActivity(r as Record<string, unknown>));
}
export async function createLeadActivity(a: Omit<CrmClientLeadActivity, 'id' | 'criadoEm'>): Promise<CrmClientLeadActivity> {
  const { data, error } = await supabase.from('crm_client_lead_activities').insert({
    lead_id: a.leadId, tenant_id: a.tenantId, tipo: a.tipo, conteudo: a.conteudo, autor: a.autor,
  }).select().single();
  if (error) throw error;
  return dbToActivity(data as Record<string, unknown>);
}

// ── Tags ──
export async function getClientCrmTags(tenantId: string): Promise<CrmClientTag[]> {
  const { data, error } = await supabase.from('crm_client_tags').select('*').eq('tenant_id', tenantId);
  if (error) throw error;
  return (data ?? []).map((r) => dbToTag(r as Record<string, unknown>));
}
