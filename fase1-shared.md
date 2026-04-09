# FASE 1 — Criar camada shared/ (fundação)

> Objetivo: criar `src/shared/` com tipos, helpers, lib e constantes extraídos dos monolitos.
> Regra: NÃO alterar nenhum arquivo existente nesta fase. Apenas criar novos arquivos.
> Após criar tudo, rodar `npm run build` pra garantir que compila (os monolitos ainda não importam de shared/).

---

## 1.1 — Criar `src/shared/lib/supabase.ts`

Copiar `src/supabase.ts` exatamente como está:

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client para operações que exigem service_role
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
export const supabaseAdmin = serviceKey
  ? createClient(supabaseUrl, serviceKey)
  : supabase;
```

⚠️ Verificar no `src/supabase.ts` original se tem `supabaseAdmin`. Se não tiver, exportar apenas `supabase`.

---

## 1.2 — Criar `src/shared/lib/dateHelpers.ts`

Extrair do topo de `src/CRMView.tsx` (linhas ~15-83) estas funções:

```ts
export const SP_TZ = 'America/Sao_Paulo';

export function localDatetimeToISO(dt: string): string { ... }
export function parseDateSP(iso: string): Date { ... }
export function fmtDateSP(iso: string, opts?: { year?: boolean }): string { ... }
export function fmtDateSmartSP(iso: string, opts?: { year?: boolean }): string { ... }
```

Copiar as implementações exatas do CRMView.tsx. Não modificar lógica.

---

## 1.3 — Criar `src/shared/lib/formatters.ts`

Extrair do topo de `src/DashboardView.tsx` (linhas ~18-38):

```ts
export const fmt = (v: number | string | null | undefined, prefix = '') => { ... };
export const fmtBRL = (v: number | string | null | undefined) => { ... };
export const fmtPct = (v: number | string | null | undefined) => { ... };
export const fmtMes = (iso: string) => { ... };
```

Copiar implementações exatas.

---

## 1.4 — Criar `src/shared/lib/database.ts`

Copiar `src/database.ts` (que está em `src/lib/database.ts` ou `src/database.ts`), mas trocar os imports:

```ts
// ANTES:
import { supabase } from './supabase';
import type { Client, TeamMember, AgencyConfig, Tag } from '../types';

// DEPOIS:
import { supabase } from './supabase';
import type { Client, TeamMember, AgencyConfig, Tag } from '../types';
```

Os paths relativos de `src/shared/lib/database.ts` para `src/shared/lib/supabase.ts` e `src/shared/types.ts` são:
- `import { supabase } from './supabase'`
- `import type { ... } from '../types'`

---

## 1.5 — Criar `src/shared/types.ts`

Começar copiando TODO o conteúdo de `src/types.ts`.

Depois, ADICIONAR ao final os tipos do CRM (extraídos de CRMView.tsx linhas 347-420):

```ts
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
```

---

## 1.6 — Criar `src/shared/constants.ts`

Copiar TODO o conteúdo de `src/constants.ts`, trocando o import:

```ts
// ANTES:
import { AgencyConfig, Client, Column, Tag, TeamMember } from './types';

// DEPOIS:
import type { AgencyConfig, Client, Column, Tag, TeamMember } from './types';
```

Path relativo de `src/shared/constants.ts` para `src/shared/types.ts` = `'./types'`.

Depois, ADICIONAR ao final as constantes do CRM (extraídas de CRMView.tsx linhas 423-527):

```ts
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
```

⚠️ Renomeei `TAGS_CONFIG` → `CRM_TAGS_CONFIG` e `ALL_TAGS` → `CRM_ALL_TAGS` para evitar conflito com as tags de operação.
⚠️ Renomeei `COLORS` → `CHART_COLORS` do DashboardView.

---

## 1.7 — Criar `src/shared/lib/leadScore.ts`

Extrair de CRMView.tsx linhas 463-527:

```ts
import type { CRMLead } from '../types';

export function calcLeadScore(lead: Partial<CRMLead>): {
  score: number;
  grade: string;
  breakdown: { faturamento: number; investimento: number; funcionarios: number; area: number };
} {
  // ... copiar implementação exata ...
}

export function getLeadScore(lead: CRMLead) {
  return (lead.lead_score && lead.lead_score > 0)
    ? { score: lead.lead_score, grade: lead.lead_grade || 'D', breakdown: null }
    : calcLeadScore(lead);
}

export function getProgramaStyle(programa: string) {
  const p = (programa || '').toLowerCase();
  if (p === 'pro')   return 'text-yellow-400 font-bold';
  if (p === 'lite')  return 'text-gray-300 font-bold';
  if (p === 'basic') return 'text-blue-400 font-bold';
  return 'text-white font-bold';
}
```

---

## 1.8 — Criar `src/shared/lib/webhooks.ts`

Extrair de CRMView.tsx linhas 17-33:

```ts
const WEBHOOK_BASE = (import.meta.env.VITE_WEBHOOK_BASE ?? 'https://webhook.m2black.com/webhook/dashboard').replace('/webhook/dashboard', '');

export function syncPostgres(leadExternoId: string | undefined | null, fields: Record<string, unknown>) {
  // ... copiar implementação exata de CRMView.tsx ...
}

export { WEBHOOK_BASE };
```

---

## Verificação final

Estrutura criada:

```
src/shared/
├── types.ts           (types.ts original + CRM + Dashboard types)
├── constants.ts       (constants.ts original + CRM + Dashboard constants)
└── lib/
    ├── supabase.ts    (cliente Supabase)
    ├── database.ts    (CRUD clients, team, tags, config)
    ├── dateHelpers.ts (SP_TZ, fmtDateSP, parseDateSP, etc.)
    ├── formatters.ts  (fmt, fmtBRL, fmtPct, fmtMes)
    ├── leadScore.ts   (calcLeadScore, getLeadScore, getProgramaStyle)
    └── webhooks.ts    (syncPostgres, WEBHOOK_BASE)
```

Rodar:
```bash
npm run build
```

Se compilar sem erros, a fase 1 está completa. Os arquivos antigos (`src/types.ts`, `src/constants.ts`, `src/supabase.ts`, `src/database.ts`) continuam existindo — serão removidos nas fases seguintes quando os monolitos forem migrados.

---

## IMPORTANTE — Barrel exports

Criar `src/shared/index.ts` pra facilitar imports futuros:

```ts
// Types
export type * from './types';

// Lib
export { supabase, supabaseAdmin } from './lib/supabase';
export * from './lib/database';
export * from './lib/dateHelpers';
export * from './lib/formatters';
export * from './lib/leadScore';
export * from './lib/webhooks';

// Constants
export * from './constants';
```

⚠️ Se `export type *` não funcionar com a versão do TS, trocar por re-exports nomeados.
