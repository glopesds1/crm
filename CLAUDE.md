# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Hub M² Black** — plataforma interna de gestão comercial e de clientes da agência M² Black, especializada em marketing para construção civil. React SPA + Supabase + n8n. UI em português brasileiro (pt-BR).

URL de produção: `clientes.m2black.com` (Cloudflare Pages)
Repositório: `thalisson-gama/ClientOps`

---

## Commands

- `npm run dev` — Dev server na porta 3000
- `npm run build` — Build de produção
- `npm run lint` — Type-check com `tsc --noEmit`
- `npm run clean` — Remove dist/

---

## Environment Variables

Arquivo `.env` na raiz (nunca commitar — está no .gitignore):

```
VITE_SUPABASE_URL=https://nlvjlgjztngiixcpumfe.supabase.co
VITE_SUPABASE_KEY=(anon key)
VITE_SUPABASE_SERVICE_KEY=(service_role key — usado só pelo supabaseAdmin no frontend pra operações admin)
```

---

## Stack Completa

- **Frontend:** React 19 + TypeScript + Vite 6 + Tailwind CSS v4
- **Animações:** `motion` (framer-motion v12) — usar sempre `motion/react`, não `framer-motion`
- **Ícones:** lucide-react
- **Gráficos:** recharts
- **PDF:** jsPDF + jspdf-autotable
- **Datas:** date-fns (v4) — NÃO usar `format()` do date-fns no CRM; usar helpers `fmtDateSP`/`parseDateSP` com timezone fixo `America/Sao_Paulo`
- **Backend:** Supabase (PostgreSQL gerenciado) — ÚNICO banco de dados
- **Automações:** n8n self-hosted em `webhook.m2black.com`
- **Auth:** Supabase Auth (signInWithPassword, resetPassword, MFA)
- **RLS:** Habilitado em todas as tabelas (exceto analises_ligacao, lp_clients, lp_offers). Policy: `auth_full_access` permite tudo pra `authenticated`.
- **Cor brand:** `#00FF88` (brand-primary)
- **Tema:** dark, CSS variables definidas em `src/index.css`

---

## Arquitetura dos Arquivos (estado atual — monolitos a reestruturar)

```
src/
  App.tsx           ← monolito principal (~3600 linhas) com navegação, kanban de clientes,
                      gestão de equipe, configurações, notificações, módulo Comercial
  DashboardView.tsx ← dashboard comercial com 7 sub-páginas, busca dados via supabase.rpc()
  CRMView.tsx       ← pipeline de leads (kanban CRM) com Supabase direto
  PlaybooksView.tsx ← catálogo de PDFs em /public/playbooks/
  types.ts          ← tipos compartilhados
  constants.ts      ← colunas kanban, mock data, config inicial
  lib/
    supabase.ts     ← cliente Supabase (anon key) + supabaseAdmin (service_role key)
    database.ts     ← CRUD para clients, team_members, tags, agency_config, comercial_tasks
```

### Estrutura alvo (reestruturação pendente)

```
src/
├── auth/
│   └── AuthProvider.tsx, LoginPage.tsx, useSession.ts
├── shared/
│   ├── hooks/ (useSupabase.ts, useRealtime.ts)
│   ├── components/ (Layout.tsx, Sidebar.tsx, DatePicker.tsx, Lightbox.tsx)
│   ├── lib/ (supabase.ts, dateHelpers.ts, formatters.ts)
│   └── types.ts
├── dashboard/
│   ├── DashboardPage.tsx
│   ├── hooks/ (useDashboardData.ts)
│   └── components/ (OverviewTab, MetasMensaisTab, SemanalTab, ReunioesTab, FunisTab, KPIVendasTab, KPIPreVendasTab)
├── crm/
│   ├── CRMPage.tsx
│   ├── hooks/ (useLeads.ts, useAtividades.ts, useTarefas.ts)
│   └── components/ (KanbanBoard, LeadCard, LeadModal/, AtividadeForm, PainelBANT, TaskAlarm)
├── relatorio/
│   ├── RelatorioPage.tsx
│   ├── hooks/ (useRelatorioData.ts)
│   └── components/ (RelatorioGrid, Filtros)
├── playbooks/
│   └── PlaybooksPage.tsx
└── App.tsx (~100 linhas, só rotas + AuthProvider)
```

**Regra:** cada pasta só importa de `shared/` e de si mesma. Nenhum módulo importa de outro módulo.

---

## Banco de Dados — Supabase (ÚNICO)

### Tabelas do CRM (aquisição)
- `crm_leads` — leads do pipeline com datas completas (data_entrada, data_mql, data_reuniao_marcada, data_reuniao_realizada, data_tp, data_fechamento), lead_score, lead_grade, closer_responsavel, sdr_responsavel, soft delete (deletado_em)
- `crm_atividades` — timeline de atividades por lead (FK → crm_leads)
- `crm_tarefas` — tarefas agendadas por lead (FK → crm_leads)
- `crm_demandas_venda` — checklist pós-venda (contrato, assinatura, sinal, entrada, onboarding, grupo, membros, mensagem)
- `comercial_tasks` — log flat de atividades comerciais (relatório) — a ser eliminado
- `reunioes` — log de reuniões (event-log model) com crm_lead_id, lead_externo_id, tp, status, closer, sdr, dados financeiros
- `meta_insights_campaign_daily` — dados de campanha Meta Ads por dia
- `meta_leads_historico` — log de alterações de leads (alimentado por trigger)
- `touchpoints_agendados` — touchpoints WhatsApp pré-reunião
- `fluxo_controle` — controle do fluxo de nurturing
- `fluxo_sequencia` — sequência de templates do fluxo

### Tabelas de metas
- `metas` — tabela UNIFICADA com tipo/periodo/metrica/valor (substituiu 5 tabelas)
- `dashboard_metas`, `dashboard_metas_etapas`, `dashboard_metas_semanal`, `metas_mensais`, `comercial_metas_funil` — tabelas antigas, ainda lidas pelo frontend, a serem migradas pra `metas`

### Tabelas de operação/clientes
- `clients` — clientes da agência
- `team_members` — membros da equipe com roles + auth_user_id (vinculado ao Supabase Auth)
- `tags` — etiquetas
- `agency_config` — configuração da agência
- `demands` — demandas de operação

### Filas de processamento (trigger-based)
- `agendamento_queue` — fila pra agendamento/cancelamento de reuniões (trigger: processar_agendamento)
- `fluxo_queue` — fila pra mudanças de status no fluxo (trigger: processar_fluxo_queue)
- `touchpoints_queue` — fila pra marcar touchpoints como enviado/cancelado (trigger: processar_touchpoints_queue)

### Views
- `view_producao_semanal_total` — produção semanal (RM, RR, vendas, contrato, CC)
- `fluxo_leads_para_envio` — leads prontos pra receber mensagem do fluxo

### Functions (RPC) — Dashboard
- `dashboard_overview_kpis(di, df)` — KPIs gerais + TMF
- `dashboard_overview_vendas_mes(di, df)` — vendas por mês
- `dashboard_overview_custos(di, df)` — custos (verba, CPL, CAC, etc.)
- `dashboard_metas_realizado(di, df)` — realizado vs meta + por_tp
- `dashboard_metas_closer(di, df)` — performance por closer
- `dashboard_metas_sdr(di, df)` — performance por SDR
- `dashboard_metas_vendas_lista(di, df)` — lista de vendas do período
- `dashboard_reunioes_dia(di, p_closer)` — reuniões do dia
- `dashboard_reunioes_negociacao(di)` — reuniões de negociação (R2+)
- `dashboard_disponibilidade(di)` — horários ocupados
- `dashboard_analise_etapa(di, df)` — vendas por etapa
- `dashboard_analise_programa(di, df)` — vendas por programa
- `dashboard_analise_motivos(di, df)` — motivos de não-fechamento
- `dashboard_kpi_closer(di, df)` — KPI por closer com ticket/CC
- `dashboard_sdr_producao(di, df)` — produção SDR
- `dashboard_sdr_leads_semanal()` — leads semanal
- `dashboard_anuncios_funil(di, df)` — funil por anúncio

### Triggers
- `trg_log_alteracoes_crm_leads` — loga alterações em meta_leads_historico
- `trg_processar_agendamento` — processa agendamento_queue
- `trg_processar_fluxo` — processa fluxo_queue
- `trg_processar_touchpoints` — processa touchpoints_queue

---

## Segurança

- **RLS:** Habilitado em todas as tabelas (exceto analises_ligacao, lp_clients, lp_offers)
- **Policy:** `auth_full_access` — `authenticated` pode tudo (SELECT, INSERT, UPDATE, DELETE)
- **anon:** Bloqueado de tudo (sem policy)
- **service_role:** Usado pelo n8n (ignora RLS)
- **Frontend:** Usa anon key → após login vira authenticated → RLS permite acesso
- **Senhas:** Gerenciadas pelo Supabase Auth (não mais em texto na tabela)

---

## Controle de Acesso (Roles)

| Role | Acesso |
|---|---|
| `admin` | Tudo — Dashboard, Clientes, Kanban, Equipe, Relatórios, Aquisição, Playbooks, Configurações |
| `comercial` | Aquisição, Playbooks |
| `suporte` | Clientes, Kanban de Operação, Relatórios, Playbooks |
| `entrega` | Clientes, Kanban de Operação, Relatórios, Playbooks |

Default tab: Admin→Dashboard, Comercial→Aquisição (CRM), outros→Clientes.

---

## CRM — Pipeline de Etapas

```
base → triagem → rm_marcada → rm_realizada → fup_ativa → fechado
                                                        ↘ perdido
                                                        ↘ congelado
                                                        ↘ desqualificado
```

**Etiquetas:** MQL, No-show, Programa Pro, Programa Lite, Programa Basic, Contrato na Mão, Link na Mão

**Responsáveis:**
- `sdr_responsavel` — SDR que trabalhou o lead (nunca sobrescrito)
- `closer_responsavel` — closer atribuído na reunião

---

## Dashboard Comercial — Sub-páginas

7 sub-páginas, TODAS leem do Supabase via `supabase.rpc()` (sem webhook n8n):

| Aba | Functions RPC |
|---|---|
| Overview | `dashboard_overview_kpis`, `dashboard_overview_vendas_mes`, `dashboard_overview_custos` |
| Metas Mensais | `dashboard_metas_realizado`, `dashboard_metas_closer`, `dashboard_metas_sdr`, `dashboard_metas_vendas_lista` |
| Semanal | `view_producao_semanal_total` (view, não RPC) |
| Reuniões do Dia | `dashboard_reunioes_dia`, `dashboard_reunioes_negociacao`, `dashboard_disponibilidade` |
| Funis | `dashboard_analise_etapa`, `dashboard_analise_programa`, `dashboard_analise_motivos`, `dashboard_kpi_closer` |
| KPI's Vendas | `dashboard_kpi_closer`, `dashboard_analise_etapa`, `dashboard_analise_programa` |
| KPI's Pré-vendas | `dashboard_sdr_producao`, `dashboard_sdr_leads_semanal`, `dashboard_anuncios_funil` |

---

## n8n Workflows

| # | Workflow | Trigger | O que faz |
|---|----------|---------|-----------|
| 1 | Sync Meta Leads → CRM | Schedule 30min | Sheets → Supabase crm_leads |
| 2 | Agendamento Reunião CRM | Webhook | Calendar + WhatsApp + agendamento_queue |
| 3 | Calendar Sync | Google Calendar Trigger | Cancelamento → agendamento_queue |
| 4 | Touchpoints Reunião | Webhook | Cria touchpoints pré-reunião |
| 5 | Dispatcher Touchpoints | Schedule 5min | Envia WhatsApp dos touchpoints |
| 6 | Detector Leads Novos | Schedule 30min | Detecta leads MQL → fluxo_controle |
| 7 | Monitor Mudança Status | Schedule 15min | Pausa/encerra/followup no fluxo |
| 8 | Dispatcher Mensagens | Schedule | Envia templates WhatsApp do fluxo |
| 9 | Meta Insights → Supabase | Schedule 30min | Meta API → meta_insights_campaign_daily |
| 10 | Nativo → Sheets | Schedule + Webhook | Facebook → Sheets (backup) |

Todos usam **service_role key** nos headers (ignora RLS).

---

## Time Comercial

- **Gabriel Fonseca** — Closer/Gerente comercial
- **Gabriel Moreira** — Closer
- **Vitória Mendes** — SDR
- **Thalisson Gama** — Admin/Owner
- Pedro Relvas e Carla — ex-membros, excluídos das métricas

---

## Padrões de Código

- Sempre usar `import.meta.env.VITE_*` para env vars
- Animações: `import { motion, AnimatePresence } from 'motion/react'`
- Arrays do Supabase: tratar como `Array.isArray(d) ? d : d ? [d] : []`
- Datas no CRM: usar `fmtDateSP(iso, opts?)` e `parseDateSP(iso)` — nunca `format()` do date-fns
- Salvar datas de `<input type="datetime-local">`: usar `localDatetimeToISO(dt)` que anexa `-03:00`
- Não modificar seções marcadas como TRAVADO nos DashboardView.tsx

---

## Pendências Conhecidas

### Pós-migração (mudanças pontuais)
1. Venda só conta no dashboard quando checklist `crm_demandas_venda` estiver 100% completo
2. Gráfico "Vendas por Mês" no Overview mostra mês anterior quando filtro é "Este Mês"
3. Filtrar vendas do mês por vendedor na aba Metas Mensais
4. Funis: repensar lógica de filtro (filtrar só por data_entrada e mostrar funil completo)
5. Reuniões do Dia: horário mostrando segundos (cortar no frontend)

### Estrutural
6. Reestruturar monolitos: CRMView.tsx (225KB), App.tsx (236KB), DashboardView.tsx (81KB)
7. Eliminar `comercial_tasks` — substituir por view/query em `crm_atividades`
8. Migrar frontend pra usar tabela `metas` unificada (em vez das 5 tabelas antigas)
9. Desligar Railway definitivamente
