# Nova Aba: Dashboard no ClientCRMView.tsx

Adicione uma nova aba "Dashboard" no CRM do cliente dentro do `ClientCRMView.tsx`, com uma Overview idêntica à da área de aquisição. Usa dados mockados via localStorage para a apresentação.

---

## 1. IMPORTS ADICIONAIS

No topo do arquivo, nos imports do lucide-react, adicione (se já não estiverem):

```tsx
TrendingUp, BarChart2, Activity, RefreshCw,
```

Adicione também o import do recharts (se não estiver):

```tsx
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
```

E do date-fns (se não estiver):

```tsx
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
```

---

## 2. DADOS MOCK + HELPERS (adicionar ANTES do componente principal, depois dos helpers existentes)

Adicione logo após o bloco de `LEAD_SCORE_GRADE_STYLE` / `calcClientLeadScore` (ou onde ficam os helpers):

```tsx
// ── Dashboard Mock Data ─────────────────────────────────────
const BRAND_COLOR = '#00FF88';
const CHART_COLORS = ['#00FF88', '#00B4D8', '#F59E0B', '#EF4444', '#8B5CF6'];

function getDashboardMockData() {
  const key = 'm2_dashboard_mock';
  const saved = localStorage.getItem(key);
  if (saved) { try { return JSON.parse(saved); } catch {} }
  
  const mock = {
    kpis: {
      leads: 247, mqls: 89, reunioes_marcadas: 52, reunioes_realizadas: 38, vendas: 12,
      total_contrato: 384000, total_cc: 127500, total_mrr: 18400,
      ticket_medio: 32000, cc_medio: 10625, mrr_medio: 1533,
      tmf_dias: 43,
      tx_lead_mql: 36.0, tx_mql_rm: 58.4, tx_rm_rr: 73.1, tx_conversao: 31.6,
    },
    custos: {
      verba_midia: 12500, custo_mql: 140.45, custo_rm: 240.38, custo_rr: 328.95, cac: 1041.67,
    },
    vendas_mes: [
      { mes: '2026-01-01', total_contrato: 48000, total_cc: 16000, ticket_medio: 24000 },
      { mes: '2026-02-01', total_contrato: 72000, total_cc: 24000, ticket_medio: 36000 },
      { mes: '2026-03-01', total_contrato: 96000, total_cc: 31500, ticket_medio: 32000 },
      { mes: '2026-04-01', total_contrato: 84000, total_cc: 28000, ticket_medio: 28000 },
    ],
    metas: { meta_leads: 300, meta_mql: 100, meta_rm: 60, meta_rr: 45, meta_vendas: 15 },
  };
  localStorage.setItem(key, JSON.stringify(mock));
  return mock;
}

const fmtBRLDash = (v: number | string | null | undefined) => {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  if (isNaN(n)) return '—';
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtNum = (v: number | string | null | undefined) => {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return n.toLocaleString('pt-BR');
};
const fmtMesDash = (iso: string) => {
  const d = new Date(iso);
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
};
```

---

## 3. COMPONENTE ClientDashboard (adicionar como componente separado, depois do NewLeadModal ou no final do arquivo)

```tsx
// ══════════════════════════════════════════════════════════════
// Client Dashboard — Overview com métricas de tráfego
// ══════════════════════════════════════════════════════════════
function ClientDashboard() {
  const today = new Date();
  const [periodo, setPeriodo] = useState('ano');
  const [range, setRange] = useState({
    inicio: format(startOfYear(today), 'yyyy-MM-dd'),
    fim: format(endOfYear(today), 'yyyy-MM-dd'),
  });

  const mockData = getDashboardMockData();
  const kpis = mockData.kpis;
  const custos = mockData.custos;
  const metas = mockData.metas;
  const meses = mockData.vendas_mes;

  const PRESETS = [
    { id: 'ano', label: 'Este ano', inicio: format(startOfYear(today), 'yyyy-MM-dd'), fim: format(endOfYear(today), 'yyyy-MM-dd') },
    { id: 'mes', label: 'Este mês', inicio: format(startOfMonth(today), 'yyyy-MM-dd'), fim: format(today, 'yyyy-MM-dd') },
    { id: '90d', label: '90 dias', inicio: format(subDays(today, 90), 'yyyy-MM-dd'), fim: format(today, 'yyyy-MM-dd') },
  ];

  const chartData = meses.map((m: any) => ({
    name: fmtMesDash(m.mes),
    Contrato: m.total_contrato,
    Entrada: m.total_cc,
    'Ticket Médio': m.ticket_medio,
  }));

  const etapas = [
    { label: 'Leads', value: kpis.leads, taxa: kpis.tx_lead_mql, meta: metas.meta_leads, w: 100 },
    { label: 'MQL', value: kpis.mqls, taxa: kpis.tx_mql_rm, meta: metas.meta_mql, w: 85 },
    { label: 'Reuniões Marcadas', value: kpis.reunioes_marcadas, taxa: kpis.tx_rm_rr, meta: metas.meta_rm, w: 70 },
    { label: 'Reuniões Realizadas', value: kpis.reunioes_realizadas, taxa: kpis.tx_conversao, meta: metas.meta_rr, w: 55 },
    { label: 'Vendas', value: kpis.vendas, taxa: null, meta: metas.meta_vendas, w: 40 },
  ];

  return (
    <div className="space-y-6 p-4">
      {/* Header + Period selector */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Dashboard</h2>
          <p className="text-xs text-white/40 mt-1">Métricas de tráfego e performance comercial</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {PRESETS.map(p => (
            <button key={p.id}
              onClick={() => { setPeriodo(p.id); setRange({ inicio: p.inicio, fim: p.fim }); }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${
                periodo === p.id
                  ? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
              }`}>
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
            <input type="date" value={range.inicio}
              onChange={e => { setPeriodo('custom'); setRange(r => ({ ...r, inicio: e.target.value })); }}
              className="bg-transparent text-xs text-gray-300 focus:outline-none [&::-webkit-calendar-picker-indicator]:brightness-75" />
            <span className="text-xs text-gray-600">→</span>
            <input type="date" value={range.fim}
              onChange={e => { setPeriodo('custom'); setRange(r => ({ ...r, fim: e.target.value })); }}
              className="bg-transparent text-xs text-gray-300 focus:outline-none [&::-webkit-calendar-picker-indicator]:brightness-75" />
          </div>
        </div>
      </div>

      {/* 3 KPIs grandes */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Contrato', value: fmtBRLDash(kpis.total_contrato) },
          { label: 'Entrada', value: fmtBRLDash(kpis.total_cc) },
          { label: 'MRR Adicionado', value: fmtBRLDash(kpis.total_mrr) },
        ].map(k => (
          <div key={k.label} className="bg-[#0d1117]/80 border border-white/10 rounded-2xl p-6 text-center space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">{k.label}</p>
            <p className="text-2xl font-extrabold text-white">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Grid 3 colunas: Funil | Investimento | Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Funil de Etapas */}
        <div className="bg-[#0d1117]/80 border border-white/10 rounded-2xl p-6">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-5">Etapas</h3>
          <div className="space-y-0">
            {etapas.map((e, i) => (
              <div key={e.label}>
                <div className="flex items-center" style={{ paddingLeft: `${(100 - e.w) / 2}%`, paddingRight: `${(100 - e.w) / 2}%` }}>
                  <div className="flex-1 bg-white/10 rounded-xl px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-300">{e.label}</span>
                    <span className="text-xl font-extrabold text-white">{fmtNum(e.value)}</span>
                  </div>
                </div>
                {e.taxa !== null && i < etapas.length - 1 && (
                  <div className="flex items-center justify-center gap-3 py-1.5">
                    <div className="flex-1 h-px bg-white/5" />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-300">{e.taxa.toFixed(1)}%</span>
                      <span className="text-gray-600">|</span>
                      <span className="text-[10px] font-bold text-gray-500">Meta: {e.meta}</span>
                    </div>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Investimento */}
        <div className="bg-[#0d1117]/80 border border-white/10 rounded-2xl p-6">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-5">Investimento</h3>
          <div className="space-y-0">
            {[
              { label: 'Verba Mídia', value: fmtBRLDash(custos.verba_midia) },
              { label: 'Custo / MQL', value: fmtBRLDash(custos.custo_mql) },
              { label: 'Custo / RM', value: fmtBRLDash(custos.custo_rm) },
              { label: 'Custo / RR', value: fmtBRLDash(custos.custo_rr) },
              { label: 'CAC', value: fmtBRLDash(custos.cac) },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                <span className="text-sm font-semibold text-gray-300">{row.label}</span>
                <span className="text-lg font-extrabold text-white">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Comercial */}
        <div className="bg-[#0d1117]/80 border border-white/10 rounded-2xl p-6">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-5">Performance Comercial</h3>
          <div className="space-y-0">
            {[
              { label: 'Ticket Médio', value: fmtBRLDash(kpis.ticket_medio) },
              { label: 'Entrada Média', value: fmtBRLDash(kpis.cc_medio) },
              { label: 'MRR Médio', value: fmtBRLDash(kpis.mrr_medio) },
              { label: 'TMF', value: `${Math.round(kpis.tmf_dias)} dias` },
              { label: 'Vendas', value: String(kpis.vendas) },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                <span className="text-sm font-semibold text-gray-300">{row.label}</span>
                <span className="text-lg font-extrabold text-white">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gráfico de Vendas por Mês */}
      {chartData.length > 0 && (
        <div className="bg-[#0d1117]/80 border border-white/10 rounded-2xl p-6 space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Vendas por Mês</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" stroke="#444" tick={{ fill: '#aaa', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" stroke="#444" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => `R$${v/1000}k`} />
              <YAxis yAxisId="right" orientation="right" stroke="#444" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => `R$${v/1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#fff', fontWeight: 700 }}
                formatter={(value: number, name: string) => [fmtBRLDash(value), name]}
              />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 16 }} />
              <Bar yAxisId="left" dataKey="Contrato" fill={BRAND_COLOR} fillOpacity={0.75} radius={[4,4,0,0]} />
              <Bar yAxisId="left" dataKey="Entrada" fill="#0f2a44" fillOpacity={1} radius={[4,4,0,0]} />
              <Line yAxisId="right" type="monotone" dataKey="Ticket Médio" stroke="#888" strokeWidth={2} dot={{ fill: '#888', r: 3 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

---

## 4. ADICIONAR A ABA "DASHBOARD" AO LEADMODAL

Localize a constante `TABS` no `LeadModal` e adicione `dashboard` à lista:

```tsx
const TABS = [
  { id: 'detalhes' as const, label: 'Detalhes' },
  { id: 'leadscore' as const, label: 'Lead Score' },
  { id: 'atendimentos' as const, label: 'Atendimentos' },
  { id: 'tarefas' as const, label: 'Tarefas' },
  { id: 'demandas' as const, label: 'Checklist Vendas' },
  { id: 'notas' as const, label: 'Notas' },
];
```

**Na verdade, o Dashboard NÃO vai dentro do LeadModal.** Ele vai como uma aba do kanban view, na visão geral do CRM do cliente.

---

## 4 (CORRIGIDO). ADICIONAR ABA DASHBOARD NA VISÃO KANBAN

O Dashboard é uma aba do CRM do cliente, ao lado do Kanban. Não é dentro do modal do lead.

### 4a. Adicionar estado de sub-view

No componente principal `ClientCRMView`, logo depois dos estados existentes (por volta da linha 78), adicione:

```tsx
const [crmSubView, setCrmSubView] = useState<'kanban' | 'dashboard'>('kanban');
```

### 4b. Alterar o header do MODE 2 (Kanban View)

Localize o header do kanban (por volta da linha 291):

```tsx
<h1 className="text-xl font-bold text-white truncate">{activeClient?.name ?? 'CRM'}</h1>
```

Adicione logo **depois** deste `<h1>`, **antes** do input de busca:

```tsx
{/* Sub-tabs: Kanban | Dashboard */}
<div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
  <button onClick={() => setCrmSubView('kanban')}
    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
      crmSubView === 'kanban' ? 'bg-brand-primary/20 text-brand-primary' : 'text-white/40 hover:text-white/60'
    }`}>
    Kanban
  </button>
  <button onClick={() => setCrmSubView('dashboard')}
    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
      crmSubView === 'dashboard' ? 'bg-brand-primary/20 text-brand-primary' : 'text-white/40 hover:text-white/60'
    }`}>
    Dashboard
  </button>
</div>
```

### 4c. Condicionar a renderização do conteúdo

O bloco do kanban começa com `{/* Kanban columns */}` (por volta da linha 326). Envolva o kanban + filtros + botão novo lead + todos os modais em uma condição:

Encontre a div dos filtros e search (que começa depois do `</div>` do header, com os selects de responsavel, etiqueta, sortBy e botão Novo Lead). 

Toda a seção de filtros, kanban columns, e modais deve estar dentro de:

```tsx
{crmSubView === 'kanban' && (
  <>
    {/* ... filtros, kanban columns, LeadModal, NewLeadModal, Lightbox, TaskAlarm ... */}
  </>
)}

{crmSubView === 'dashboard' && <ClientDashboard />}
```

**Para simplificar:** Encontre a linha `{/* Kanban columns */}` e tudo entre ela e o final dos modais/lightbox/alarm. Envolva em `{crmSubView === 'kanban' && (<> ... </>)}`. Depois adicione `{crmSubView === 'dashboard' && <ClientDashboard />}`.

Na prática, o conteúdo abaixo do header (filtros + search + botão + kanban + modais) vai ficar:

```tsx
{crmSubView === 'kanban' ? (
  <>
    {/* Filters line - already exists */}
    <div className="flex-1 max-w-sm relative"> ... search ... </div>
    <select ...> filters </select>
    <button ... > Novo Lead </button>
    </div> {/* end of header flex */}
    
    {/* Kanban columns */}
    <div className="flex-1 overflow-x-auto p-4"> ... </div>
    
    {/* All modals */}
    <AnimatePresence> ... LeadModal ... </AnimatePresence>
    <AnimatePresence> ... NewLeadModal ... </AnimatePresence>
    <AnimatePresence> ... Lightbox ... </AnimatePresence>
    <AnimatePresence> ... TaskAlarm ... </AnimatePresence>
  </>
) : (
  <>
    </div> {/* close header div */}
    <ClientDashboard />
  </>
)}
```

**IMPORTANTE:** Isso é delicado por causa da estrutura de divs. A forma mais segura é:

1. Manter o header como está (fecha normalmente com `</div>`)
2. Logo após o `</div>` que fecha o header, adicionar a condicional:

```tsx
{crmSubView === 'dashboard' ? (
  <ClientDashboard />
) : (
  <>
    {/* Kanban columns - o bloco que já existe */}
    <div className="flex-1 overflow-x-auto p-4">
      ...kanban existente...
    </div>

    {/* Modais - já existem */}
    ...todos os AnimatePresence...
  </>
)}
```

Quando `crmSubView === 'dashboard'`, esconde os filtros do header (search, selects, botão novo lead) também. Para isso, envolva os filtros no header com:

```tsx
{crmSubView === 'kanban' && (
  <>
    <div className="flex-1 max-w-sm relative">
      <Search ... />
      <input ... search ... />
    </div>
    <select ... responsavel ... />
    <select ... etiqueta ... />
    <select ... sortBy ... />
    <button ... Novo Lead ... />
  </>
)}
```

---

## RESUMO

| O que | Onde |
|-------|------|
| Mock data + helpers | Antes do componente principal |
| `ClientDashboard` component | Componente separado (fim do arquivo) |
| Sub-tabs Kanban/Dashboard | Header do MODE 2 do ClientCRMView |
| Condicional de renderização | Kanban vs Dashboard após o header |
| Filtros escondidos | Quando crmSubView === 'dashboard' |

O Dashboard mostra exatamente a mesma estrutura da Overview da aquisição: 3 KPIs grandes (Contrato, Entrada, MRR), grid de 3 colunas (Funil de Etapas com taxas, Investimento com custos, Performance Comercial), e gráfico de Vendas por Mês com Contrato/Entrada em barras e Ticket Médio em linha. Tudo com seletor de período (Este ano / Este mês / 90 dias / custom).
