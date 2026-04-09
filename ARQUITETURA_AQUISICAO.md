# Arquitetura Completa — Área de Aquisição (Hub M² Black)

> Documento gerado em 07/04/2026 a partir da análise de todos os arquivos do projeto, schemas de banco, workflows n8n e histórico de chats.

---

## 1. Visão Geral do Sistema

A área de Aquisição é o motor comercial do Hub M² Black. Ela cobre todo o ciclo de vida de um lead: desde a captura via Meta Ads até o fechamento de venda e onboarding como cliente.

**Stack:**
- **Frontend:** React 19 + TypeScript + Vite 6 + Tailwind v4 (SPA em `clientes.m2black.com`)
- **Banco principal (CRM):** Supabase PostgreSQL (plano Nano)
- **Banco de origem (Leads/Métricas):** Railway PostgreSQL
- **Automações:** n8n self-hosted em `webhook.m2black.com`
- **WhatsApp:** Evolution API / Meta WhatsApp Business API
- **Calendário:** Google Calendar API (via n8n)
- **Storage:** Supabase Storage (bucket `comercial-prints`)

---

## 2. Fluxo de Dados Principal

```
┌─────────────┐    Webhook     ┌──────────────┐    n8n sync     ┌──────────────┐
│  Meta Ads    │──────────────▶│   Railway     │───(30min)──────▶│  Supabase    │
│  Lead Ads   │    (Nativo)    │  PostgreSQL   │                 │  crm_leads   │
└─────────────┘                └──────────────┘                 └──────┬───────┘
                                      │                                │
                               ┌──────┴───────┐                       │
                               │  reunioes    │                ┌──────▼───────┐
                               │  (Railway)   │                │  Frontend    │
                               └──────────────┘                │  CRMView     │
                                      │                        │  Dashboard   │
                                      │   n8n Dashboard API    │              │
                                      └───────────────────────▶│              │
                                                               └──────────────┘
```

### 2.1 Origem dos Leads (Railway)

Tabela `meta_leads_nt` — fonte de verdade para dados brutos de leads. ~2200 registros.

Campos-chave do Railway (notação com aspas duplas = case-sensitive):
- `id` (serial), `nome`, `telefone`, `empresa`, `faturamento`, `area`
- `"Data_Entrada"` — data de captura no Meta
- `"Data_MQL"` — data de qualificação
- `"Data_Reuniao_Marcada"`, `"Data_Reuniao_Realizada"`
- `"Data_TP"` — data do touchpoint (R2+)
- `"Data_Venda"` — data de fechamento
- `"Responsavel"` — SDR/closer responsável
- `"Status_TP"` — status da reunião (Compareceu, No-show, Venda, Perdido, etc.)
- `anuncio` — nome do anúncio de origem

A tabela `reunioes` (Railway) armazena cada evento de reunião como uma linha (event-log model), com campos: `lead_id`, `crm_lead_id`, `tp` (R1/R2/R3/R4+), `data_marcada`, `hora_marcada`, `status` (Pendente/Compareceu/No-show/Venda/Perdido/Reagendou/Cancelado), `closer`, `sdr`, `closer_realizou`, `resultado`, `rs_contrato`, `rs_cc`, `programa`.

### 2.2 Sincronização Railway → Supabase

**Workflow:** `Sync Meta Leads → CRM` (n8n, a cada 30min + webhook manual)

Fluxo:
1. `Buscar Leads Novos` — SELECT dos últimos 3 dias do Railway onde `id::text NOT IN (SELECT lead_externo_id FROM crm_leads)`
2. `Filtrar Deletados` — exclui leads com `deletado_em` no Supabase (soft delete)
3. `Mapear para CRM` — transforma campos Railway → Supabase (Code node):
   - `lead_externo_id` ← `id::text` do Railway
   - `nome`, `telefone`, `empresa`, `faturamento`, `area`, `anuncio`, `origem`
   - `etapa` calculada: base (padrão), triagem (se MQL), rm_marcada (se reunião marcada), rm_realizada (se reunião realizada), fup_ativa (se Data_TP), fechado (se Data_Venda)
   - `created_at` ← data relevante por etapa (Data_Entrada, Data_MQL, Data_Reuniao_Marcada, etc.)
   - `sdr_responsavel` ← `Responsavel` do Railway
   - `lead_score` / `lead_grade` calculados (Faturamento 0-40, Investimento 0-30, Funcionários 0-20, Área 0-10)
4. `Inserir Lote no Supabase` — POST em lotes de 50 (ignore-duplicates, NÃO merge)
5. **Sync reverso (CRM → Railway):** Webhook `crm-sync-etapa` no mesmo workflow. Quando o frontend muda etapa/status/responsável, envia POST que gera SQL dinâmico pra atualizar `meta_leads_nt` e `reunioes`.

**Regra crucial:** O CRM (Supabase) é a fonte de verdade para etapa, responsável e status. O Railway é fonte de verdade para dados brutos do lead e métricas de campanha. O sync é one-way Railway→Supabase para leads novos, e webhook CRM→Railway para mudanças de etapa.

### 2.3 CRM (Supabase)

#### Tabelas do CRM interno (aquisição):

| Tabela | Propósito |
|--------|-----------|
| `crm_leads` | Pipeline de leads. Campos: `closer_responsavel`, `sdr_responsavel`, `etapa`, `lead_externo_id`, `tags[]`, `lead_score`, `lead_grade`, `tp_atual`, `deletado_em` (soft delete), dados financeiros (contrato, cc, mrr), dados cadastrais (razão social, CPF/CNPJ, endereço) |
| `crm_atividades` | Timeline de atividades por lead (ligação, reunião, tarefa concluída). FK → crm_leads |
| `crm_tarefas` | Tarefas agendadas por lead (título, data, responsável, concluída). FK → crm_leads |
| `comercial_tasks` | Registro "flat" de atividades comerciais para o relatório. Sem FK — dados desnormalizados |
| `crm_demandas_venda` | Checklist pós-venda (contrato feito, assinado, sinal pago, entrada paga, onboarding, grupo, membros, mensagem). FK → crm_leads |
| `touchpoints_agendados` | Touchpoints WhatsApp agendados pré-reunião. `lead_id` (text, não UUID!) |
| `comercial_metas_funil` | Single-row: taxas de conversão entre etapas (pré-vendas e vendas) |
| `dashboard_metas` | Single-row: metas mensais de quantidade (leads, MQL, RM, RR, vendas) |
| `dashboard_metas_etapas` | Single-row: taxas % meta de conversão entre etapas |
| `dashboard_metas_semanal` | Single-row: metas semanais (RM, RR, vendas, contrato, CC) |
| `metas_mensais` | Single-row: metas financeiras mensais (contrato, CC) |

#### Pipeline de etapas:
```
base → triagem → rm_marcada → rm_realizada → fup_ativa → fechado
                                                        ↘ perdido
                                                        ↘ congelado
                                                        ↘ desqualificado
```

#### Campos de responsável (split recente):
- `sdr_responsavel` — SDR que trabalhou o lead (nunca sobrescrito)
- `closer_responsavel` — closer atribuído na reunião (atualizado quando closer muda)
- Em base/triagem o SDR é o responsável; de rm_marcada em diante o closer assume

---

## 3. Frontend — Componentes de Aquisição

### 3.1 CRMView.tsx (~225KB, ~5000+ linhas)

O maior arquivo do projeto. Contém TODO o pipeline de leads:

**Funcionalidades:**
- Kanban board com drag-and-drop entre etapas
- Cards de lead com lead score (A/B/C/D), etiquetas coloridas, tempo na etapa
- Modal do lead com 3 abas: Informações, Timeline, Tarefas
- Formulário "Registrar Atividade" (Ligação ou Reunião):
  - Ligação atendida → touchpoint + botão "Agendar Reunião" (painel BANT completo)
  - Ligação não atendida → motivo
  - Print obrigatório em TODAS as atividades
- Painel BANT: tipo (R1/R2), duração, data/hora, closer, SDR, campos BANT (faturamento, budget, momento, captação, autoridade, necessidade, timing), desafio/dor
- Sistema de alarme para tarefas (popup + som)
- Sorting independente por coluna (4 opções)
- Soft delete (deletado_em)
- Filtros por responsável e etiqueta (pendentes)

**Dados:** Lê direto do Supabase via cliente JS. Não usa webhook.

**Helpers de timezone** definidos no topo:
- `SP_TZ = 'America/Sao_Paulo'`
- `localDatetimeToISO()`, `parseDateSP()`, `fmtDateSP()`, `fmtDateSmartSP()`

### 3.2 DashboardView.tsx (~81KB, ~1500+ linhas)

Dashboard comercial com 7 sub-páginas. Cada aba tem seletor de período independente.

| Sub-página | Fonte de dados | Seletor de período |
|------------|---------------|-------------------|
| Overview | Webhook n8n → Railway views (`view_overview_geral`, `view_vendas_por_mes`, `view_resumo_custos`) + Supabase (`dashboard_metas_etapas`) | Sim (padrão: este ano) |
| Metas Mensais | Webhook n8n → Railway views (`view_metas_mensais`, closers, SDRs, vendas lista) + Supabase (`metas_mensais`, `dashboard_metas`) | Sim (padrão: este mês) |
| Semanal | Webhook n8n → Railway view (`view_semanal_meta_vs_realizado`) + Supabase (`dashboard_metas_semanal`) | Não (fixo) |
| Reuniões do Dia | Webhook n8n → Railway (`view_reunioes_dia`, `view_reunioes_negociacao`) | Não (fixo = hoje) |
| Funis (Análise) | Webhook n8n → Railway views (etapa, programa, motivos, closer ticket, etapa pizza) | Sim (padrão: este mês) |
| KPIs Vendas | Webhook n8n → Railway views (performance por closer, vendas por etapa/programa) | Sim (padrão: 90 dias) |
| KPIs Pré-vendas (SDR) | Webhook n8n → Railway views (SDR produção, SDR eficiência, leads semanal, closer marcação própria) | Sim (padrão: 90 dias) |

**Padrão de fetch:** `GET ${WEBHOOK_BASE}?page=PAGE&data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD`

**Metas editáveis:** As metas (mensais, semanais, de conversão) são lidas do Supabase no frontend e editáveis inline. O webhook/Railway não armazena metas — apenas retorna dados realizados.

### 3.3 App.tsx — Módulo Comercial (~236KB, ~3600 linhas)

Dentro do monolito App.tsx existe a seção de "Aquisição" que contém:
- **Relatório Comercial:** Grid de cards com atividades comerciais (`comercial_tasks`), filtráveis por data, tipo, colaborador. Thumbnail de prints com lightbox.
- **Módulo de demandas de venda** (`crm_demandas_venda`): Checklist pós-venda por lead
- Navegação entre CRM, Dashboard, Relatório, Playbooks

### 3.4 Outros componentes
- `ConsultorIAView.tsx` — Análise de ligações com IA (`analises_ligacao`)
- `PlaybooksView.tsx` — Catálogo de PDFs
- `TranscricaoLigacaoView.tsx` — Transcrição de ligações

---

## 4. Workflows n8n

### 4.1 Sync Meta Leads → CRM (a cada 30min)
Já descrito na seção 2.2. Versão atual: v5.

### 4.2 Dashboard API (Webhook)
**Trigger:** GET `webhook/dashboard?page=...&data_inicio=...&data_fim=...`
**Roteador:** Switch por `page` (overview, metas, semanal, reunioes, analise, anuncios, sdr, trafego, disponibilidade)
**Padrão:** Cada rota executa 2-4 queries no Railway PostgreSQL, faz merge dos resultados, e responde ao webhook.
**Views do Railway consultadas:** `view_overview_geral`, `view_vendas_por_mes`, `view_resumo_custos`, `view_metas_mensais`, `view_semanal_meta_vs_realizado`, `view_reunioes_dia`, `view_reunioes_negociacao`, `view_vendas_por_etapa`, `view_vendas_por_programa`, `view_motivos_nao_fechamento`, `view_performance_por_closer`, `view_performance_por_sdr`, `view_leads_semanal`, `view_closer_marcacao_propria`, `view_performance_anuncios`, `view_producao_semanal_total`, `view_producao_semanal_master`, `v_meta_campaign_daily`

### 4.3 Agendamento de Reunião CRM (Webhook)
**Trigger:** POST `webhook/agendar-reuniao`
**Fluxo:** Processa dados BANT → Cria evento Google Calendar → Extrai link Meet → Envia WhatsApp ao lead (com link) → Envia no grupo comercial → Cancela touchpoints antigos → Cria novos touchpoints → Atualiza `reunioes` no Railway → Salva event ID → Responde OK

### 4.4 CRM Hub → Postgres (Sync reverso)
**Trigger:** POST `webhook/crm-sync-etapa`
**Fluxo:** Recebe payload com mudanças do CRM → Normaliza dados → Gera SQL dinâmico → Atualiza `meta_leads_nt` no Railway + insere/atualiza `reunioes`

### 4.5 Calendar Sync — Liberar Horários
**Trigger:** Google Calendar Trigger (evento cancelado)
**Fluxo:** Filtra cancelamentos → Cancela reunião correspondente no Railway

### 4.6 Touchpoints Reunião
**Trigger:** POST `webhook/touchpoints-agendar` / `webhook/touchpoints-cancelar`
**Fluxo:** Calcula touchpoints (mensagens WhatsApp pré-reunião em intervalos) → Insere em `touchpoints_agendados`

### 4.7 Dispatcher Touchpoints (a cada 5min)
**Trigger:** Schedule
**Fluxo:** Busca touchpoints pendentes com `agendado_para <= NOW()` → Envia WhatsApp → Marca como enviado

### 4.8 Fluxo de Mensagens (Nurturing)
3 workflows separados:
1. **Detector de Leads Novos** (30min) — detecta leads sem fluxo → insere em `fluxo_controle`
2. **Monitor de Mudança de Status** (15min) — detecta mudanças → pausa (RM), encerra (venda), entra follow-up
3. **Dispatcher de Mensagens** — envia templates WhatsApp por etapa (5 etapas de nurturing)

### 4.9 Meta Insights → Postgres (a cada 30min)
Puxa dados de campanha da Meta Marketing API → Upsert em `meta_insights_campaign_daily` no Railway

### 4.10 Disparo em Massa (Manual)
Lê Google Sheets → Envia template WhatsApp → Atualiza status na Sheets

---

## 5. Views do Railway (PostgreSQL)

Todas as views consultadas pelo Dashboard API:

| View | O que retorna |
|------|--------------|
| `view_overview_geral` | Totais acumulados: leads, MQLs, RMs, RRs, vendas, ticket médio, CC médio, MRR médio, TMF, taxas de conversão |
| `view_vendas_por_mes` | Vendas por mês com ticket e CC médio |
| `view_resumo_custos` | CAC, CPL, custo por MQL/RM/RR, verba de mídia |
| `view_metas_mensais` | Realizado vs meta do mês (RM, RR, vendas, contrato, CC, MRR) + negociando |
| `view_semanal_meta_vs_realizado` | Realizado vs meta por semana |
| `view_leads_semanal` | Leads e MQLs por semana |
| `view_producao_semanal_total` | RM, RR, vendas, contrato, CC por semana (todos) |
| `view_producao_semanal_master` | RM, RR, vendas, contrato, CC por semana por closer |
| `view_reunioes_dia` | Reuniões do dia (lead, vendedor, SDR, status, valores) |
| `view_reunioes_negociacao` | Reuniões de negociação ativas (R2+) |
| `view_vendas_por_etapa` | Vendas por TP (R1, R2, R3, R4+) com ticket e CC |
| `view_vendas_por_programa` | Vendas por programa (Pro, Lite, Basic) |
| `view_motivos_nao_fechamento` | Motivos de não-fechamento (No-show, Compareceu, Perdido, etc.) |
| `view_performance_por_closer` | RM, RR, vendas, ticket, CC, taxas por closer |
| `view_performance_por_sdr` | RM, RR, vendas, show rate por SDR |
| `view_performance_anuncios` | Funil completo por anúncio (leads → MQL → RM → RR → vendas + custos) |
| `view_closer_marcacao_propria` | Closers que marcam as próprias reuniões (RM, RR, vendas) |
| `v_meta_campaign_daily` | Dados de campanha Meta Ads por dia |

---

## 6. Trigger/Function no Railway

**`fn_log_alteracoes_leads`** — Trigger AFTER UPDATE em `meta_leads_nt` que loga alterações em `meta_leads_historico`:
- Mudança de `Data_MQL` → log "Marcado como MQL"
- Mudança de `Data_Reuniao_Marcada` → log "Agendamento R1"
- Mudança de `Data_Reuniao_Realizada` → log "Conclusão R1"
- Mudança de `Data_TP` → log "Novo Agendamento (TP)"
- Mudança de `Status_TP` → log "Status Atualizado"
- Mudança de `Data_Venda` → log "VENDA FECHADA"

---

## 7. Time Comercial

| Pessoa | Role | Função |
|--------|------|--------|
| Gabriel Fonseca | Closer/Gerente | Closer principal, gerente comercial |
| Gabriel Moreira | Closer | Closer |
| Vitória Mendes | SDR | Pré-vendas |
| Thalisson Gama | Admin/Owner | Administração + vendas eventuais |
| Pedro Relvas | Ex-membro | Excluído das métricas atuais |
| Carla | Ex-membro | Excluída das métricas atuais |
| Juliana | Financeiro | Recebe notificação WhatsApp de vendas fechadas |

---

## 8. Problemas de Arquitetura Identificados

### 8.1 Monolitos gigantes
- **CRMView.tsx (225KB, ~5000+ linhas):** Todo o pipeline, modal do lead, formulários, helpers de data, lógica de sorting, alarmes — tudo num arquivo só. Qualquer mudança é arriscada.
- **App.tsx (236KB, ~3600 linhas):** Kanban de clientes, equipe, configurações, relatório comercial, demandas, navegação — tudo junto.
- **DashboardView.tsx (81KB):** 7 sub-páginas num arquivo.

### 8.2 Duas fontes de verdade parciais
O Railway tem os dados brutos do lead (`meta_leads_nt`) e o Supabase tem o estado do CRM (`crm_leads`). Nenhum é completo sozinho:
- Railway tem datas históricas (MQL, reunião marcada/realizada, TP, venda) que o Supabase não tem como campos separados
- Supabase tem soft delete, tags, lead score, etapa_desde, tp_atual que o Railway não tem
- O sync é eventually consistent (30min delay) e one-way com webhook reverso que pode falhar silenciosamente

### 8.3 Dashboard busca dados via webhook+n8n em vez de query direta
O DashboardView faz `fetch(webhook)` → n8n recebe → roda query no Railway → responde. Isso adiciona latência, um ponto de falha (n8n), e torna as queries invisíveis no código do app. Alternativa: consultar Railway diretamente via Supabase Foreign Data Wrapper ou via API REST própria.

### 8.4 Tabela `comercial_tasks` desnormalizada e desconectada
`comercial_tasks` é um log flat sem FK para `crm_leads`. Duplica dados que já existem em `crm_atividades`. Serviu como tabela do relatório, mas agora que `crm_atividades` existe com mais contexto, é redundante.

### 8.5 Tabelas de metas espalhadas
4 tabelas de metas (todas single-row): `dashboard_metas`, `dashboard_metas_etapas`, `dashboard_metas_semanal`, `metas_mensais`, `comercial_metas_funil`. Poderiam ser consolidadas.

### 8.6 Mistura de idiomas e convenções
- Railway usa PascalCase com aspas (`"Data_MQL"`, `"Status_TP"`)
- Supabase CRM interno usa snake_case (`closer_responsavel`, `sdr_responsavel`)
- Frontend types mistura camelCase (`closerResponsavel`) com snake_case nos mappers
- `touchpoints_agendados.lead_id` é TEXT, enquanto `crm_leads.id` é UUID
- `comercial_tasks.created_at` é TEXT (não timestamp!)

### 8.7 Sem RLS / Sem autenticação real
Login é por email/senha em texto simples na tabela `team_members`. Sem Supabase Auth, sem RLS, sem tokens. Qualquer pessoa com a URL da API Supabase tem acesso total.

### 8.8 Pendência: visão de caixa
Conforme discutido na reunião com Gabriel Fonseca, falta separar: valor contrato vendido vs valor primeira parcela prevista vs valor efetivamente pago. A comissão do closer deveria ser vinculada ao pagamento, não à assinatura.

---

## 9. Mapa de Dependências

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                     FRONTEND (React SPA)                │
                    │                                                         │
                    │  App.tsx ──────────▶ Supabase (clients, team, config)   │
                    │     └── Relatório ──▶ Supabase (comercial_tasks)        │
                    │     └── Demandas ───▶ Supabase (crm_demandas_venda)     │
                    │                                                         │
                    │  CRMView.tsx ──────▶ Supabase (crm_leads, atividades,  │
                    │     │                 tarefas) + Storage (prints)       │
                    │     └── Agendar ───▶ Webhook n8n (agendar-reuniao)     │
                    │     └── Sync etapa ▶ Webhook n8n (crm-sync-etapa)      │
                    │                                                         │
                    │  DashboardView.tsx ─▶ Webhook n8n (dashboard API)       │
                    │     └── Metas ─────▶ Supabase (4 tabelas de metas)     │
                    └─────────────────────────────────────────────────────────┘
                                           │
                              ┌─────────────┼─────────────┐
                              ▼             ▼             ▼
                         ┌─────────┐  ┌─────────┐  ┌──────────┐
                         │Supabase │  │  n8n    │  │  Meta    │
                         │ (Nano)  │  │ (self)  │  │  API     │
                         └────┬────┘  └────┬────┘  └────┬─────┘
                              │            │             │
                              │       ┌────▼────┐        │
                              │       │ Railway │◀───────┘ (insights)
                              │       │Postgres │
                              │       └────┬────┘
                              │            │
                              │     ┌──────▼──────┐
                              │     │  Google     │
                              │     │  Calendar   │
                              │     └─────────────┘
                              │
                         ┌────▼────────┐
                         │  Evolution  │
                         │  API (Wpp)  │
                         └─────────────┘
```

---

## 10. Inventário Completo de Tabelas

### Supabase — Aquisição (12 tabelas)
1. `crm_leads` — leads do pipeline
2. `crm_atividades` — atividades por lead
3. `crm_tarefas` — tarefas agendadas
4. `crm_demandas_venda` — checklist pós-venda
5. `comercial_tasks` — log de atividades (relatório)
6. `touchpoints_agendados` — touchpoints WhatsApp
7. `dashboard_metas` — metas mensais quantidade
8. `dashboard_metas_etapas` — taxas de conversão meta
9. `dashboard_metas_semanal` — metas semanais
10. `metas_mensais` — metas financeiras mensais
11. `comercial_metas_funil` — taxas de funil
12. `analises_ligacao` — análises de ligações com IA

### Supabase — Operação/Clientes (13 tabelas)
1. `clients` — clientes da agência
2. `team_members` — membros da equipe
3. `tags` — etiquetas
4. `agency_config` — configuração da agência
5. `demands` — demandas de operação
6. `crm_client_tenants` — tenants multi-tenant (CRM do cliente)
7. `crm_client_pipelines` — pipelines por tenant
8. `crm_client_stages` — estágios por pipeline
9. `crm_client_leads` — leads do CRM do cliente
10. `crm_client_lead_activities` — atividades do CRM do cliente
11. `crm_client_tarefas` — tarefas do CRM do cliente
12. `crm_client_tags` — tags por tenant
13. `crm_client_users` — usuários por tenant

### Supabase — Outros
1. `crm_client_documentos` — documentos por tenant
2. `crm_client_materiais` — materiais por tenant
3. `crm_documentos_globais` — documentos globais
4. `lp_clients` — clientes de LP
5. `lp_offers` — ofertas de LP
6. `educacao_modulos` — módulos educação
7. `educacao_aulas` — aulas
8. `educacao_progresso` — progresso por usuário

### Railway (principais)
1. `meta_leads_nt` — leads brutos do Meta
2. `reunioes` — log de reuniões
3. `meta_insights_campaign_daily` — métricas de campanha
4. `meta_leads_historico` — log de alterações (via trigger)
5. `fluxo_controle` — controle do fluxo de nurturing
6. ~16 views materializadas para o Dashboard

---

## 11. Workflows n8n — Inventário

| # | Workflow | Trigger | Frequência |
|---|----------|---------|------------|
| 1 | Sync Meta Leads → CRM | Schedule + Webhook | 30min |
| 2 | Dashboard API | Webhook | On-demand |
| 3 | Agendamento Reunião CRM | Webhook | On-demand |
| 4 | CRM Hub → Postgres | Webhook | On-demand |
| 5 | Calendar Sync | Google Calendar Trigger | Eventos |
| 6 | Touchpoints Reunião | Webhook | On-demand |
| 7 | Dispatcher Touchpoints | Schedule | 5min |
| 8 | Detector Leads Novos | Schedule | 30min |
| 9 | Monitor Mudança Status | Schedule | 15min |
| 10 | Dispatcher Mensagens | Schedule | Variável |
| 11 | Meta Insights → Postgres | Schedule | 30min |
| 12 | Disparo em Massa | Manual | Manual |
| 13 | Nativo → Sheets/Postgres | Schedule + Webhook | Variável |
| 14 | Real-time Sheets → Postgres | Webhook | On-demand |

---

## 12. Resumo para Refatoração

**Prioridade 1 — Quebrar monolitos:**
- CRMView.tsx → extrair: KanbanBoard, LeadCard, LeadModal (Info/Timeline/Tarefas), NovaAtividadeForm, PainelBANT, TaskAlarm, hooks (useLeads, useTarefas, useAtividades)
- DashboardView.tsx → extrair: cada sub-página como componente + hook `useDashboardData(page)`
- App.tsx → extrair: RelatorioComercial, DemandasVenda, Navigation, TeamManagement

**Prioridade 2 — Unificar fonte de dados:**
- Considerar eliminar o intermediário n8n para o Dashboard e consultar Railway diretamente (Supabase FDW ou API REST via Edge Function)
- Consolidar `comercial_tasks` como view em cima de `crm_atividades` (ou migrar dados e deprecar)

**Prioridade 3 — Normalizar metas:**
- Unificar 5 tabelas de metas em 1-2 tabelas com schema normalizado (tipo, período, valor_meta, valor_realizado)

**Prioridade 4 — Implementar visão de caixa:**
- Adicionar campo `pago` / `data_pagamento` em `crm_demandas_venda` ou nova tabela `pagamentos`
- Separar métrica de contrato vendido vs caixa recebido no Dashboard

**Prioridade 5 — Segurança:**
- Migrar para Supabase Auth
- Habilitar RLS
- Remover senhas em texto da tabela `team_members`
