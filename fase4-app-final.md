# FASE 4 — Decompor App.tsx e finalizar reestruturação

> Pré-requisito: Fases 1-3 completas.
> App.tsx tem 2884 linhas. Ao final ficará com ~100-120 linhas (só rotas + shell).

---

## Estrutura alvo

```
src/
├── auth/
│   └── LoginPage.tsx
├── shared/                          (já criado na Fase 1)
│   ├── hooks/
│   │   └── useSession.ts            (NOVO)
│   └── components/
│       ├── Layout.tsx               (NOVO — sidebar + navbar)
│       ├── SidebarItem.tsx
│       ├── LoadingScreen.tsx
│       ├── UserMenu.tsx
│       ├── NotificationPanel.tsx
│       └── GlobalSearchModal.tsx
├── clientes/
│   ├── ClientesPage.tsx             (tabela de clientes)
│   ├── KanbanOperacaoPage.tsx       (kanban de operação)
│   └── components/
│       ├── ClientCard.tsx
│       ├── ClientModal.tsx
│       ├── ClientRegistrationModal.tsx
│       ├── KanbanFilterPanel.tsx
│       ├── TagManager.tsx
│       ├── MultiSelect.tsx
│       ├── OfferSection.tsx
│       ├── OnboardingSection.tsx
│       └── MeetingsSection.tsx
├── equipe/
│   ├── EquipePage.tsx
│   └── TeamMemberModal.tsx
├── relatorio/
│   ├── RelatorioPage.tsx            (← ReportsView)
│   └── ComercialPage.tsx            (← ComercialView)
├── dashboard/                       (já criado na Fase 2)
├── crm/                             (já criado na Fase 3)
└── App.tsx                          (~100 linhas)
```

---

## Mapeamento de linhas no App.tsx original

| Trecho | Linhas aprox. | Destino |
|--------|---------------|---------|
| Imports | 1-90 | Distribuir entre módulos |
| formatDate, generateMeetings | 91-125 | `shared/lib/dateHelpers.ts` ou `clientes/utils.ts` |
| SidebarItem | 128-141 | `shared/components/SidebarItem.tsx` |
| MetricCard | 143-161 | `shared/components/MetricCard.tsx` |
| ClientCard | 168-220 | `clientes/components/ClientCard.tsx` |
| MultiSelect | 221-250 | `clientes/components/MultiSelect.tsx` |
| TagManager | 251-384 | `clientes/components/TagManager.tsx` |
| OfferSection | 385-506 | `clientes/components/OfferSection.tsx` |
| ClientRegistrationModal | 507-566 | `clientes/components/ClientRegistrationModal.tsx` |
| OnboardingSection | 667-717 | `clientes/components/OnboardingSection.tsx` |
| MeetingsSection | 718-756 | `clientes/components/MeetingsSection.tsx` |
| LoginScreen | 757-865 | `auth/LoginPage.tsx` |
| GlobalSearchModal | 867-943 | `shared/components/GlobalSearchModal.tsx` |
| NotificationPanel | 945-988 | `shared/components/NotificationPanel.tsx` |
| UserMenu | 990-1018 | `shared/components/UserMenu.tsx` |
| KanbanFilterPanel | 1019-1102 | `clientes/components/KanbanFilterPanel.tsx` |
| SettingsView | 1103-1250 | `clientes/SettingsPage.tsx` |
| ReportsView | 1251-1396 | `relatorio/RelatorioPage.tsx` |
| TeamMemberModal | 1397-1572 | `equipe/TeamMemberModal.tsx` |
| ClientModal | 1573-1874 | `clientes/components/ClientModal.tsx` |
| LoadingScreen | 1875-1882 | `shared/components/LoadingScreen.tsx` |
| ComercialView | 1883-2066 | `relatorio/ComercialPage.tsx` |
| App() principal | 2069-2884 | `App.tsx` (~100 linhas) + hooks + pages |

---

## Passo a passo

### 4.1 — Criar `src/shared/hooks/useSession.ts`

⚠️ O login agora usa **Supabase Auth** (signInWithPassword), NÃO localStorage com comparação de senha.
A versão em produção do LoginScreen faz:
1. `authenticateUser(email, password)` → chama `supabase.auth.signInWithPassword()`
2. Verifica MFA (2FA) — se `nextLevel === 'aal2'`, pede código TOTP antes de completar login
3. Se autenticar, busca `team_members` pelo email pra montar `UserSession`
4. Também tenta `authenticateCrmUser()` pra login de clientes

Extrair lógica de sessão:

```ts
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { UserSession } from '../types';

export function useSession() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Checar sessão Supabase Auth ao montar
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // Sessão existe — restaurar UserSession do localStorage
        const saved = localStorage.getItem('hubm2black_session');
        if (saved) {
          try { setUserSession(JSON.parse(saved)); } catch {}
        }
      }
      setIsLoading(false);
    };
    checkSession();

    // Listener de mudança de auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUserSession(null);
        localStorage.removeItem('hubm2black_session');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Persist UserSession no localStorage (dados de UI, não de auth)
  useEffect(() => {
    if (userSession) localStorage.setItem('hubm2black_session', JSON.stringify(userSession));
    else localStorage.removeItem('hubm2black_session');
  }, [userSession]);

  const login = (session: UserSession) => setUserSession(session);
  
  const logout = async () => {
    const { signOut } = await import('../lib/database');
    await signOut();
    setUserSession(null);
  };

  return { session: userSession, isLoading, login, logout };
}
```

### 4.2 — Criar `src/shared/hooks/useAppData.ts`

Extrair carregamento de dados globais (clients, tags, team, config):

```ts
import { useState, useEffect } from 'react';
import type { Client, Tag, TeamMember, AgencyConfig } from '../types';
import { getClients, getTags, getTeamMembers, getAgencyConfig, updateAgencyConfig } from '../lib/database';
import { INITIAL_TAGS, INITIAL_TEAM_MEMBERS, INITIAL_AGENCY_CONFIG, MOCK_CLIENTS } from '../constants';

export function useAppData(isLoggedIn: boolean) {
  const [clients, setClients] = useState<Client[]>([]);
  const [allTags, setAllTags] = useState<Record<string, Tag>>(INITIAL_TAGS);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(INITIAL_TEAM_MEMBERS);
  const [agencyConfig, setAgencyConfig] = useState<AgencyConfig>(INITIAL_AGENCY_CONFIG);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [dbClients, dbTags, dbTeam, dbConfig] = await Promise.all([
          getClients(), getTags(), getTeamMembers(), getAgencyConfig(),
        ]);
        // ... copiar lógica de mapeamento do App.tsx (linhas 2097-2127) ...
      } catch (error) {
        console.error('Error loading data from Supabase:', error);
      }
    };
    loadData();
  }, [isLoggedIn]);

  return { clients, setClients, allTags, setAllTags, teamMembers, setTeamMembers, agencyConfig, setAgencyConfig };
}
```

### 4.3 — Criar shared/components/

Cada componente é simples — extrair a função e seus imports:

- `SidebarItem.tsx` — linhas 128-141
- `MetricCard.tsx` — linhas 143-161  
- `LoadingScreen.tsx` — linhas 1875-1882
- `UserMenu.tsx` — linhas 990-1018
- `NotificationPanel.tsx` — linhas 945-988
- `GlobalSearchModal.tsx` — linhas 867-943

### 4.4 — Criar `src/shared/components/Layout.tsx`

Extrair o shell (sidebar + navbar) do App.tsx (linhas 2694-2836):

```tsx
import React, { useState } from 'react';
import { LayoutDashboard, Users, Kanban as KanbanIcon, BarChart3, Settings, Briefcase,
         Search, Bell, ChevronRight, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SidebarItem } from './SidebarItem';
import { UserMenu } from './UserMenu';
import { NotificationPanel } from './NotificationPanel';
import { GlobalSearchModal } from './GlobalSearchModal';
import type { UserSession, AgencyConfig, Client, Notification } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userSession: UserSession;
  agencyConfig: AgencyConfig;
  clients: Client[];
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onLogout: () => void;
  onSelectClient: (id: string) => void;
  visibleTabs: string[];
}

export function Layout({ children, activeTab, onTabChange, userSession, agencyConfig, 
                          clients, notifications, onMarkRead, onLogout, onSelectClient, visibleTabs }: LayoutProps) {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Global shortcut ⌘K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen bg-bg-main overflow-hidden">
      {/* Sidebar — copiar JSX das linhas 2697-2755 */}
      {/* Filtrar tabs pela prop visibleTabs baseado no role */}
      
      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Navbar — copiar linhas 2759-2797 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          {children}
        </div>
      </main>

      {/* Search modal */}
      <GlobalSearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} 
                         clients={clients} onSelectClient={onSelectClient} />
    </div>
  );
}
```

### 4.5 — Criar `src/auth/LoginPage.tsx`

⚠️ A versão em produção do LoginScreen é DIFERENTE da versão nos project files.
A versão em produção inclui:
- Login via `authenticateUser()` (Supabase Auth signInWithPassword)
- Login de clientes CRM via `authenticateCrmUser()`
- Fluxo MFA/2FA (mfaChallenge → mfaVerify antes de completar login)
- Botão "Esqueci minha senha" com `resetPassword()`
- Loading state durante autenticação

Extrair do App.tsx **em produção** (NÃO do project file que pode estar desatualizado):

```tsx
import React, { useState } from 'react';
import { Kanban as KanbanIcon, User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { authenticateUser, resetPassword, mfaListFactors, mfaChallenge, mfaVerify, mfaGetAuthenticatorLevel } from '../shared/lib/database';
import type { UserSession, TeamMember, AgencyConfig } from '../shared/types';

interface LoginPageProps {
  onLogin: (session: UserSession) => void;
  onCrmLogin?: (user: any, tenant: any) => void;
  teamMembers: TeamMember[];
  agencyConfig: AgencyConfig;
}

export function LoginPage({ onLogin, onCrmLogin, teamMembers, agencyConfig }: LoginPageProps) {
  // ... copiar LoginScreen do repositório em produção ...
  // Inclui: handleSubmit com signInWithPassword + MFA flow + reset senha
}
```

⚠️ Se o LoginScreen nos project files ainda faz `teamMembers.find(m => m.email === email)` sem Auth, IGNORAR e usar a versão do repositório git.

### 4.6 — Criar `src/clientes/` e `src/equipe/` e `src/relatorio/`

Cada um segue o mesmo padrão: extrair componente + criar page wrapper.

**`src/clientes/ClientesPage.tsx`** ← renderClientes (linhas 2592-2693)
**`src/clientes/KanbanOperacaoPage.tsx`** ← renderKanban (linhas 2524-2590)
**`src/equipe/EquipePage.tsx`** ← renderEquipe (linhas 2382-2449)
**`src/equipe/TeamMemberModal.tsx`** ← TeamMemberModal (linhas 1397-1572)
**`src/relatorio/RelatorioPage.tsx`** ← ReportsView (linhas 1251-1396)
**`src/relatorio/ComercialPage.tsx`** ← ComercialView (linhas 1883-2066)
**`src/clientes/components/ClientModal.tsx`** ← ClientModal (linhas 1573-1874)
**`src/clientes/SettingsPage.tsx`** ← SettingsView (linhas 1103-1250)

### 4.7 — Reescrever `src/App.tsx` (~100 linhas)

```tsx
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSession } from './shared/hooks/useSession';
import { useAppData } from './shared/hooks/useAppData';
import { LoginPage } from './auth/LoginPage';
import { Layout } from './shared/components/Layout';
import { LoadingScreen } from './shared/components/LoadingScreen';
import type { Notification } from './shared/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Lazy load pages
const DashboardPage   = lazy(() => import('./dashboard/DashboardPage'));
const CRMPage         = lazy(() => import('./crm/CRMPage'));
const ClientesPage    = lazy(() => import('./clientes/ClientesPage'));
const KanbanOperacao  = lazy(() => import('./clientes/KanbanOperacaoPage'));
const EquipePage      = lazy(() => import('./equipe/EquipePage'));
const RelatorioPage   = lazy(() => import('./relatorio/RelatorioPage'));
const ComercialPage   = lazy(() => import('./relatorio/ComercialPage'));
const SettingsPage    = lazy(() => import('./clientes/SettingsPage'));
const PlaybooksPage   = lazy(() => import('./playbooks/PlaybooksPage'));

function getDefaultTab(role: string): string {
  const r = (role || '').toLowerCase();
  if (r === 'comercial') return 'Aquisição';
  if (r === 'admin') return 'Dashboard';
  return 'Clientes';
}

function getVisibleTabs(role: string): string[] {
  const r = (role || '').toLowerCase();
  if (r === 'admin') return ['Dashboard', 'Clientes', 'Kanban de Operação', 'Equipe', 'Relatórios', 'Aquisição', 'Playbooks', 'Configurações'];
  if (r === 'comercial') return ['Aquisição', 'Playbooks'];
  if (r === 'suporte' || r === 'entrega') return ['Clientes', 'Kanban de Operação', 'Relatórios', 'Playbooks'];
  return ['Clientes'];
}

export default function App() {
  const { session, isLoading: sessionLoading, login, logout } = useSession();
  const { clients, setClients, allTags, setAllTags, teamMembers, setTeamMembers, 
          agencyConfig, setAgencyConfig } = useAppData(!!session);
  
  const [activeTab, setActiveTab] = useState(() => session ? getDefaultTab(session.role) : 'Dashboard');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Update default tab when session changes
  useEffect(() => {
    if (session) setActiveTab(getDefaultTab(session.role));
  }, [session?.role]);

  // Auto-generate notifications (linhas 2153-2183 simplificadas)
  useEffect(() => { /* ... */ }, [clients]);

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <LoginPage onLogin={login} teamMembers={teamMembers} agencyConfig={agencyConfig} />;

  const visibleTabs = getVisibleTabs(session.role);

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userSession={session}
      agencyConfig={agencyConfig}
      clients={clients}
      notifications={notifications}
      onMarkRead={(id) => setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x))}
      onLogout={logout}
      onSelectClient={(id) => { /* setSelectedClientId + switch tab */ }}
      visibleTabs={visibleTabs}
    >
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }} className="h-full">
          <Suspense fallback={<LoadingScreen />}>
            {activeTab === 'Dashboard' && <DashboardPage userSession={session} />}
            {activeTab === 'Aquisição' && <CRMPage userSession={session} teamMembers={teamMembers} />}
            {activeTab === 'Clientes' && <ClientesPage clients={clients} allTags={allTags} teamMembers={teamMembers} />}
            {activeTab === 'Kanban de Operação' && <KanbanOperacao clients={clients} allTags={allTags} teamMembers={teamMembers} />}
            {activeTab === 'Equipe' && <EquipePage teamMembers={teamMembers} />}
            {activeTab === 'Relatórios' && <RelatorioPage clients={clients} agencyConfig={agencyConfig} />}
            {activeTab === 'Comercial' && <ComercialPage teamMembers={teamMembers} />}
            {activeTab === 'Configurações' && <SettingsPage agencyConfig={agencyConfig} allTags={allTags} />}
            {activeTab === 'Playbooks' && <PlaybooksPage />}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}
```

### 4.8 — Remover arquivos antigos

Após confirmar que tudo funciona:

```bash
rm src/types.ts           # → src/shared/types.ts
rm src/constants.ts       # → src/shared/constants.ts
rm src/supabase.ts        # → src/shared/lib/supabase.ts
rm src/database.ts        # → src/shared/lib/database.ts
# Manter DashboardView.tsx e CRMView.tsx como re-exports até limpar todas as referências
```

Atualizar todos os imports restantes nos outros arquivos (ClientCRMView, ConsultorIAView, etc.) que importam de `./types`, `./constants`, `./supabase`, `./database` para usar `./shared/...`.

---

## Verificação final

```bash
npm run build
```

Testar TODAS as rotas:
1. Login → tab padrão correto por role
2. Dashboard (7 abas)
3. Aquisição (kanban CRM)
4. Clientes (tabela + modal)
5. Kanban de Operação
6. Equipe (CRUD membros)
7. Relatórios
8. Comercial
9. Configurações
10. Playbooks
11. Busca global (⌘K)
12. Notificações
13. Logout

---

## Checklist de qualidade

- [ ] Nenhum arquivo > 500 linhas (exceto NovaAtividadeForm ~1100 e LeadModal ~1500 que serão refatorados depois)
- [ ] App.tsx < 120 linhas
- [ ] Nenhum módulo importa de outro módulo (só de shared/)
- [ ] `npm run build` compila sem erros
- [ ] Todos os testes manuais passam
