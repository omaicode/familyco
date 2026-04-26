<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import {
  LayoutDashboard, MessagesSquare, Bot, FolderKanban, ListChecks,
  Inbox, ShieldCheck, Settings, Wallet, Puzzle,
  Wifi, WifiOff, RefreshCw, AlertTriangle, BookOpen, Wrench, Search, Command, ArrowRight
} from 'lucide-vue-next';

import { uiRuntime, applyRuntimeTheme } from './runtime';
import SplashScreen from './components/SplashScreen.vue';
import AppSidebar from './components/AppSidebar.vue';
import AppTopbar from './components/AppTopbar.vue';
import FcToastViewport from './components/toast/FcToastViewport.vue';
import AgentActivityWidget from './components/AgentActivityWidget.vue';
import { useI18n } from './composables/useI18n';
import { useFounderNotifications } from './composables/useFounderNotifications';

type ThemePreference = 'system' | 'light' | 'dark';

interface SidebarCounts {
  agents: number;
  projects: number;
  tasks: number;
  pendingApprovals: number;
}

const route = useRoute();
const router = useRouter();
const { t, coerceSupportedLocale } = useI18n();
useFounderNotifications();

// ── Connection state ──────────────────────────────────────
const serverReachable = ref(uiRuntime.stores.app.state.connection.isServerReachable);
const browserOnline = ref(uiRuntime.stores.app.state.connection.isBrowserOnline);
const lastConnectionError = ref<string | null>(uiRuntime.stores.app.state.connection.lastErrorMessage);
const isReconnecting = ref(false);
const globalErrorMessage = ref<string | null>(null);

// Tracks whether settings loaded successfully at least once (for onboarding check)
const hasCheckedOnboarding = ref(false);

// ── UI state ──────────────────────────────────────────────
const sidebarCollapsed = ref(false);
const mobileMenuOpen = ref(false);
const showSplash = ref(true);
const splashVisible = ref(true);
const pendingTour = ref(false);
const quickSwitcherOpen = ref(false);
const quickSwitcherQuery = ref('');
const quickSwitcherSelectedIndex = ref(0);
const shortcutHelpOpen = ref(false);
const quickSwitcherInputRef = ref<HTMLInputElement | null>(null);
const pendingGoPrefix = ref(false);
let goPrefixTimer: ReturnType<typeof setTimeout> | null = null;

interface QuickSwitcherItem {
  id: string;
  label: string;
  hint: string;
  route: string;
}

// ── Navigation + icons ────────────────────────────────────
const navIcons: Record<string, typeof LayoutDashboard> = {
  '/dashboard': LayoutDashboard,
  '/chat':      MessagesSquare,
  '/agents':    Bot,
  '/projects':  FolderKanban,
  '/tasks':     ListChecks,
  '/inbox':     Inbox,
  '/audit':     ShieldCheck,
  '/budget':    Wallet,
  '/skills':    BookOpen,
  '/tools':     Wrench,
  '/plugins':   Puzzle,
  '/settings':  Settings,
};

const navGroups = [
  {
    label: 'Overview',
    items: uiRuntime.navigation.filter(n => ['/dashboard', '/chat'].includes(n.path)),
  },
  {
    label: 'Operations',
    items: uiRuntime.navigation.filter(n => ['/agents', '/projects', '/tasks'].includes(n.path)),
  },
  {
    label: 'Governance',
    items: uiRuntime.navigation.filter(n => ['/inbox', '/audit', '/budget'].includes(n.path)),
  },
  {
    label: 'System',
    items: uiRuntime.navigation.filter(n => ['/skills', '/tools', '/plugins', '/settings'].includes(n.path)),
  },
];

const quickSwitcherBaseItems = computed<QuickSwitcherItem[]>(() => [
  { id: 'route-dashboard', label: t('Dashboard'), hint: t('Overview'), route: '/dashboard' },
  { id: 'route-chat', label: t('Chat'), hint: t('Overview'), route: '/chat' },
  { id: 'route-agents', label: t('Agents'), hint: t('Operations'), route: '/agents' },
  { id: 'route-projects', label: t('Projects'), hint: t('Operations'), route: '/projects' },
  { id: 'route-tasks', label: t('Tasks'), hint: t('Operations'), route: '/tasks' },
  { id: 'route-inbox', label: t('Inbox'), hint: t('Governance'), route: '/inbox' },
  { id: 'route-settings', label: t('Settings'), hint: t('System'), route: '/settings' }
]);

const quickSwitcherItems = computed<QuickSwitcherItem[]>(() => {
  const projectItems = uiRuntime.stores.projects.state.data.projects.slice(0, 8).map((project) => ({
    id: `project-${project.id}`,
    label: project.name,
    hint: t('Project'),
    route: '/projects'
  }));

  const taskItems = uiRuntime.stores.tasks.state.data.tasks.slice(0, 8).map((task) => ({
    id: `task-${task.id}`,
    label: task.title,
    hint: t('Tasks'),
    route: '/tasks'
  }));

  const agentItems = uiRuntime.stores.agents.state.agents.data.slice(0, 8).map((agent) => ({
    id: `agent-${agent.id}`,
    label: agent.name,
    hint: t('Agents'),
    route: '/agents'
  }));

  return [...quickSwitcherBaseItems.value, ...projectItems, ...taskItems, ...agentItems];
});

const filteredQuickSwitcherItems = computed<QuickSwitcherItem[]>(() => {
  const query = quickSwitcherQuery.value.trim().toLowerCase();
  if (!query) {
    return quickSwitcherItems.value;
  }

  return quickSwitcherItems.value.filter((item) =>
    `${item.label} ${item.hint}`.toLowerCase().includes(query)
  );
});

const openQuickSwitcher = async (): Promise<void> => {
  quickSwitcherOpen.value = true;
  quickSwitcherQuery.value = '';
  quickSwitcherSelectedIndex.value = 0;
  await nextTick();
  quickSwitcherInputRef.value?.focus();
};

const closeQuickSwitcher = (): void => {
  quickSwitcherOpen.value = false;
};

const runQuickSwitcherSelection = async (item: QuickSwitcherItem | undefined): Promise<void> => {
  if (!item) {
    return;
  }

  await router.push(item.route);
  closeQuickSwitcher();
};

const selectQuickSwitcherIndex = (nextIndex: number): void => {
  const total = filteredQuickSwitcherItems.value.length;
  if (total <= 0) {
    quickSwitcherSelectedIndex.value = 0;
    return;
  }

  if (nextIndex < 0) {
    quickSwitcherSelectedIndex.value = total - 1;
    return;
  }

  quickSwitcherSelectedIndex.value = nextIndex % total;
};

const clearGoPrefix = (): void => {
  pendingGoPrefix.value = false;
  if (goPrefixTimer) {
    clearTimeout(goPrefixTimer);
    goPrefixTimer = null;
  }
};

const armGoPrefix = (): void => {
  clearGoPrefix();
  pendingGoPrefix.value = true;
  goPrefixTimer = setTimeout(() => {
    pendingGoPrefix.value = false;
    goPrefixTimer = null;
  }, 1000);
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
};

const handleGlobalKeydown = (event: KeyboardEvent): void => {
  if (isSetupRoute.value) {
    return;
  }

  if (quickSwitcherOpen.value) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeQuickSwitcher();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectQuickSwitcherIndex(quickSwitcherSelectedIndex.value + 1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectQuickSwitcherIndex(quickSwitcherSelectedIndex.value - 1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      void runQuickSwitcherSelection(filteredQuickSwitcherItems.value[quickSwitcherSelectedIndex.value]);
      return;
    }

    return;
  }

  if (shortcutHelpOpen.value && event.key === 'Escape') {
    event.preventDefault();
    shortcutHelpOpen.value = false;
    return;
  }

  const isMeta = event.metaKey || event.ctrlKey;
  if (isMeta && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    void openQuickSwitcher();
    return;
  }

  if (isEditableTarget(event.target)) {
    return;
  }

  if (pendingGoPrefix.value) {
    const key = event.key.toLowerCase();
    if (key === 'a') {
      event.preventDefault();
      clearGoPrefix();
      void router.push('/agents');
      return;
    }

    if (key === 'p') {
      event.preventDefault();
      clearGoPrefix();
      void router.push('/projects');
      return;
    }

    if (key === 't') {
      event.preventDefault();
      clearGoPrefix();
      void router.push('/tasks');
      return;
    }

    clearGoPrefix();
  }

  if (event.key.toLowerCase() === 'g') {
    event.preventDefault();
    armGoPrefix();
    return;
  }

  if (event.key.toLowerCase() === 'n') {
    event.preventDefault();
    void router.push({ path: '/tasks', query: { create: '1' } });
    return;
  }

  if (event.key === '?') {
    event.preventDefault();
    shortcutHelpOpen.value = true;
  }
};

// Close mobile menu on route change
watch(() => route.path, () => { mobileMenuOpen.value = false; });

// ── Setup route flag ─────────────────────────────────────
const isSetupRoute = computed(() => route.meta.hideShell === true);

// ── Sidebar pending badge ─────────────────────────────────
const sidebarCounts = ref<SidebarCounts>({
  agents: 0,
  projects: 0,
  tasks: 0,
  pendingApprovals: 0
});

const navCounts = computed<Record<string, number>>(() => ({
  '/agents': sidebarCounts.value.agents,
  '/projects': sidebarCounts.value.projects,
  '/tasks': sidebarCounts.value.tasks,
  '/inbox': sidebarCounts.value.pendingApprovals
}));

const pageTitle = computed(() => {
  const match = uiRuntime.routes.find((item) => item.path === route.path);
  return t(match?.pageTitle ?? 'FamilyCo');
});

const connectionLabel = computed(() => serverReachable.value ? t('Connected') : t('Disconnected'));
const showConnectionWarning = computed(() => !serverReachable.value);
const isOnboardingComplete = computed(() => uiRuntime.stores.settings.state.data.some(
  s => s.key === 'onboarding.complete' && s.value === true
));
const isTutorialSeen = computed(() => uiRuntime.stores.settings.state.data.some(
  s => s.key === 'tour.seen' && s.value === true
));
const canAutoStartTour = computed(() => (
  route.path === '/dashboard' &&
  isOnboardingComplete.value &&
  !isTutorialSeen.value
));

// ── Theme ────────────────────────────────────────────────
const parseThemePreference = (value: unknown): ThemePreference | null => {
  if (value === 'system' || value === 'light' || value === 'dark') return value;
  return null;
};

const applyThemePreference = (preference: ThemePreference): void => {
  const systemPrefersDark = typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  uiRuntime.stores.app.applyThemePreference(preference, systemPrefersDark);
  applyRuntimeTheme();
};

const loadThemePreference = async (): Promise<void> => {
  try {
    await uiRuntime.stores.settings.load();
    const stored = uiRuntime.stores.settings.state.data.find(item => item.key === 'ui.theme.preference');
    const storedLocale = uiRuntime.stores.settings.state.data.find(item => item.key === 'ui.locale');
    applyThemePreference(parseThemePreference(stored?.value) ?? 'system');
    uiRuntime.stores.app.setLocale(coerceSupportedLocale(storedLocale?.value, 'en'));

    // Onboarding redirect — only on first successful settings load
    if (!hasCheckedOnboarding.value) {
      hasCheckedOnboarding.value = true;
      if (!isOnboardingComplete.value && route.path !== '/setup') {
        await router.replace('/setup');
      }
    }
  } catch {
    applyThemePreference('system');
    // Server not ready yet — will retry when fc:server-ready fires
  }
};

// ── System theme watcher ──────────────────────────────────
let systemThemeMediaQuery: MediaQueryList | null = null;
const handleSystemThemeChange = (event: MediaQueryListEvent): void => {
  if (uiRuntime.stores.app.state.themePreference !== 'system') return;
  uiRuntime.stores.app.refreshThemeFromSystem(event.matches);
  applyRuntimeTheme();
};

// ── Connection helpers ────────────────────────────────────
const resolveErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return t('Unexpected application error');
};

const setGlobalError = (error: unknown) => { globalErrorMessage.value = resolveErrorMessage(error); };
const clearGlobalError = () => { globalErrorMessage.value = null; };

const setConnectionState = (reachable: boolean, errorMessage: string | null): void => {
  serverReachable.value = reachable;
  lastConnectionError.value = errorMessage;
  uiRuntime.stores.app.setServerReachable(reachable, new Date().toISOString(), errorMessage);
};

const setBrowserConnection = (isOnline: boolean): void => {
  browserOnline.value = isOnline;
  uiRuntime.stores.app.setBrowserOnline(isOnline);
};

const checkHttpHealth = async (): Promise<void> => {
  const baseUrl = uiRuntime.stores.app.state.connection.baseURL;
  const response = await fetch(`${baseUrl}/health`, { method: 'GET' });
  if (!response.ok) throw new Error(`HEALTH_CHECK_FAILED:${response.status}`);
  const payload = (await response.json()) as { status?: string };
  if (payload.status !== 'ok') throw new Error('HEALTH_CHECK_FAILED:invalid-payload');
};

const checkHealth = async () => {
  try {
    if (window.familycoDesktop?.invoke) {
      try {
        await window.familycoDesktop.invoke('desktop:health', {});
        setConnectionState(true, null);
        return;
      } catch { /* fall through */ }
    }
    await checkHttpHealth();
    setConnectionState(true, null);
  } catch (error) {
    setConnectionState(false, resolveErrorMessage(error));
  }
};

const retryRuntime = async () => {
  clearGlobalError();
  isReconnecting.value = true;
  try { await checkHealth(); } finally { isReconnecting.value = false; }
};

let healthCheckTimer: ReturnType<typeof setInterval> | null = null;
let sidebarCountTimer: ReturnType<typeof setInterval> | null = null;

const refreshSidebarCounts = async (): Promise<void> => {
  try {
    sidebarCounts.value = await uiRuntime.api.getDashboardSidebarCounts();
  } catch {
    // Keep last known counts if server is temporarily unavailable.
  }
};

const handleWindowError = (event: ErrorEvent) => setGlobalError(event.error ?? event.message);
const handleUnhandledRejection = (event: PromiseRejectionEvent) => setGlobalError(event.reason);
const handleOnline = () => { setBrowserConnection(true); void checkHealth(); };
const handleOffline = () => { setBrowserConnection(false); setConnectionState(false, 'No internet connection'); };

// ── Server-ready broadcast ────────────────────────────────
// When the server transitions from unreachable → reachable:
// 1. Dispatch 'fc:server-ready' so pages can retry their initial load.
// 2. Retry loadThemePreference if onboarding hasn't been checked yet.
watch(serverReachable, (isNowReachable, wasPreviouslyReachable) => {
  if (isNowReachable && !wasPreviouslyReachable) {
    window.dispatchEvent(new CustomEvent('fc:server-ready'));
    if (!hasCheckedOnboarding.value) {
      void loadThemePreference();
    }
  }
});

// ── Sidebar ───────────────────────────────────────────────
const toggleSidebar = () => { sidebarCollapsed.value = !sidebarCollapsed.value; };
const toggleMobileMenu = () => { mobileMenuOpen.value = !mobileMenuOpen.value; };
const closeMobileMenu = () => { mobileMenuOpen.value = false; };

const dispatchTutorialTour = async (): Promise<void> => {
  await nextTick();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('fc:start-tour'));
    });
  });
};

watch(canAutoStartTour, (shouldStart) => {
  if (!shouldStart) {
    if (isTutorialSeen.value) {
      pendingTour.value = false;
    }
    return;
  }

  if (showSplash.value || splashVisible.value) {
    pendingTour.value = true;
    return;
  }

  pendingTour.value = false;
  void dispatchTutorialTour();
});

// ── Lifecycle ─────────────────────────────────────────────
onMounted(async () => {
  setBrowserConnection(navigator.onLine);
  window.addEventListener('error', handleWindowError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('keydown', handleGlobalKeydown);

  await loadThemePreference();

  if (typeof window.matchMedia === 'function') {
    systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemThemeMediaQuery.addEventListener('change', handleSystemThemeChange);
  }

  // Splash — run health check in parallel
  void checkHealth();
  void refreshSidebarCounts();

  // Dismiss splash after boot delay + loading animation
  setTimeout(() => {
    splashVisible.value = false;
    setTimeout(() => {
      showSplash.value = false;
      if (pendingTour.value && canAutoStartTour.value) {
        pendingTour.value = false;
        void dispatchTutorialTour();
      }
    }, 350);
  }, 1600);

  healthCheckTimer = setInterval(() => void checkHealth(), 15000);
  sidebarCountTimer = setInterval(() => void refreshSidebarCounts(), 10000);
});

onUnmounted(() => {
  window.removeEventListener('error', handleWindowError);
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  window.removeEventListener('keydown', handleGlobalKeydown);
  clearGoPrefix();
  if (healthCheckTimer) { clearInterval(healthCheckTimer); healthCheckTimer = null; }
  if (sidebarCountTimer) { clearInterval(sidebarCountTimer); sidebarCountTimer = null; }
  if (systemThemeMediaQuery) { systemThemeMediaQuery.removeEventListener('change', handleSystemThemeChange); systemThemeMediaQuery = null; }
});
</script>

<template>
  <!-- ── Splash screen ───────────────────────────────────── -->
  <SplashScreen :show="showSplash && splashVisible" />
  <FcToastViewport />

  <!-- ── Onboarding / Setup — fullscreen, no shell ─────── -->
  <RouterView v-if="isSetupRoute" />

  <!-- ── App shell ──────────────────────────────────────── -->
  <div v-else :class="uiRuntime.layout.defaultContainerClasses.shell" style="display:flex; min-height:100vh;">
    <!-- Sidebar (includes mobile overlay) -->
    <AppSidebar
      :collapsed="sidebarCollapsed"
      :mobile-open="mobileMenuOpen"
      :nav-groups="navGroups"
      :nav-icons="navIcons"
      :nav-counts="navCounts"
      @toggle="toggleSidebar"
      @close-mobile="closeMobileMenu"
    />

    <!-- Main area -->
    <div :class="uiRuntime.layout.defaultContainerClasses.contentWrap" style="flex:1; min-width:0; display:flex; flex-direction:column;">
      <!-- Topbar -->
      <AppTopbar
        :mobile-menu-open="mobileMenuOpen"
        :page-title="pageTitle"
        :server-reachable="serverReachable"
        :connection-label="connectionLabel"
        @toggle-mobile="toggleMobileMenu"
      >
        <template #title>
          <!-- ── Live agent activity widget ───────────────────── -->
          <AgentActivityWidget v-if="!isSetupRoute" />
        </template>
      </AppTopbar>

      <!-- Main content -->
      <main :class="uiRuntime.layout.defaultContainerClasses.mainContent">
        <!-- Connection warning -->
        <Transition name="fc-banner">
          <section v-if="showConnectionWarning" class="fc-warning fc-banner" style="margin-bottom: 14px;">
            <component :is="browserOnline ? WifiOff : Wifi" :size="16" style="flex-shrink:0;" />
            <div style="flex:1; min-width:0;">
              <strong style="font-size:0.875rem;">
                {{ browserOnline ? t('Server unreachable') : t('Network offline') }}
              </strong>
              <p class="fc-list-meta" style="margin:2px 0 0;" v-if="lastConnectionError">
                {{ lastConnectionError }}
              </p>
            </div>
            <button
              class="fc-btn-secondary fc-btn-sm"
              :disabled="isReconnecting"
              @click="retryRuntime"
            >
              <RefreshCw :size="13" :class="{ 'fc-spin': isReconnecting }" />
              {{ isReconnecting ? t('Reconnecting…') : t('Retry') }}
            </button>
          </section>
        </Transition>

        <!-- Global error -->
        <Transition name="fc-banner">
          <section v-if="globalErrorMessage" class="fc-error fc-banner" style="margin-bottom: 14px;">
            <AlertTriangle :size="16" style="flex-shrink:0;" />
            <span style="flex:1;">{{ globalErrorMessage }}</span>
            <button class="fc-btn-secondary fc-btn-sm" @click="retryRuntime">
              <RefreshCw :size="13" />
              {{ t('Retry') }}
            </button>
          </section>
        </Transition>

        <!-- Page content with transitions -->
        <RouterView v-slot="{ Component, route: r }">
          <Transition name="fc-page" mode="out-in">
            <component :is="Component" :key="r.path" />
          </Transition>
        </RouterView>

        <Transition name="fc-banner">
          <div v-if="quickSwitcherOpen" class="fc-quick-switcher-overlay" @click.self="closeQuickSwitcher">
            <section class="fc-quick-switcher" role="dialog" aria-modal="true" :aria-label="t('Quick switcher')">
              <div class="fc-quick-head">
                <Command :size="15" />
                <input
                  ref="quickSwitcherInputRef"
                  v-model="quickSwitcherQuery"
                  class="fc-quick-input"
                  :placeholder="t('Type a command or search projects, tasks, agents…')"
                />
              </div>

              <ul class="fc-quick-list">
                <li v-if="filteredQuickSwitcherItems.length === 0" class="fc-quick-empty">
                  {{ t('No quick switcher results') }}
                </li>
                <li
                  v-for="(item, index) in filteredQuickSwitcherItems"
                  :key="item.id"
                  class="fc-quick-item"
                  :class="{ 'is-active': index === quickSwitcherSelectedIndex }"
                  @mouseenter="quickSwitcherSelectedIndex = index"
                  @click="runQuickSwitcherSelection(item)"
                >
                  <div>
                    <strong>{{ item.label }}</strong>
                    <p>{{ item.hint }}</p>
                  </div>
                  <ArrowRight :size="13" />
                </li>
              </ul>
            </section>
          </div>
        </Transition>

        <Transition name="fc-banner">
          <div v-if="shortcutHelpOpen" class="fc-shortcuts-overlay" @click.self="shortcutHelpOpen = false">
            <section class="fc-shortcuts-help" role="dialog" aria-modal="true" :aria-label="t('Keyboard shortcuts')">
              <h4>{{ t('Keyboard shortcuts') }}</h4>
              <p>{{ t('Linear-style speed with click-friendly fallback.') }}</p>
              <ul>
                <li><strong>N</strong> <span>{{ t('Create task') }}</span></li>
                <li><strong>G then A</strong> <span>{{ t('Go to agents') }}</span></li>
                <li><strong>G then P</strong> <span>{{ t('Go to projects') }}</span></li>
                <li><strong>G then T</strong> <span>{{ t('Go to tasks') }}</span></li>
                <li><strong>Ctrl/Cmd + K</strong> <span>{{ t('Open quick switcher') }}</span></li>
                <li><strong>?</strong> <span>{{ t('Open keyboard shortcuts help') }}</span></li>
              </ul>
            </section>
          </div>
        </Transition>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* Spin animation for reconnect icon */
@keyframes spin { to { transform: rotate(360deg); } }
.fc-spin { animation: spin 1s linear infinite; }

/* Banner transition */
.fc-banner-enter-active { animation: fc-banner-in 0.25s ease; }
.fc-banner-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.fc-banner-leave-to    { opacity: 0; transform: translateY(-4px); }

@keyframes fc-banner-in {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.fc-quick-switcher-overlay,
.fc-shortcuts-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--fc-bg) 55%, transparent);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 11vh 16px 24px;
  z-index: 60;
}

.fc-quick-switcher,
.fc-shortcuts-help {
  width: min(720px, 100%);
  border: 1px solid var(--fc-border-subtle);
  border-radius: 14px;
  background: var(--fc-surface);
  box-shadow: 0 14px 40px color-mix(in srgb, var(--fc-text) 22%, transparent);
}

.fc-quick-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--fc-border-subtle);
  color: var(--fc-text-muted);
}

.fc-quick-input {
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  color: var(--fc-text-main);
  font-size: 0.94rem;
}

.fc-quick-list {
  list-style: none;
  margin: 0;
  padding: 8px;
  max-height: 48vh;
  overflow: auto;
}

.fc-quick-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  color: var(--fc-text-muted);
}

.fc-quick-item strong {
  color: var(--fc-text-main);
  font-size: 0.9rem;
}

.fc-quick-item p {
  margin: 3px 0 0;
  font-size: 0.8rem;
}

.fc-quick-item.is-active,
.fc-quick-item:hover {
  background: color-mix(in srgb, var(--fc-primary) 8%, var(--fc-surface));
}

.fc-quick-empty {
  padding: 12px;
  color: var(--fc-text-muted);
  font-size: 0.86rem;
}

.fc-shortcuts-help {
  padding: 16px;
}

.fc-shortcuts-help h4 {
  margin: 0;
  font-size: 0.98rem;
}

.fc-shortcuts-help p {
  margin: 6px 0 12px;
  color: var(--fc-text-muted);
  font-size: 0.85rem;
}

.fc-shortcuts-help ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}

.fc-shortcuts-help li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 0.86rem;
}

.fc-shortcuts-help li strong {
  color: var(--fc-text-main);
}

.fc-shortcuts-help li span {
  color: var(--fc-text-muted);
  text-align: right;
}
</style>
