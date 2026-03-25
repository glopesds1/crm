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
VITE_SUPABASE_KEY=sb_publishable_8GYm9Gs9VLyYHJgc3oZgmw_GyXrbOXj
VITE_WEBHOOK_BASE=https://webhook.m2black.com/webhook/dashboard
VITE_SYNC_CRM_WEBHOOK=https://webhook.m2black.com/webhook/sync-crm-leads
```

---

## Stack Completa

- **Frontend:** React 19 + TypeScript + Vite 6 + Tailwind CSS v4
- **Animações:** `motion` (framer-motion v12) — usar sempre `motion/react`, não `framer-motion`
- **Ícones:** lucide-react
- **Gráficos:** recharts
- **PDF:** jsPDF + jspdf-autotable
- **Datas:** date-fns (v4) — NÃO usar `format()` do date-fns no CRM; usar helpers `fmtDateSP`/`parseDateSP` com timezone fixo `America/Sao_Paulo`
- **Backend:** Supabase (PostgreSQL gerenciado) — plano Nano
- **Banco externo:** PostgreSQL no Railway (dados de leads e métricas de campanha)
- **Automações:** n8n self-hosted em `webhook.m2black.com`
- **Cor brand:** `#00FF88` (brand-primary)
- **Tema:** dark, CSS variables definidas em `src/index.css`

---

## Arquitetura dos Arquivos

```
src/
  App.tsx           ← monolito principal (~3600 linhas) com navegação, kanban de clientes,
                      gestão de equipe, configurações, notificações, módulo Comercial
  DashboardView.tsx ← dashboard comercial com 7 sub-páginas, busca dados via webhook n8n
  CRMView.tsx       ← pipeline de leads (kanban CRM) com Supabase direto
  PlaybooksView.tsx ← catálogo de PDFs em /public/playbooks/
  types.ts          ← tipos compartilhados
  constants.ts      ← colunas kanban, mock data, config inicial
  lib/
    supabase.ts     ← cliente Supabase (lê env vars)
    database.ts     ← CRUD para clients, team_members, tags, agency_config, comercial_tasks
```

---

## Banco de Dados — Supabase

**Tabelas principais:**
- `clients` — clientes da agência (gestão de entregas)
- `team_members` — membros da equipe com roles
- `tags` — etiquetas de clientes
- `agency_config` — configuração da agência (logo, nome)
- `comercial_tasks` — registros de atividades comerciais (pré-vendas/vendas)

**Tabelas do CRM:**
- `crm_leads` — leads do pipeline (sincronizado do Railway via n8n)
- `crm_atividades` — timeline de atividades por lead
- `crm_tarefas` — tarefas agendadas por lead

**Tabelas de metas do Dashboard:**
- `dashboard_metas_etapas` — taxas % de conversão entre etapas do funil (Overview)
- `dashboard_metas` — metas de quantidade mensal (RM, RR, Vendas)
- `dashboard_metas_semanal` — metas semanais (RM, RR, Vendas, Contrato, CC)
- `metas_mensais` — metas financeiras mensais (meta_contrato, meta_cc)

**RLS:** desabilitado em todas as tabelas (desenvolvimento). Habilitar antes de liberar para clientes.

---

## Banco de Dados — Railway (PostgreSQL externo)

Tabelas principais:
- `meta_leads_nt` — leads vindos do Facebook Lead Ads (1900+ registros)
- `meta_insights_campaign_daily` — métricas de campanha Meta Ads
- `view_producao_semanal_total` — view de produção semanal agregada

O n8n sincroniza `meta_leads_nt` → `crm_leads` no Supabase a cada 30min.

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

**Regra importante:** todos os leads entram em `base`, independente de ter Data_MQL. MQL é etiqueta, não etapa.

**Etiquetas disponíveis:** MQL, No-show, Programa Pro, Programa Lite, Programa Basic, Contrato na Mão, Link na Mão

**Permissões CRM:** admin vê todos os leads; SDR/Closer vê apenas os que estão como responsável.

---

## CRM — Registrar Atividade (NovaAtividadeForm)

**Campos do formulário:**
1. **Tipo:** Ligação ou Reunião
2. **Responsável pela atividade:** seletor com membros da equipe comercial, pré-selecionado com o responsável pela oportunidade (`lead.responsavel`)
3. **Print da tela:** obrigatório para TODAS as atividades (ligação e reunião)
4. Campos específicos por tipo (veja abaixo)

**Ligação → Atendeu:**
- Touchpoint (número)
- Botão "Agendar Reunião" → abre painel BANT completo (substitui o antigo checkbox "Marcou reunião")

**Ligação → Não atendeu:**
- Motivo (select)

**Painel BANT (agendamento de reunião dentro da ligação):**
- Tipo (R1/R2), Duração, Data/hora*, Closer responsável*, SDR responsável*
- BANT: Faturamento, Budget, Momento, Captação, Autoridade, Necessidade, Timing
- Desafio/dor/observações
- Ao salvar: envia ao webhook `agendar-reuniao`, cria tarefa em `crm_tarefas`, move lead para `rm_marcada`, atualiza responsável do lead para o Closer selecionado

**Regra de responsável no relatório (`comercial_tasks.collaborator`):**
- **Ligações e reuniões:** `collaborator` = responsável pela atividade (campo selecionado no form, default = responsável pela oportunidade)
- **Tarefas agendadas:** `collaborator` = responsável pela tarefa (`tarefa.responsavel`), mesmo que diferente do responsável pelo lead

**Onde NÃO aparece mais:**
- "Resumo da ligação" — removido do form de ligação
- "Agendar próxima atividade" — removido do form, movido para aba Tarefas
- Botão "Agendar Reunião" — removido da aba Informações (fica apenas dentro do form de ligação atendida)

---

## CRM — Card do Lead (LeadModal)

**Aba Informações:** telefone, origem, área de atuação, faturamento, responsável, etapa, etiquetas, observações, negociação (se aplicável). Botões: "Registrar atividade" e "Agendar Tarefa" (redireciona para aba Tarefas).

**Aba Timeline:** histórico de atividades do lead.

**Aba Tarefas:** lista de tarefas agendadas com botão "Agendar próxima atividade" (form inline: título*, data/hora*, responsável).

---

## CRM — Tarefas Agendadas

**Fluxo de conclusão:**
1. Usuário clica "Concluir" na tarefa (modal ou popup de alarme)
2. Painel de upload abre — é obrigatório anexar print antes de confirmar
3. Imagem é enviada ao bucket `comercial-prints` no Supabase Storage
4. Ao confirmar:
   - `crm_tarefas` → marca `concluida: true`
   - `crm_atividades` → insere registro tipo `'tarefa'` com `imagem_url` (aparece na timeline do lead como "Tarefa Concluída")
   - `comercial_tasks` → insere no relatório com `category: 'Tarefa'`

**Notificações (alarme de tarefas):**
- Aparecem apenas para o responsável pela tarefa (`tarefa.responsavel`) ou o responsável pela oportunidade (`lead.responsavel`)
- Admin **não** recebe notificações de todas as tarefas — somente das que é responsável

**Helpers de timezone (topo de CRMView.tsx):**
- `SP_TZ = 'America/Sao_Paulo'` — constante de timezone
- `localDatetimeToISO(dt)` — converte datetime-local para ISO com offset `-03:00`
- `parseDateSP(iso)` — parse de data do Supabase, trata strings sem offset como São Paulo
- `fmtDateSP(iso, opts?)` — formata data usando `Intl.DateTimeFormat` com timezone SP

---

## Dashboard Comercial — Sub-páginas

7 sub-páginas com seletor de período independente por aba:

| Aba | Seletor | Padrão |
|---|---|---|
| Overview | ✅ | Este ano |
| Metas Mensais | ✅ | Este mês |
| Semanal | ❌ (fixo) | — |
| Reuniões do Dia | ❌ (fixo = hoje) | — |
| Funis | ✅ | Este mês |
| KPI's Vendas | ✅ | 90 dias |
| KPI's Pré-vendas | ✅ | 90 dias |

**Webhook URL:** `https://webhook.m2black.com/webhook/dashboard?page=PAGE&data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD`

**Pages:** `overview` | `metas` | `semanal` | `reunioes` | `analise` | `anuncios` | `sdr`

---

## n8n Workflows Relevantes

- **Sync CRM:** `POST https://webhook.m2black.com/webhook/sync-crm-leads` — sincroniza Railway → Supabase crm_leads em lotes de 50
- **Agendar Reunião:** `POST https://webhook.m2black.com/webhook/agendar-reuniao` — recebe payload BANT e notifica o closer
- **Dashboard API:** responde ao webhook do dashboard com dados do Railway
- **Supabase Keepalive:** pinga o Supabase a cada 5 dias para evitar pause no plano Nano

---

## Time Comercial

- **Closers:** Gabriel Fonseca (gerente comercial), Carla, Gabriel Moreira
- **SDRs:** Vitória Mendes, Pedro Relvas

---

## Relatório Comercial (App.tsx — módulo Aquisição)

**Histórico de atividades:** grid de cards com thumbnail da imagem enviada. Ao clicar na imagem, abre lightbox em tela cheia (state `lightboxUrl`).

---

## Padrões de Código

- Sempre usar `import.meta.env.VITE_*` para acessar env vars (nunca hardcodar URLs ou chaves)
- Animações: `import { motion, AnimatePresence } from 'motion/react'` (não `framer-motion`)
- Arrays do Supabase: sempre tratar como `Array.isArray(d) ? d : d ? [d] : []`
- Ao paginar o Supabase, deduplicar por `id` após juntar as páginas
- Datas no CRM: usar os helpers `fmtDateSP(iso, opts?)` e `parseDateSP(iso)` definidos no topo de `CRMView.tsx` — nunca usar `format()` do date-fns nem `toLocaleDateString()` sem `timeZone: 'America/Sao_Paulo'`
- Ao salvar datas de `<input type="datetime-local">`, usar `localDatetimeToISO(dt)` que anexa `-03:00` (São Paulo, sem horário de verão desde 2019)
- Não modificar seções marcadas como TRAVADO nos comentários do DashboardView.tsx

---

## Pendências Conhecidas (lista priorizada)

### CRM
1. Botão de ligar → abrir WhatsApp Beta
2. ~~Timeline → integrar com histórico do módulo Comercial~~ ✅ Tarefas concluídas aparecem na timeline
3. ~~Tarefas → alarme sonoro e visual~~ ✅ Implementado com popup + som + botão concluir com print
4. Ao selecionar tarefa no histórico → abrir card do lead
5. Informações financeiras pós-reunião editáveis no card
6. Filtro por responsável no kanban
7. Filtro por etiqueta
8. Sync de etapa → atualizar de volta no Postgres/Sheets
25. ~~Agendamento BANT no fluxo de ligação atendida~~ ✅ Botão + painel BANT com webhook
26. ~~Print obrigatório em todas as atividades~~ ✅ Validação universal
27. ~~Lightbox no histórico do relatório~~ ✅ Clique na imagem abre tela cheia
28. ~~Responsável pela atividade no form~~ ✅ Seletor pré-preenchido com responsável da oportunidade
29. ~~Reorganizar card do lead (info/atividades/tarefas)~~ ✅ Agendar tarefa na aba Tarefas, removido Agendar Reunião da info

### Dashboard
9. Negociando → mostrar apenas leads do mês vigente
10. KPI's Pré-vendas → implementar (aguardando tabela de ligações)
11. ~~Diferença timezone leads/RR vs Looker Studio~~ ✅ Timezone fixo America/Sao_Paulo

### App geral
12. Botão de esconder a barra lateral
13. Notificação sem botão de fechar
14. Botão de renovar (aba Clientes) sem funcionalidade
15. Melhoria visual do CRM

### Segurança (última etapa — antes de liberar para clientes)
16. Login real via Supabase Auth com verificação de senha
17. Tratar exceções — erros não podem expor detalhes técnicos
18. Redefinição de senha
19. Autenticação em dois fatores
20. Política de cookies e tratamento de dados
21. RLS no Supabase
22. Isolamento de dados por cliente
23. Automações n8n ao fechar venda
24. Teste de estresse com Gabriel Gama
