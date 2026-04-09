# FASE 3 — Decompor CRMView.tsx em módulo `src/crm/`

> Pré-requisito: Fases 1-2 completas.
> Este é o maior monolito (4279 linhas). A decomposição requer cuidado com as ~70 variáveis de estado espalhadas.
> Ao final, `CRMView.tsx` original deve ser substituído por um re-export.

---

## Estrutura alvo

```
src/crm/
├── CRMPage.tsx                (~200 linhas — compose hooks + layout)
├── hooks/
│   ├── useLeads.ts            (loadLeads, CRUD, filtros, ordenação, realtime)
│   ├── useTarefas.ts          (alarme, polling, dismiss)
│   └── useDemandas.ts         (refreshDemandas, demandasPendentes)
└── components/
    ├── KanbanBoard.tsx         (colunas + cards + sort + "ver mais")
    ├── LeadCard.tsx            (~100 linhas)
    ├── SlotPicker.tsx          (date/time picker de slots de reunião)
    ├── NewLeadModal.tsx        (~100 linhas)
    ├── TaskAlarmPopup.tsx      (popup + playAlarmSound)
    ├── PainelDemandas.tsx      (widget dual-panel acima do kanban)
    ├── NovaAtividadeForm.tsx   (~1100 linhas — o maior componente)
    └── LeadModal/
        ├── index.tsx           (shell com tabs + state)
        ├── InfoTab.tsx
        ├── TimelineTab.tsx
        ├── TarefasTab.tsx
        └── DemandasTab.tsx
```

---

## Mapeamento de linhas no CRMView.tsx original

| Trecho | Linhas aprox. | Destino |
|--------|---------------|---------|
| Helpers (SP_TZ, fmtDate, syncPostgres) | 15-83 | Já em shared/ (Fase 1) |
| SlotPicker | 90-345 | `components/SlotPicker.tsx` |
| Interfaces (CRMLead, etc.) | 347-420 | Já em shared/types (Fase 1) |
| Constantes (ETAPAS, TAGS) | 422-527 | Já em shared/constants (Fase 1) |
| LeadCard | 530-632 | `components/LeadCard.tsx` |
| NovaAtividadeForm | 634-1806 | `components/NovaAtividadeForm.tsx` |
| LeadModal | 1808-3386 | `components/LeadModal/` |
| NewLeadModal | 3388-3474 | `components/NewLeadModal.tsx` |
| playAlarmSound + TaskAlarmPopup | 3476-3652 | `components/TaskAlarmPopup.tsx` |
| CRMView principal | 3654-4279 | `CRMPage.tsx` + hooks/ |

---

## Passo a passo

### 3.1 — Criar `src/crm/components/SlotPicker.tsx`

Extrair do CRMView.tsx linhas 90-345. Imports necessários:

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { supabase } from '../../shared/lib/supabase';
import { SLOT_HOURS, MAX_POR_SLOT } from '../../shared/constants';

// WEBHOOK_BASE pode vir de shared/lib/webhooks.ts ou ser importado
const WEBHOOK_BASE = (import.meta.env.VITE_WEBHOOK_BASE ?? 'https://webhook.m2black.com/webhook/dashboard').replace('/webhook/dashboard', '');

interface SlotPickerProps {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  selectedHour: string;
  onSelectHour: (h: string) => void;
  tpAtual?: string;
}

export function SlotPicker({ selectedDate, onSelectDate, selectedHour, onSelectHour, tpAtual }: SlotPickerProps) {
  // ... copiar implementação exata ...
}
```

### 3.2 — Criar `src/crm/components/LeadCard.tsx`

Extrair linhas 530-632:

```tsx
import React from 'react';
import { Clock, Phone, Calendar } from 'lucide-react';
import type { CRMLead, CRMTarefa } from '../../shared/types';
import { ETAPA_MAP, CRM_TAGS_CONFIG, GRADE_STYLE } from '../../shared/constants';
import { getLeadScore, getProgramaStyle } from '../../shared/lib/leadScore';
import { fmtDateSP, fmtDateSmartSP } from '../../shared/lib/dateHelpers';

interface LeadCardProps {
  lead: CRMLead;
  proximaTarefa?: CRMTarefa;
  onClick: () => void;
}

export function LeadCard({ lead, proximaTarefa, onClick }: LeadCardProps) {
  // ... copiar implementação exata ...
}
```

### 3.3 — Criar `src/crm/components/NewLeadModal.tsx`

Extrair linhas 3388-3474:

```tsx
import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { supabase } from '../../shared/lib/supabase';
import type { CRMLead, UserSession, TeamMember } from '../../shared/types';

interface NewLeadModalProps {
  onClose: () => void;
  onSave: (lead: CRMLead) => void;
  userSession: UserSession;
  teamMembers: TeamMember[];
}

export function NewLeadModal({ onClose, onSave, userSession, teamMembers }: NewLeadModalProps) {
  // ... copiar implementação ...
}
```

### 3.4 — Criar `src/crm/components/TaskAlarmPopup.tsx`

Extrair linhas 3476-3652:

```tsx
import React, { useState, useRef } from 'react';
import { Bell, X, Check, Calendar, ChevronRight, Upload } from 'lucide-react';
import { supabase } from '../../shared/lib/supabase';
import type { CRMTarefa, CRMLead } from '../../shared/types';
import { fmtDateSmartSP } from '../../shared/lib/dateHelpers';

// Incluir playAlarmSound como função local neste arquivo
function playAlarmSound() { ... }

interface TaskAlarmPopupProps {
  tarefa: CRMTarefa;
  lead: CRMLead;
  onDismiss: () => void;
  onOpenLead: () => void;
  onComplete: () => void;
  onReschedule: (newDate: string) => void;
}

export function TaskAlarmPopup({ ... }: TaskAlarmPopupProps) { ... }
export { playAlarmSound };
```

### 3.5 — Criar `src/crm/components/NovaAtividadeForm.tsx`

⚠️ Este é o maior componente (~1100 linhas). Extrair linhas 634-1806.

```tsx
import React, { useState, useEffect } from 'react';
import { ... } from 'lucide-react'; // todos os ícones usados
import { supabase } from '../../shared/lib/supabase';
import { localDatetimeToISO } from '../../shared/lib/dateHelpers';
import { syncPostgres } from '../../shared/lib/webhooks';
import { calcLeadScore } from '../../shared/lib/leadScore';
import type { CRMLead, CRMTarefa, UserSession, TeamMember } from '../../shared/types';
import { SlotPicker } from './SlotPicker';

interface NovaAtividadeFormProps {
  lead: CRMLead;
  leadId: string;
  leadName: string;
  userSession: UserSession;
  onSaved: () => void;
  onCancel: () => void;
  onLeadUpdated: (lead: Partial<CRMLead>) => void;
  onClientCreated?: () => void;
  onTarefaCreated?: () => void;
  teamMembers?: TeamMember[];
  initialTipo?: 'ligacao' | 'reuniao';
}

export function NovaAtividadeForm({ ... }: NovaAtividadeFormProps) {
  // ... copiar implementação completa (linhas 634-1806) ...
  // Trocar referências internas:
  //   TAGS_CONFIG → CRM_TAGS_CONFIG
  //   ALL_TAGS → CRM_ALL_TAGS
  //   ETAPAS, ETAPA_MAP → importar de shared/constants
}
```

### 3.6 — Criar `src/crm/components/LeadModal/index.tsx`

Extrair linhas 1808-3386. Este é o segundo maior componente.

**Opção A (recomendada pra primeira passada):** Manter como um único arquivo `LeadModal.tsx` (~1500 linhas) e subdividir em tabs numa fase posterior.

**Opção B (ideal):** Dividir em 4 arquivos. O `index.tsx` mantém o state e renderiza tabs:

```tsx
// src/crm/components/LeadModal/index.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../../shared/lib/supabase';
import type { CRMLead, CRMAtividade, CRMTarefa, CRMDemandaVenda, UserSession, TeamMember } from '../../../shared/types';
import { InfoTab } from './InfoTab';
import { TimelineTab } from './TimelineTab';
import { TarefasTab } from './TarefasTab';
import { DemandasTab } from './DemandasTab';

interface LeadModalProps {
  lead: CRMLead;
  onClose: () => void;
  onSave: (updated: CRMLead) => void;
  onDelete: (id: string) => void;
  userSession: UserSession;
  teamMembers: TeamMember[];
  onClientCreated?: () => void;
  onTarefaCreated?: () => void;
}

export function LeadModal({ lead, onClose, onSave, onDelete, userSession, teamMembers, onClientCreated, onTarefaCreated }: LeadModalProps) {
  const [tab, setTab] = useState<'info' | 'timeline' | 'tarefas' | 'demandas'>('info');
  
  // State compartilhado entre tabs (etapa, closer, sdr, tags, etc.)
  const [etapa, setEtapa] = useState(lead.etapa);
  const [closerResponsavel, setCloserResponsavel] = useState(lead.closer_responsavel ?? '');
  // ... demais states da linha 1817-1830 ...
  
  // Atividades + tarefas + demandas (carregados via useEffect)
  const [atividades, setAtividades] = useState<CRMAtividade[]>([]);
  const [tarefas, setTarefas] = useState<CRMTarefa[]>([]);
  const [demandas, setDemandas] = useState<CRMDemandaVenda | null>(null);
  
  // useEffects de carregamento...
  
  return (
    <div className="fixed inset-0 z-50 ...">
      {/* Header com nome + badges */}
      {/* Tabs navigation */}
      {/* Tab content */}
      {tab === 'info' && <InfoTab lead={lead} etapa={etapa} ... />}
      {tab === 'timeline' && <TimelineTab ... />}
      {tab === 'tarefas' && <TarefasTab ... />}
      {tab === 'demandas' && <DemandasTab ... />}
    </div>
  );
}
```

⚠️ Usar Opção A se o tempo for limitado — mover o LeadModal inteiro como um arquivo e refatorar depois.

### 3.7 — Criar `src/crm/components/PainelDemandas.tsx`

Extrair do CRMView principal (dentro da função `CRMView`) o trecho que renderiza o painel dual de "Pendências de Venda" + "Tarefas". Procurar pelo JSX que usa `demandasPendentes`.

### 3.8 — Criar hooks

#### `src/crm/hooks/useLeads.ts`

```ts
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../shared/lib/supabase';
import type { CRMLead, UserSession } from '../../shared/types';

export function useLeads(userSession: UserSession) {
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [etapaSort, setEtapaSort] = useState<Record<string, string>>({});
  const [etapaVisible, setEtapaVisible] = useState<Record<string, number>>({});
  const [filtroResponsavel, setFiltroResponsavel] = useState(userSession?.name || 'Todos');
  const [filtroTag, setFiltroTag] = useState('');
  const [filtroScore, setFiltroScore] = useState('Todos');

  const loadLeads = useCallback(async () => {
    // ... copiar lógica de loadLeads (linhas ~3827-3882) ...
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // Realtime subscription
  useEffect(() => {
    // ... copiar subscription (linhas ~3885-...) ...
  }, []);

  // handleNewLead, handleSaveLead, handleDeleteLead, handleDragDrop
  // ... extrair dos handlers dentro de CRMView ...

  return {
    leads, setLeads, loading, syncing, search, setSearch,
    etapaSort, setEtapaSort, etapaVisible, setEtapaVisible,
    filtroResponsavel, setFiltroResponsavel,
    filtroTag, setFiltroTag, filtroScore, setFiltroScore,
    loadLeads,
    // ... handlers ...
  };
}
```

#### `src/crm/hooks/useTarefas.ts`

```ts
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../shared/lib/supabase';
import type { CRMTarefa, CRMLead } from '../../shared/types';
import { playAlarmSound } from '../components/TaskAlarmPopup';

export function useTarefas(leads: CRMLead[]) {
  const [tarefas, setTarefas] = useState<CRMTarefa[]>([]);
  const [alarmTarefas, setAlarmTarefas] = useState<CRMTarefa[]>([]);
  const dismissedRef = useRef<Set<string>>(new Set());

  // Polling de alarme (linhas ~3711-3825)
  useEffect(() => { ... }, []);

  return { tarefas, setTarefas, alarmTarefas, setAlarmTarefas, dismissedRef };
}
```

#### `src/crm/hooks/useDemandas.ts`

```ts
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../shared/lib/supabase';
import type { CRMDemandaVenda } from '../../shared/types';

export function useDemandas() {
  const [demandasPendentes, setDemandasPendentes] = useState<(CRMDemandaVenda & { lead_nome: string; lead_id: string; closer: string })[]>([]);

  const refreshDemandas = useCallback(async () => {
    // ... copiar linhas 3673-3695 ...
  }, []);

  useEffect(() => { refreshDemandas(); }, [refreshDemandas]);

  return { demandasPendentes, refreshDemandas };
}
```

### 3.9 — Criar `src/crm/CRMPage.tsx`

Compor hooks + componentes:

```tsx
import React, { useState, useCallback, useEffect } from 'react';
import type { UserSession, TeamMember } from '../shared/types';
import { useLeads } from './hooks/useLeads';
import { useTarefas } from './hooks/useTarefas';
import { useDemandas } from './hooks/useDemandas';
import { KanbanBoard } from './components/KanbanBoard';
import { PainelDemandas } from './components/PainelDemandas';
import { LeadModal } from './components/LeadModal';
import { NewLeadModal } from './components/NewLeadModal';
import { TaskAlarmPopup } from './components/TaskAlarmPopup';

interface CRMPageProps {
  userSession: UserSession;
  teamMembers: TeamMember[];
  openLeadByName?: string;
  onLeadOpened?: () => void;
  onClientCreated?: () => void;
}

export default function CRMPage({ userSession, teamMembers, openLeadByName, onLeadOpened, onClientCreated }: CRMPageProps) {
  const { leads, ...leadState } = useLeads(userSession);
  const { tarefas, alarmTarefas, ...tarefaState } = useTarefas(leads);
  const { demandasPendentes, refreshDemandas } = useDemandas();
  
  const [selectedLead, setSelectedLead] = useState(null);
  const [showNewLead, setShowNewLead] = useState(false);

  return (
    <div className="h-full flex flex-col gap-4">
      {/* PainelDemandas — visível só pra admin/comercial */}
      <PainelDemandas demandas={demandasPendentes} tarefas={tarefas} ... />
      
      {/* KanbanBoard — colunas, filtros, search, cards */}
      <KanbanBoard leads={leads} tarefas={tarefas} ... />
      
      {/* Modals */}
      {selectedLead && <LeadModal lead={selectedLead} ... />}
      {showNewLead && <NewLeadModal ... />}
      
      {/* Alarmes */}
      {alarmTarefas.map(t => <TaskAlarmPopup key={t.id} ... />)}
    </div>
  );
}
```

### 3.10 — Atualizar `src/CRMView.tsx` (re-export temporário)

```tsx
export { default } from './crm/CRMPage';
```

---

## Verificação

```bash
npm run build
```

Testar no browser:
1. Kanban carrega leads
2. Clicar num card abre o modal
3. Registrar atividade (ligação + reunião)
4. Tarefas com alarme
5. Painel de demandas
6. Filtros por responsável/tag
7. Drag-and-drop entre colunas
8. Criar novo lead

---

## ⚠️ Armadilhas conhecidas

1. **State compartilhado entre LeadModal e NovaAtividadeForm:** O `onSaved` callback do form precisa atualizar tanto atividades quanto a lista de leads. Manter callbacks passados via props.

2. **`onTarefaCreated` e `onClientCreated`:** São callbacks que borbulham do CRM até o App.tsx. Manter como props.

3. **Realtime subscription no useLeads:** Cuidado com cleanup no useEffect. O subscription precisa ser removido no return.

4. **70+ useState no NovaAtividadeForm:** NÃO tentar refatorar o state nesta fase. Copiar exatamente como está. Refatorar depois com useReducer/form library.

5. **`syncPostgres` é fire-and-forget:** Ele faz POST sem await. Manter esse comportamento.

6. **Imports de ícones:** O CRMView usa ~30 ícones do lucide-react. Conferir que todos estão importados nos novos componentes.
