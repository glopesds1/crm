# FASE 2 — Decompor DashboardView.tsx em módulo `src/dashboard/`

> Pré-requisito: Fase 1 (shared/) deve estar completa.
> Objetivo: quebrar `src/DashboardView.tsx` (1621 linhas) em 11 arquivos menores.
> Ao final, `DashboardView.tsx` original deve ser substituído por um re-export de `src/dashboard/DashboardPage.tsx`.

---

## Estrutura alvo

```
src/dashboard/
├── DashboardPage.tsx        (~200 linhas — shell com tabs, período, fetch)
├── hooks/
│   └── useDashboardData.ts  (~120 linhas — fetchData, calcRange, periodo, range)
└── components/
    ├── ui/                  (átomos reutilizáveis dentro do dashboard)
    │   ├── KPI.tsx
    │   ├── Section.tsx
    │   ├── DashTable.tsx    (renomear de Table pra evitar conflito)
    │   ├── ProgressBar.tsx
    │   ├── Loading.tsx
    │   ├── Empty.tsx
    │   └── CustomTooltip.tsx
    ├── OverviewTab.tsx      (← PageOverview, linhas 406-650)
    ├── MetasMensaisTab.tsx  (← PageMetas, linhas 651-957)
    ├── SemanalTab.tsx       (← PageSemanal, linhas 959-1112)
    ├── ReunioesTab.tsx      (← PageReunioes, linhas 1114-1173)
    ├── AnaliseTab.tsx       (← PageAnalise, linhas 1175-1425)
    ├── AnunciosTab.tsx      (← PageAnuncios, linhas 1427-1560)
    └── SDRTab.tsx           (← PageSDR, linhas 1562-1621)
```

---

## Passo a passo

### 2.1 — Criar `src/dashboard/components/ui/KPI.tsx`

Extrair do DashboardView.tsx (linhas ~45-56):

```tsx
import React from 'react';

interface KPIProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: any;
  trend?: string;
  color?: string;
}

export function KPI({ label, value, sub, icon: Icon, trend, color }: KPIProps) {
  // ... copiar implementação exata do DashboardView ...
}
```

### 2.2 — Criar os outros átomos UI

Mesma lógica para cada um — extrair função do DashboardView e criar arquivo:

- `Section.tsx` — linhas ~58-63
- `DashTable.tsx` — linhas ~65-87 (a função se chama `Table` no original; renomear export pra `DashTable`)
- `ProgressBar.tsx` — linhas ~88-103
- `Loading.tsx` — linhas ~104-109
- `Empty.tsx` — linhas ~111-116
- `CustomTooltip.tsx` — linhas ~118-131

Cada arquivo importa só de React + libs (recharts pra tooltip). Nenhum importa de shared/.

### 2.3 — Criar `src/dashboard/hooks/useDashboardData.ts`

Extrair do DashboardView.tsx a lógica de data fetching:

```ts
import { useState, useCallback, useRef, useEffect } from 'react';
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { supabase } from '../../shared/lib/supabase';
import type { DashboardPage, DateRange } from '../../shared/types';

export function useDashboardData(userSession: any) {
  const [page, setPage] = useState<DashboardPage>('overview');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const fimMes = ...;

  const [range, setRange] = useState<DateRange>({ ... });
  const [periodo, setPeriodo] = useState('ano');

  const fetchData = useCallback(async (p: DashboardPage, r: DateRange) => {
    // ... copiar TODA a lógica de fetch do DashboardView (linhas 148-242) ...
  }, [userSession]);

  const calcRange = useCallback((p: string): DateRange => {
    // ... copiar linhas 252-263 ...
  }, []);

  // Período padrão por aba
  const periodoPadraoAba: Record<string, string> = {
    overview: 'ano', metas: 'mes', semanal: 'semanal', reunioes: 'hoje',
    anuncios: 'mes', analise: '90d', sdr: '90d',
  };

  // Ao trocar de aba
  useEffect(() => {
    const p = periodoPadraoAba[page] || 'mes';
    setPeriodo(p);
    const r = calcRange(p);
    setRange(r);
    fetchData(page, r);
  }, [page]);

  // Ao mudar range manualmente
  const prevRangeRef = useRef(range);
  useEffect(() => {
    if (prevRangeRef.current.inicio !== range.inicio || prevRangeRef.current.fim !== range.fim) {
      prevRangeRef.current = range;
      fetchData(page, range);
    }
  }, [range]);

  return {
    page, setPage,
    loading, data, error,
    range, setRange,
    periodo, setPeriodo,
    calcRange, fetchData,
    periodoPadraoAba,
  };
}
```

### 2.4 — Criar cada Tab component

Para cada sub-página, criar um arquivo em `src/dashboard/components/`:

Exemplo `OverviewTab.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../shared/lib/supabase';
import { fmt, fmtBRL, fmtPct, fmtMes } from '../../shared/lib/formatters';
import { BRAND, CHART_COLORS } from '../../shared/constants';
import { KPI } from './ui/KPI';
import { Section } from './ui/Section';
import { DashTable } from './ui/DashTable';
import { CustomTooltip } from './ui/CustomTooltip';
// ... recharts imports ...

interface OverviewTabProps {
  data: any;
  range: { inicio: string; fim: string };
  userSession: any;
}

export function OverviewTab({ data, range, userSession }: OverviewTabProps) {
  // ... copiar PageOverview inteira (linhas 406-650) ...
}
```

Repetir para:
- `MetasMensaisTab.tsx` ← `PageMetas` (linhas 651-957)
- `SemanalTab.tsx` ← `PageSemanal` (linhas 959-1112)
- `ReunioesTab.tsx` ← `PageReunioes` (linhas 1114-1173)
- `AnaliseTab.tsx` ← `PageAnalise` (linhas 1175-1425)
- `AnunciosTab.tsx` ← `PageAnuncios` (linhas 1427-1560)
- `SDRTab.tsx` ← `PageSDR` (linhas 1562-1621)

⚠️ Em cada tab, trocar:
- `const BRAND = '#00FF88'` → `import { BRAND } from '../../shared/constants'`
- `const COLORS = [...]` → `import { CHART_COLORS } from '../../shared/constants'` (e usar `CHART_COLORS` onde usava `COLORS`)
- Helpers `fmt`, `fmtBRL`, `fmtPct`, `fmtMes` → importar de `../../shared/lib/formatters`
- Átomos `KPI`, `Section`, `Table`, etc. → importar de `./ui/`
- `supabase` (se usado na tab) → importar de `../../shared/lib/supabase`

### 2.5 — Criar `src/dashboard/DashboardPage.tsx`

Shell final (~80-100 linhas) que compõe tudo:

```tsx
import React from 'react';
import { RefreshCw, TrendingUp, Target, Calendar, Users, Activity, BarChart2, Briefcase, AlertCircle } from 'lucide-react';
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { useDashboardData } from './hooks/useDashboardData';
import { Loading } from './components/ui/Loading';
import { OverviewTab } from './components/OverviewTab';
import { MetasMensaisTab } from './components/MetasMensaisTab';
import { SemanalTab } from './components/SemanalTab';
import { ReunioesTab } from './components/ReunioesTab';
import { AnaliseTab } from './components/AnaliseTab';
import { AnunciosTab } from './components/AnunciosTab';
import { SDRTab } from './components/SDRTab';
import type { DashboardPage as PageType } from '../shared/types';

const PAGES: { id: PageType; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: TrendingUp },
  { id: 'metas', label: 'Metas Mensais', icon: Target },
  { id: 'semanal', label: 'Semanal', icon: Calendar },
  { id: 'reunioes', label: 'Reuniões do Dia', icon: Users },
  { id: 'anuncios', label: 'Funis', icon: Activity },
  { id: 'analise', label: "KPI's Vendas", icon: BarChart2 },
  { id: 'sdr', label: "KPI's Pré-vendas", icon: Briefcase },
];

export default function DashboardPage({ userSession }: { userSession: any }) {
  const {
    page, setPage, loading, data, error,
    range, setRange, periodo, setPeriodo, fetchData,
  } = useDashboardData(userSession);

  const PRESETS = [ ... ]; // Copiar presets

  return (
    <div className="space-y-6">
      {/* Header com presets + date pickers — copiar JSX das linhas 299-377 */}
      {/* Tabs navigation */}
      {/* Content area com switch por page */}
      {loading && <Loading />}
      {error && <div>...</div>}
      {!loading && !error && data && (
        <>
          {page === 'overview' && <OverviewTab data={data} range={range} userSession={userSession} />}
          {page === 'metas' && <MetasMensaisTab data={data} userSession={userSession} range={range} />}
          {page === 'semanal' && <SemanalTab data={data} userSession={userSession} />}
          {page === 'reunioes' && <ReunioesTab data={data} />}
          {page === 'analise' && <AnaliseTab data={data} range={range} />}
          {page === 'anuncios' && <AnunciosTab data={data} />}
          {page === 'sdr' && <SDRTab data={data} />}
        </>
      )}
    </div>
  );
}
```

### 2.6 — Atualizar `src/DashboardView.tsx` (re-export temporário)

Substituir o conteúdo inteiro por:

```tsx
// Re-export temporário durante migração
export { default } from './dashboard/DashboardPage';
```

Isso mantém o App.tsx funcionando sem alterações.

---

## Verificação

```bash
npm run build
```

Se compilar, testar no browser:
1. Dashboard Overview carrega KPIs
2. Trocar entre as 7 abas
3. Filtros de período funcionam
4. Botão refresh funciona

Se tudo OK, a Fase 2 está completa.
