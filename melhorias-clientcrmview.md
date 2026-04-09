# Melhorias ClientCRMView.tsx — CRM do Cliente

Aplique TODAS as alterações abaixo no arquivo `src/ClientCRMView.tsx`. Não altere nenhum outro arquivo. As alterações são incrementais — o que já existe continua funcionando.

---

## 1. LEAD SCORE — Função de cálculo (adicionar ANTES do componente principal)

Adicionar logo após a linha `const PLAN_COLORS` (antes do `// ── Props ──`):

```tsx
// ── Lead Score ─────────────────────────────────────────────
const LEAD_SCORE_GRADE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  B: { bg: 'rgba(212,175,55,0.12)', text: '#d4af37', border: 'rgba(212,175,55,0.3)' },
  C: { bg: 'rgba(96,165,250,0.12)', text: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
  D: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
};

function calcClientLeadScore(lead: { faturamento?: string; investimento?: string; funcionarios?: string; area?: string }): { score: number; grade: string; breakdown: { faturamento: number; investimento: number; funcionarios: number; area: number } } {
  let bFat = 0, bInv = 0, bFunc = 0, bArea = 0;
  const fat = (lead.faturamento || '').toLowerCase().replace(/[\s.]/g, '');
  const inv = (lead.investimento || '').toLowerCase();
  const func = (lead.funcionarios || '').toLowerCase();
  const area = (lead.area || '').toLowerCase();

  // FATURAMENTO (0-40)
  if (fat.includes('acima_150') || fat.includes('150')) bFat = 40;
  else if (fat.includes('70') || fat.includes('80')) bFat = 35;
  else if (fat.includes('40')) bFat = 25;
  else if (fat.includes('20') || fat.includes('30')) bFat = 15;
  else if (fat.includes('10') && !fat.includes('100') && !fat.includes('150')) bFat = 8;
  else if (fat.includes('menos') || fat.includes('5')) bFat = 3;
  else {
    const num = parseFloat(fat.replace(/[^0-9,.-]/g, '').replace(',', '.'));
    if (!isNaN(num)) {
      if (num >= 150000) bFat = 40;
      else if (num >= 70000) bFat = 35;
      else if (num >= 40000) bFat = 25;
      else if (num >= 20000) bFat = 15;
      else if (num >= 10000) bFat = 8;
      else bFat = 3;
    }
  }

  // INVESTIMENTO (0-30)
  if (inv.includes('todos')) bInv = 30;
  else if (inv.includes('agência') || inv.includes('agencia')) bInv = 25;
  else if (inv.includes('mentoria')) bInv = 20;
  else if (inv.includes('curso')) bInv = 15;
  else if (inv.includes('nenhum')) bInv = 5;

  // FUNCIONARIOS (0-20)
  if (func.includes('acima_de_10') || func.includes('acima de 10')) bFunc = 20;
  else if (func.includes('6_a_10') || func.includes('6 a 10')) bFunc = 18;
  else if (func.includes('4_a_6') || func.includes('4 a 6')) bFunc = 14;
  else if (func.includes('1_a_3') || func.includes('1 a 3')) bFunc = 8;
  else if (func.includes('somente_eu') || func.includes('somente eu')) bFunc = 4;

  // AREA BONUS (0-10)
  if (area.includes('engenheiro') && area.includes('construtora')) bArea = 10;
  else if (area.includes('engenheiro')) bArea = 6;
  else if (area.includes('construtor')) bArea = 6;
  else if (area.includes('arquiteto')) bArea = 4;

  const score = bFat + bInv + bFunc + bArea;
  const grade = score >= 70 ? 'A' : score >= 45 ? 'B' : score >= 20 ? 'C' : 'D';
  return { score, grade, breakdown: { faturamento: bFat, investimento: bInv, funcionarios: bFunc, area: bArea } };
}

// Tipo de serviço para badge
const TIPO_SERVICO_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  reforma: { label: 'Reforma', bg: 'rgba(168,85,247,0.15)', text: '#a78bfa' },
  construcao_financiada: { label: 'Const. Financiada', bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
};
```

---

## 2. LEAD SCORE BADGE NO CARD DO KANBAN

No kanban (dentro do `stageLeads.map((lead, idx) => { ... })` que começa por volta da **linha 338**), alterar o card `<motion.div>` para **adicionar** lead score e tipo de serviço. 

Encontre este trecho dentro do card (logo após a div do `lead.nome`):

```tsx
{lead.empresa && <div className="flex items-center gap-1.5 text-xs text-white/40"><Building2 className="w-3 h-3" /><span className="truncate">{lead.empresa}</span></div>}
```

Adicionar **ANTES** dessa linha (logo depois do `<p>` do nome do lead):

```tsx
{/* Lead Score + Tipo badges */}
{(() => {
  const ls = calcClientLeadScore(lead);
  const gs = LEAD_SCORE_GRADE_STYLE[ls.grade] || LEAD_SCORE_GRADE_STYLE.D;
  const tipoInfo = TIPO_SERVICO_LABELS[(lead as any).tipoServico];
  return (
    <div className="flex items-center gap-1.5 mt-0.5 mb-0.5">
      {ls.score > 0 && (
        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: gs.bg, color: gs.text, border: `1px solid ${gs.border}` }}>
          {ls.grade} ({ls.score})
        </span>
      )}
      {tipoInfo && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: tipoInfo.bg, color: tipoInfo.text }}>
          {tipoInfo.label}
        </span>
      )}
    </div>
  );
})()}
```

---

## 3. FORMULÁRIO DE LEAD SCORE NO MODAL (nova aba + seção no Detalhes)

### 3a. Adicionar aba "Lead Score" às tabs do LeadModal

Altere a constante `TABS` dentro do `LeadModal` (por volta da **linha 642**) para:

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

E altere o tipo do `activeTab`:

```tsx
const [activeTab, setActiveTab] = useState<'detalhes' | 'leadscore' | 'atendimentos' | 'tarefas' | 'demandas' | 'notas'>('detalhes');
```

### 3b. Adicionar o conteúdo da aba Lead Score

Adicione LOGO APÓS o bloco `{activeTab === 'detalhes' && ( ... )}` (depois da linha que fecha esse bloco `)}` que fica por volta da linha 792):

```tsx
{/* ── LEAD SCORE TAB ── */}
{activeTab === 'leadscore' && (() => {
  const ls = calcClientLeadScore(form);
  const gs = LEAD_SCORE_GRADE_STYLE[ls.grade] || LEAD_SCORE_GRADE_STYLE.D;
  const bars = [
    { label: 'Faturamento', value: ls.breakdown.faturamento, max: 40, hint: form.faturamento || '—' },
    { label: 'Investimento', value: ls.breakdown.investimento, max: 30, hint: (form as any).investimento || '—' },
    { label: 'Funcionários', value: ls.breakdown.funcionarios, max: 20, hint: (form as any).funcionarios || '—' },
    { label: 'Área', value: ls.breakdown.area, max: 10, hint: form.area || '—' },
  ];
  const inputCls2 = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-primary transition-colors';

  return (
    <div className="space-y-6">
      {/* Score visual */}
      <div className="flex items-center gap-5 p-5 rounded-2xl" style={{ backgroundColor: gs.bg, border: `1px solid ${gs.border}` }}>
        <div className="text-center">
          <div className="text-4xl font-extrabold" style={{ color: gs.text }}>{ls.grade}</div>
          <div className="text-lg font-bold" style={{ color: gs.text }}>{ls.score} pts</div>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-3">
          {bars.map(b => (
            <div key={b.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{b.label}</span>
                <span className="text-xs font-bold" style={{ color: gs.text }}>{b.value}/{b.max}</span>
              </div>
              <div className="h-2 rounded-full bg-white/5">
                <div className="h-full rounded-full transition-all" style={{ width: `${(b.value / b.max) * 100}%`, backgroundColor: gs.text }} />
              </div>
              <div className="text-[10px] text-white/30 mt-0.5 truncate">{b.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Formulário de critérios */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-brand-primary uppercase tracking-wider">Critérios de Qualificação</h4>

        <div>
          <label className="block text-xs text-white/40 mb-1">Tipo de Serviço</label>
          <div className="flex gap-2">
            {[
              { v: 'reforma', l: 'Reforma' },
              { v: 'construcao_financiada', l: 'Construção Financiada' },
            ].map(opt => (
              <button key={opt.v} type="button"
                onClick={() => setForm({ ...form, tipoServico: opt.v } as any)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                  (form as any).tipoServico === opt.v
                    ? 'bg-brand-primary/15 border-brand-primary/40 text-brand-primary'
                    : 'border-white/10 text-white/50 hover:border-white/20'
                }`}>
                {opt.l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-white/40 mb-1">Faturamento Mensal</label>
          <select className={inputCls2} value={form.faturamento || ''} onChange={e => setForm({ ...form, faturamento: e.target.value })}>
            <option value="">Selecione...</option>
            <option value="menos_10k">Menos de R$10k</option>
            <option value="10k_20k">R$10k - R$20k</option>
            <option value="20k_40k">R$20k - R$40k</option>
            <option value="40000">R$40k - R$70k</option>
            <option value="70000">R$70k - R$150k</option>
            <option value="150000">Acima de R$150k</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-white/40 mb-1">Investimento em Marketing</label>
          <select className={inputCls2} value={(form as any).investimento || ''} onChange={e => setForm({ ...form, investimento: e.target.value } as any)}>
            <option value="">Selecione...</option>
            <option value="nenhum">Nenhum</option>
            <option value="curso">Curso</option>
            <option value="mentoria">Mentoria</option>
            <option value="agencia">Agência</option>
            <option value="todos">Todos (curso + mentoria + agência)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-white/40 mb-1">Funcionários</label>
          <select className={inputCls2} value={(form as any).funcionarios || ''} onChange={e => setForm({ ...form, funcionarios: e.target.value } as any)}>
            <option value="">Selecione...</option>
            <option value="somente_eu">Somente eu</option>
            <option value="1_a_3">1 a 3</option>
            <option value="4_a_6">4 a 6</option>
            <option value="6_a_10">6 a 10</option>
            <option value="acima_de_10">Acima de 10</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-white/40 mb-1">Área de Atuação</label>
          <select className={inputCls2} value={form.area || ''} onChange={e => setForm({ ...form, area: e.target.value })}>
            <option value="">Selecione...</option>
            <option value="engenheiro">Engenheiro Civil</option>
            <option value="construtor">Construtor</option>
            <option value="arquiteto">Arquiteto</option>
            <option value="engenheiro construtora">Engenheiro + Construtora</option>
          </select>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-brand-primary text-black font-bold rounded-xl py-2.5 text-sm hover:brightness-110 disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar Lead Score'}
        </button>
      </div>
    </div>
  );
})()}
```

---

## 4. CHECKLIST DE DEMANDAS PÓS-VENDA (nova aba "Checklist Vendas")

Adicionar DEPOIS do bloco da aba `tarefas` (depois do `)}` que fecha o bloco `{activeTab === 'tarefas' && ( ... )}`):

```tsx
{/* ── CHECKLIST VENDAS (DEMANDAS PÓS-VENDA) TAB ── */}
{activeTab === 'demandas' && (() => {
  // Checa se o lead está em etapa "fechado/ganho"
  const currentStageName = (stages.find(s => s.id === form.stageId)?.nome || '').toLowerCase();
  const isFechado = currentStageName.includes('fech') || currentStageName.includes('ganh') || form.status === 'ganho';
  
  // Lê/salva demandas do campo dados (ou localStorage como MVP)
  const storageKey = `m2_demandas_${lead.id}`;
  const getDemandas = (): Record<string, boolean> => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { return {}; }
  };
  const [demandas, setDemandasState] = React.useState<Record<string, boolean>>(getDemandas);
  const toggleDemanda = (key: string) => {
    const updated = { ...demandas, [key]: !demandas[key] };
    setDemandasState(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const items = [
    { key: 'contrato_feito', label: 'Contrato elaborado', icon: '📄' },
    { key: 'contrato_assinado', label: 'Contrato assinado', icon: '✍️' },
    { key: 'sinal_pago', label: 'Sinal pago', icon: '💰' },
    { key: 'entrada_paga', label: 'Entrada paga', icon: '💵' },
    { key: 'credito_aprovado', label: 'Crédito aprovado', icon: '🏦' },
    { key: 'onboarding_agendado', label: 'Onboarding agendado', icon: '📅' },
    { key: 'grupo_criado', label: 'Grupo WhatsApp criado', icon: '💬' },
    { key: 'membros_adicionados', label: 'Membros adicionados ao grupo', icon: '👥' },
    { key: 'mensagem_saudacao', label: 'Mensagem de saudação enviada', icon: '👋' },
  ];

  const completedCount = items.filter(i => demandas[i.key]).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  if (!isFechado) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-white/30">
        <FileText className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-base font-medium">Checklist disponível para leads fechados</p>
        <p className="text-sm mt-1">Mova o lead para "Fechado" ou "Ganho" para liberar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-white">Checklist Pós-Venda</h4>
        <span className="text-sm font-extrabold" style={{ color: progress === 100 ? '#00FF88' : '#eab308' }}>
          {completedCount}/{items.length} · {Math.round(progress)}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/5">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: progress === 100 ? '#00FF88' : '#eab308' }} />
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map(item => (
          <button key={item.key} onClick={() => toggleDemanda(item.key)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
              demandas[item.key]
                ? 'bg-brand-primary/5 border-brand-primary/20'
                : 'bg-white/[0.02] border-white/8 hover:border-white/15'
            }`}>
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              demandas[item.key]
                ? 'border-brand-primary bg-brand-primary/20'
                : 'border-white/15'
            }`}>
              {demandas[item.key] && <CheckCircle2 size={14} className="text-brand-primary" />}
            </div>
            <span className="text-sm mr-1">{item.icon}</span>
            <span className={`text-sm font-medium ${demandas[item.key] ? 'text-brand-primary' : 'text-white/80'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {progress === 100 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-primary/10 border border-brand-primary/20">
          <CheckCircle2 size={20} className="text-brand-primary flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-brand-primary">Processo completo!</p>
            <p className="text-xs text-white/40">Todas as demandas de venda foram concluídas.</p>
          </div>
        </div>
      )}
    </div>
  );
})()}
```

---

## 5. BOTÕES LIGAR + WHATSAPP COM LOG AUTOMÁTICO (sem print)

### 5a. No header do LeadModal (por volta da linha 683, onde estão os botões "Ganho", "Congelar", "Perda")

Adicionar **ANTES** do botão "Ganho" estes dois botões de ação rápida:

```tsx
{form.telefone && (
  <>
    <button onClick={async () => {
      window.open(`tel:${form.telefone}`, '_blank');
      const act = await createLeadActivity({
        leadId: lead.id, tenantId, tipo: 'ligacao', subtipo: 'Iniciada',
        conteudo: `Ligação iniciada para ${form.nome} (${form.telefone})`,
        autor: userName || 'Usuário', imagemUrl: '', dados: {},
      });
      setActivities(prev => [act, ...prev]);
    }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
      <PhoneCall className="w-3.5 h-3.5" /> Ligar
    </button>
    <button onClick={async () => {
      const phone = (form.telefone || '').replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}`, '_blank');
      const act = await createLeadActivity({
        leadId: lead.id, tenantId, tipo: 'ligacao', subtipo: 'WhatsApp',
        conteudo: `WhatsApp aberto para ${form.nome} (${form.telefone})`,
        autor: userName || 'Usuário', imagemUrl: '', dados: {},
      });
      setActivities(prev => [act, ...prev]);
    }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors">
      <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
    </button>
  </>
)}
```

### 5b. Na aba Atendimentos — tornar o print OPCIONAL (não mais obrigatório)

Na parte de registrar atividade (por volta da **linha 921-937**), altere:

1. O label do upload de "Print da tela (obrigatório)" para "Print da tela (opcional)"
2. O botão de submit: remova a condição `!actImage` do `disabled`. Mude de:
   ```tsx
   disabled={sendingActivity || !actImage}
   ```
   Para:
   ```tsx
   disabled={sendingActivity || (!actContent.trim() && !actImage)}
   ```

---

## 6. TIPOS ADICIONAIS NO `CrmClientLead` (IMPORTANTE)

O tipo `CrmClientLead` definido em `types.ts` não tem os campos `investimento`, `funcionarios`, `tipoServico`. Para esse MVP, trate-os usando `(form as any)` e `(lead as any)` — esses campos ficam como extensões dinâmicas. A função `calcClientLeadScore` já aceita esses campos via interface inline.

No `handleSave`, os campos extras serão salvos no update normal do Supabase. Os campos `faturamento` e `area` já existem no tipo. Os novos (`investimento`, `funcionarios`, `tipoServico`) serão ignorados pelo Supabase se não existirem na tabela — sem erro.

---

## RESUMO DAS ALTERAÇÕES

| Onde | O que |
|------|-------|
| Antes dos Props | `calcClientLeadScore()`, `LEAD_SCORE_GRADE_STYLE`, `TIPO_SERVICO_LABELS` |
| Card do Kanban | Badge de Lead Score (grade + pontos) + badge de tipo de serviço |
| LeadModal TABS | Novas abas: "Lead Score" e "Checklist Vendas" |
| LeadModal activeTab type | Adicionar `'leadscore' \| 'demandas'` |
| Aba Lead Score | Formulário completo + preview visual da grade |
| Aba Checklist Vendas | Checklist pós-venda com localStorage, só aparece se fechado/ganho |
| Header do LeadModal | Botões "Ligar" e "WhatsApp" com log automático na timeline |
| Aba Atendimentos | Print torna-se opcional, não bloqueia mais o submit |
