# REESTRUTURAÇÃO FRONTEND — Hub M² Black
## Plano Mestre de Execução

> 4 fases sequenciais. Cada fase produz build funcional.
> Total estimado: ~4-6h de trabalho com Claude Code.

---

## Visão Geral

### Estado atual (monolitos)
| Arquivo | Linhas | Tamanho | Conteúdo |
|---------|--------|---------|----------|
| `App.tsx` | 2.884 | 125KB | Login, sidebar, clientes, equipe, relatórios, navegação |
| `CRMView.tsx` | 4.279 | 239KB | Pipeline kanban, modal lead, atividades, BANT, alarmes |
| `DashboardView.tsx` | 1.621 | 83KB | 7 sub-páginas de métricas comerciais |
| **Total** | **8.784** | **447KB** | |

### Estado alvo (~35 arquivos)
```
src/
├── App.tsx                     (~100 linhas, só rotas)
├── auth/LoginPage.tsx
├── shared/
│   ├── types.ts
│   ├── constants.ts
│   ├── hooks/ (useSession, useAppData)
│   ├── components/ (Layout, SidebarItem, MetricCard, LoadingScreen, ...)
│   └── lib/ (supabase, database, dateHelpers, formatters, leadScore, webhooks)
├── dashboard/
│   ├── DashboardPage.tsx
│   ├── hooks/useDashboardData.ts
│   └── components/ (7 tabs + 7 átomos UI)
├── crm/
│   ├── CRMPage.tsx
│   ├── hooks/ (useLeads, useTarefas, useDemandas)
│   └── components/ (KanbanBoard, LeadCard, LeadModal/, NovaAtividadeForm, ...)
├── clientes/
│   ├── ClientesPage.tsx
│   ├── KanbanOperacaoPage.tsx
│   ├── SettingsPage.tsx
│   └── components/ (ClientModal, ClientCard, ...)
├── equipe/ (EquipePage, TeamMemberModal)
├── relatorio/ (RelatorioPage, ComercialPage)
└── playbooks/ (PlaybooksPage — já existe isolado)
```

**Regra:** Cada módulo importa APENAS de `shared/` e de si mesmo. Zero imports cruzados.

---

## Ordem de Execução

### Fase 1 — shared/ (fundação)
📄 **Prompt:** `fase1-shared.md`
⏱️ ~45min
🎯 Cria tipos, constants, helpers, lib compartilhados
✅ Critério: `npm run build` passa (nada importa de shared/ ainda)

### Fase 2 — dashboard/
📄 **Prompt:** `fase2-dashboard.md`
⏱️ ~45min
🎯 Quebra DashboardView em 15 arquivos (7 tabs + 7 UI atoms + hook + page)
✅ Critério: Dashboard funciona no browser (7 abas + filtros)

### Fase 3 — crm/
📄 **Prompt:** `fase3-crm.md`
⏱️ ~2h (o maior monolito)
🎯 Quebra CRMView em ~15 arquivos (kanban, modals, forms, hooks)
✅ Critério: CRM funciona (kanban, modal, atividades, alarmes)

### Fase 4 — App.tsx + auth + clientes + equipe + relatorio
📄 **Prompt:** `fase4-app-final.md`
⏱️ ~1.5h
🎯 Extrai tudo do App.tsx, cria Layout, reconstrói routing
✅ Critério: TODAS as rotas funcionam, App.tsx < 120 linhas

---

## Como usar com Claude Code

```bash
# Fase 1
cat fase1-shared.md | claude

# Testar
npm run build

# Fase 2
cat fase2-dashboard.md | claude

# Testar
npm run build && npm run dev
# → Testar Dashboard no browser

# Fase 3
cat fase3-crm.md | claude

# Testar
npm run build && npm run dev
# → Testar CRM no browser

# Fase 4
cat fase4-app-final.md | claude

# Teste final
npm run build && npm run dev
# → Testar TODAS as rotas
```

---

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| NovaAtividadeForm tem 1100 linhas e 70+ useState | Copiar exatamente. Refatorar depois com useReducer |
| LeadModal tem 1500 linhas | Opção A: manter como 1 arquivo. Opção B: dividir em tabs |
| Import paths quebrados | Usar barrel exports em shared/index.ts |
| Realtime subscription leak | Garantir cleanup no useEffect return |
| State compartilhado entre LeadModal e CRMPage | Manter callbacks via props |
| Componentes que não existem no App.tsx mas são referenciados | PlaybooksView, ClientCRMView, etc. já são separados — só atualizar imports |
