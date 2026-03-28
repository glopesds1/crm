import { supabase } from './supabase';
import type { Client, TeamMember, AgencyConfig, Tag, ComercialTask, Demand, CrmClientTarefa, EducacaoModulo, EducacaoAula, EducacaoProgresso } from '../types';

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
  // Login via Supabase Auth primeiro
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError || !authData.user) return null;

  // Verificar se é team member (agora autenticado, RLS permite)
  const { data: memberData } = await supabase
    .from('team_members')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (!memberData) return null; // Não é team member, mas NÃO faz signOut (pode ser CRM user)

  return dbToMember(memberData as Record<string, unknown>);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function resetPassword(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/?reset=true',
  });
  return { error: error?.message ?? null };
}

export async function updatePassword(newPassword: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: error?.message ?? null };
}

export async function getAuthSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// --- MFA (2FA) ---
export async function mfaListFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return { totp: [], all: [] };
  return data;
}

export async function mfaEnrollTotp(friendlyName = 'Authenticator') {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName });
  if (error) throw error;
  return data; // { id, type, totp: { qr_code, secret, uri } }
}

export async function mfaChallenge(factorId: string) {
  const { data, error } = await supabase.auth.mfa.challenge({ factorId });
  if (error) throw error;
  return data; // { id (challengeId) }
}

export async function mfaVerify(factorId: string, challengeId: string, code: string) {
  const { data, error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
  if (error) return { error: error.message };
  return { data, error: null };
}

export async function mfaUnenroll(factorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

export async function mfaGetAuthenticatorLevel() {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return { currentLevel: 'aal1', nextLevel: 'aal1' };
  return data; // { currentLevel: 'aal1'|'aal2', nextLevel: 'aal1'|'aal2' }
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

import type { CrmClientTenant, CrmClientPipeline, CrmClientStage, CrmClientLead, CrmClientLeadActivity, CrmClientTag, CrmClientUser } from '../types';

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
    empresa: (d.empresa ?? '') as string, faturamento: (d.faturamento ?? '') as string,
    area: (d.area ?? '') as string, origem: (d.origem ?? '') as string,
    valorContrato: +(d.valor_contrato ?? 0), valorCc: +(d.valor_cc ?? 0), valorMrr: +(d.valor_mrr ?? 0),
    status: (d.status ?? '') as string, motivoPerda: (d.motivo_perda ?? '') as string,
    proximaReuniao: (d.proxima_reuniao ?? '') as string,
    criadoEm: d.criado_em as string, atualizadoEm: d.atualizado_em as string,
  };
}
function clientLeadToDb(l: CrmClientLead): Record<string, unknown> {
  return {
    id: l.id, tenant_id: l.tenantId, stage_id: l.stageId, nome: l.nome,
    telefone: l.telefone, email: l.email, segmento: l.segmento,
    ticket_estimado: l.ticketEstimado, responsavel: l.responsavel,
    etiquetas: l.etiquetas, observacoes: l.observacoes,
    empresa: l.empresa, faturamento: l.faturamento, area: l.area, origem: l.origem,
    valor_contrato: l.valorContrato, valor_cc: l.valorCc, valor_mrr: l.valorMrr,
    status: l.status, motivo_perda: l.motivoPerda, proxima_reuniao: l.proximaReuniao || null,
    atualizado_em: new Date().toISOString(),
  };
}
function dbToActivity(d: Record<string, unknown>): CrmClientLeadActivity {
  return {
    id: d.id as string, leadId: d.lead_id as string, tenantId: d.tenant_id as string,
    tipo: d.tipo as string, subtipo: (d.subtipo ?? '') as string,
    conteudo: d.conteudo as string, autor: d.autor as string,
    imagemUrl: (d.imagem_url ?? '') as string,
    dados: (d.dados ?? {}) as Record<string, unknown>,
    criadoEm: d.criado_em as string,
  };
}
function dbToTarefa(d: Record<string, unknown>): CrmClientTarefa {
  return {
    id: d.id as string, tenantId: d.tenant_id as string, leadId: d.lead_id as string,
    titulo: d.titulo as string, dataAgendada: d.data_agendada as string,
    responsavel: (d.responsavel ?? '') as string, concluida: d.concluida as boolean,
    imagemUrl: (d.imagem_url ?? '') as string, criadoEm: d.criado_em as string,
  };
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

export async function deleteTenant(tenantId: string): Promise<void> {
  // CASCADE deleta pipelines, stages, leads, activities, tags, users vinculados
  const { error } = await supabase.from('crm_client_tenants').delete().eq('id', tenantId);
  if (error) throw error;
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
    empresa: lead.empresa || '', faturamento: lead.faturamento || '',
    area: lead.area || '', origem: lead.origem || '',
    valor_contrato: lead.valorContrato || 0, valor_cc: lead.valorCc || 0, valor_mrr: lead.valorMrr || 0,
    status: lead.status || '', motivo_perda: lead.motivoPerda || '',
    proxima_reuniao: lead.proximaReuniao || null,
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
    lead_id: a.leadId, tenant_id: a.tenantId, tipo: a.tipo, subtipo: a.subtipo || '',
    conteudo: a.conteudo, autor: a.autor, imagem_url: a.imagemUrl || '', dados: a.dados || {},
  }).select().single();
  if (error) throw error;
  return dbToActivity(data as Record<string, unknown>);
}

// ── Tarefas CRM Cliente ──
export async function getClientTarefas(tenantId: string, leadId?: string): Promise<CrmClientTarefa[]> {
  let q = supabase.from('crm_client_tarefas').select('*').eq('tenant_id', tenantId).order('data_agendada');
  if (leadId) q = q.eq('lead_id', leadId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => dbToTarefa(r as Record<string, unknown>));
}
export async function createClientTarefa(t: Omit<CrmClientTarefa, 'id' | 'criadoEm'>): Promise<CrmClientTarefa> {
  const { data, error } = await supabase.from('crm_client_tarefas').insert({
    tenant_id: t.tenantId, lead_id: t.leadId, titulo: t.titulo,
    data_agendada: t.dataAgendada, responsavel: t.responsavel,
    concluida: false, imagem_url: '',
  }).select().single();
  if (error) throw error;
  return dbToTarefa(data as Record<string, unknown>);
}
export async function updateClientTarefa(t: CrmClientTarefa): Promise<CrmClientTarefa> {
  const { data, error } = await supabase.from('crm_client_tarefas').update({
    titulo: t.titulo, data_agendada: t.dataAgendada, responsavel: t.responsavel,
    concluida: t.concluida, imagem_url: t.imagemUrl,
  }).eq('id', t.id).select().single();
  if (error) throw error;
  return dbToTarefa(data as Record<string, unknown>);
}
export async function deleteClientTarefa(id: string): Promise<void> {
  const { error } = await supabase.from('crm_client_tarefas').delete().eq('id', id);
  if (error) throw error;
}

// ── Tags ──
export async function getClientCrmTags(tenantId: string): Promise<CrmClientTag[]> {
  const { data, error } = await supabase.from('crm_client_tags').select('*').eq('tenant_id', tenantId);
  if (error) throw error;
  return (data ?? []).map((r) => dbToTag(r as Record<string, unknown>));
}

// ── CRM Client Users ──────────────────────────
function dbToCrmUser(d: Record<string, unknown>): CrmClientUser {
  return {
    id: d.id as string,
    tenantId: d.tenant_id as string,
    nome: d.nome as string,
    email: d.email as string,
    senha: d.senha as string,
    role: d.role as CrmClientUser['role'],
    ativo: d.ativo as boolean,
    criadoEm: d.criado_em as string,
  };
}

export async function getCrmUsersByTenant(tenantId: string): Promise<CrmClientUser[]> {
  const { data, error } = await supabase.from('crm_client_users').select('*').eq('tenant_id', tenantId).order('criado_em');
  if (error) throw error;
  return (data ?? []).map((r) => dbToCrmUser(r as Record<string, unknown>));
}

export async function createCrmUser(user: Omit<CrmClientUser, 'id' | 'criadoEm'>): Promise<CrmClientUser> {
  const { data, error } = await supabase.from('crm_client_users').insert({
    tenant_id: user.tenantId, nome: user.nome, email: user.email,
    senha: user.senha, role: user.role, ativo: user.ativo,
  }).select().single();
  if (error) throw error;
  return dbToCrmUser(data as Record<string, unknown>);
}

export async function updateCrmUser(user: CrmClientUser): Promise<CrmClientUser> {
  const { data, error } = await supabase.from('crm_client_users')
    .update({ nome: user.nome, email: user.email, senha: user.senha, role: user.role, ativo: user.ativo })
    .eq('id', user.id).select().single();
  if (error) throw error;
  return dbToCrmUser(data as Record<string, unknown>);
}

export async function deleteCrmUser(id: string): Promise<void> {
  const { error } = await supabase.from('crm_client_users').delete().eq('id', id);
  if (error) throw error;
}

export async function authenticateCrmUser(email: string, senha: string): Promise<{ user: CrmClientUser; tenant: CrmClientTenant } | null> {
  // Se o auth já foi feito pelo authenticateUser, reusar a sessão
  let session = await getAuthSession();
  if (!session) {
    // Se não tem sessão, tentar auth
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (authError) return null;
  }

  // Agora autenticado — buscar CRM user (RLS permite)
  const { data: crmData } = await supabase.from('crm_client_users').select('*').eq('email', email).eq('ativo', true).maybeSingle();
  if (!crmData) {
    await supabase.auth.signOut();
    return null;
  }

  const user = dbToCrmUser(crmData as Record<string, unknown>);
  const { data: tenantData } = await supabase.from('crm_client_tenants').select('*').eq('id', user.tenantId).single();
  if (!tenantData) {
    await supabase.auth.signOut();
    return null;
  }
  const tenant = dbToTenant(tenantData as Record<string, unknown>);
  return { user, tenant };
}

// ══════════════════════════════════════════════════════════════
// Educação — Módulos, Aulas, Progresso
// ══════════════════════════════════════════════════════════════
function dbToModulo(d: Record<string, unknown>): EducacaoModulo {
  return { id: d.id as string, titulo: d.titulo as string, descricao: (d.descricao ?? '') as string, ordem: +(d.ordem ?? 0), thumbnailUrl: (d.thumbnail_url ?? '') as string, ativo: d.ativo as boolean, criadoEm: d.criado_em as string };
}
function dbToAula(d: Record<string, unknown>): EducacaoAula {
  return { id: d.id as string, moduloId: d.modulo_id as string, titulo: d.titulo as string, descricao: (d.descricao ?? '') as string, videoUrl: (d.video_url ?? '') as string, duracao: (d.duracao ?? '') as string, ordem: +(d.ordem ?? 0), ativo: d.ativo as boolean, criadoEm: d.criado_em as string };
}
function dbToProgresso(d: Record<string, unknown>): EducacaoProgresso {
  return { id: d.id as string, aulaId: d.aula_id as string, userEmail: d.user_email as string, concluida: d.concluida as boolean, atualizadoEm: d.atualizado_em as string };
}

// Módulos
export async function getModulos(): Promise<EducacaoModulo[]> {
  const { data, error } = await supabase.from('educacao_modulos').select('*').eq('ativo', true).order('ordem');
  if (error) throw error;
  return (data ?? []).map(r => dbToModulo(r as Record<string, unknown>));
}
export async function createModulo(m: Omit<EducacaoModulo, 'id' | 'criadoEm'>): Promise<EducacaoModulo> {
  const { data, error } = await supabase.from('educacao_modulos').insert({ titulo: m.titulo, descricao: m.descricao, ordem: m.ordem, thumbnail_url: m.thumbnailUrl, ativo: m.ativo }).select().single();
  if (error) throw error;
  return dbToModulo(data as Record<string, unknown>);
}
export async function updateModulo(m: EducacaoModulo): Promise<EducacaoModulo> {
  const { data, error } = await supabase.from('educacao_modulos').update({ titulo: m.titulo, descricao: m.descricao, ordem: m.ordem, thumbnail_url: m.thumbnailUrl, ativo: m.ativo }).eq('id', m.id).select().single();
  if (error) throw error;
  return dbToModulo(data as Record<string, unknown>);
}
export async function deleteModulo(id: string): Promise<void> {
  const { error } = await supabase.from('educacao_modulos').delete().eq('id', id);
  if (error) throw error;
}

// Aulas
export async function getAulasByModulo(moduloId: string): Promise<EducacaoAula[]> {
  const { data, error } = await supabase.from('educacao_aulas').select('*').eq('modulo_id', moduloId).eq('ativo', true).order('ordem');
  if (error) throw error;
  return (data ?? []).map(r => dbToAula(r as Record<string, unknown>));
}
export async function getAllAulas(): Promise<EducacaoAula[]> {
  const { data, error } = await supabase.from('educacao_aulas').select('*').eq('ativo', true).order('ordem');
  if (error) throw error;
  return (data ?? []).map(r => dbToAula(r as Record<string, unknown>));
}
export async function createAula(a: Omit<EducacaoAula, 'id' | 'criadoEm'>): Promise<EducacaoAula> {
  const { data, error } = await supabase.from('educacao_aulas').insert({ modulo_id: a.moduloId, titulo: a.titulo, descricao: a.descricao, video_url: a.videoUrl, duracao: a.duracao, ordem: a.ordem, ativo: a.ativo }).select().single();
  if (error) throw error;
  return dbToAula(data as Record<string, unknown>);
}
export async function updateAula(a: EducacaoAula): Promise<EducacaoAula> {
  const { data, error } = await supabase.from('educacao_aulas').update({ titulo: a.titulo, descricao: a.descricao, video_url: a.videoUrl, duracao: a.duracao, ordem: a.ordem, ativo: a.ativo }).eq('id', a.id).select().single();
  if (error) throw error;
  return dbToAula(data as Record<string, unknown>);
}
export async function deleteAula(id: string): Promise<void> {
  const { error } = await supabase.from('educacao_aulas').delete().eq('id', id);
  if (error) throw error;
}

// Progresso
export async function getProgressoByUser(email: string): Promise<EducacaoProgresso[]> {
  const { data, error } = await supabase.from('educacao_progresso').select('*').eq('user_email', email);
  if (error) throw error;
  return (data ?? []).map(r => dbToProgresso(r as Record<string, unknown>));
}
export async function upsertProgresso(aulaId: string, email: string, concluida: boolean): Promise<void> {
  const { error } = await supabase.from('educacao_progresso').upsert({ aula_id: aulaId, user_email: email, concluida, atualizado_em: new Date().toISOString() }, { onConflict: 'aula_id,user_email' });
  if (error) throw error;
}
