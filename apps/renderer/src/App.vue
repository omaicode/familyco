<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import {
  LayoutDashboard, Terminal, Bot, FolderKanban, ListChecks,
  Inbox, ShieldCheck, Settings,
  Wifi, WifiOff, RefreshCw, AlertTriangle,
} from 'lucide-vue-next';

import { uiRuntime, applyRuntimeTheme } from './runtime';
import SplashScreen from './components/SplashScreen.vue';
import AppSidebar from './components/AppSidebar.vue';
import AppTopbar from './components/AppTopbar.vue';

type ThemePreference = 'system' | 'light' | 'dark';

const route = useRoute();
const router = useRouter();

// ── Connection state ──────────────────────────────────────
const serverReachable = ref(uiRuntime.stores.app.state.connection.isServerReachable);
const browserOnline = ref(uiRuntime.stores.app.state.connection.isBrowserOnline);
const lastConnectionError = ref<string | null>(uiRuntime.stores.app.state.connection.lastErrorMessage);
const isReconnecting = ref(false);
const globalErrorMessage = ref<string | null>(null);

// ── UI state ──────────────────────────────────────────────
const sidebarCollapsed = ref(false);
const mobileMenuOpen = ref(false);
const showSplash = ref(true);
const splashVisible = ref(true);

// ── Navigation + icons ────────────────────────────────────
const navIcons: Record<string, typeof LayoutDashboard> = {
  '/dashboard': LayoutDashboard,
  '/command':   Terminal,
  '/agents':    Bot,
  '/projects':  FolderKanban,
  '/tasks':     ListChecks,
  '/inbox':     Inbox,
  '/audit':     ShieldCheck,
  '/settings':  Settings,
};

const navGroups = [
  {
    label: 'Overview',
    items: uiRuntime.navigation.filter(n => ['/dashboard'].includes(n.path)),
  },
  {
    label: 'Operations',
    items: uiRuntime.navigation.filter(n => ['/command', '/agents', '/projects', '/tasks'].includes(n.path)),
  },
  {
    label: 'Governance',
    items: uiRuntime.navigation.filter(n => ['/inbox', '/audit'].includes(n.path)),
  },
  {
    label: 'System',
    items: uiRuntime.navigation.filter(n => ['/settings'].includes(n.path)),
  },
];

// Close mobile menu on route change
watch(() => route.path, () => { mobileMenuOpen.value = false; });

// ── Sidebar pending badge ─────────────────────────────────
const pendingInboxCount = computed(() =>
  uiRuntime.stores.inbox.state.data.approvals.filter(a => a.status === 'pending').length
);

const pageTitle = computed(() => {
  const match = uiRuntime.routes.find((item) => item.path === route.path);
  return match?.pageTitle ?? 'FamilyCo';
});

const connectionLabel = computed(() => serverReachable.value ? 'Connected' : 'Disconnected');
const showConnectionWarning = computed(() => !serverReachable.value);

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
    applyThemePreference(parseThemePreference(stored?.value) ?? 'system');
  } catch {
    applyThemePreference('system');
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
  return 'Unexpected application error';
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

const handleWindowError = (event: ErrorEvent) => setGlobalError(event.error ?? event.message);
const handleUnhandledRejection = (event: PromiseRejectionEvent) => setGlobalError(event.reason);
const handleOnline = () => { setBrowserConnection(true); void checkHealth(); };
const handleOffline = () => { setBrowserConnection(false); setConnectionState(false, 'No internet connection'); };

// ── Sidebar ───────────────────────────────────────────────
const toggleSidebar = () => { sidebarCollapsed.value = !sidebarCollapsed.value; };
const toggleMobileMenu = () => { mobileMenuOpen.value = !mobileMenuOpen.value; };
const closeMobileMenu = () => { mobileMenuOpen.value = false; };

// ── Lifecycle ─────────────────────────────────────────────
onMounted(async () => {
  setBrowserConnection(navigator.onLine);
  window.addEventListener('error', handleWindowError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  await loadThemePreference();

  if (typeof window.matchMedia === 'function') {
    systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemThemeMediaQuery.addEventListener('change', handleSystemThemeChange);
  }

  // Splash — run health check in parallel
  void checkHealth();

  // Dismiss splash after boot delay + loading animation
  setTimeout(() => {
    splashVisible.value = false;
    setTimeout(() => { showSplash.value = false; }, 350);
  }, 1600);

  healthCheckTimer = setInterval(() => void checkHealth(), 15000);
});

onUnmounted(() => {
  window.removeEventListener('error', handleWindowError);
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  if (healthCheckTimer) { clearInterval(healthCheckTimer); healthCheckTimer = null; }
  if (systemThemeMediaQuery) { systemThemeMediaQuery.removeEventListener('change', handleSystemThemeChange); systemThemeMediaQuery = null; }
});
</script>

<template>
  <!-- ── Splash screen ───────────────────────────────────── -->
  <SplashScreen :show="showSplash && splashVisible" />

  <!-- ── App shell ──────────────────────────────────────── -->
  <div :class="uiRuntime.layout.defaultContainerClasses.shell" style="display:flex; min-height:100vh;">
    <!-- Sidebar (includes mobile overlay) -->
    <AppSidebar
      :collapsed="sidebarCollapsed"
      :mobile-open="mobileMenuOpen"
      :nav-groups="navGroups"
      :nav-icons="navIcons"
      :pending-inbox-count="pendingInboxCount"
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
      />

      <!-- Main content -->
      <main :class="uiRuntime.layout.defaultContainerClasses.mainContent">
        <!-- Connection warning -->
        <Transition name="fc-banner">
          <section v-if="showConnectionWarning" class="fc-warning fc-banner" style="margin-bottom: 14px;">
            <component :is="browserOnline ? WifiOff : Wifi" :size="16" style="flex-shrink:0;" />
            <div style="flex:1; min-width:0;">
              <strong style="font-size:0.875rem;">
                {{ browserOnline ? 'Server unreachable' : 'Network offline' }}
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
              {{ isReconnecting ? 'Reconnecting…' : 'Retry' }}
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
              Retry
            </button>
          </section>
        </Transition>

        <!-- Page content with transitions -->
        <RouterView v-slot="{ Component, route: r }">
          <Transition name="fc-page" mode="out-in">
            <component :is="Component" :key="r.path" />
          </Transition>
        </RouterView>
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
</style>
