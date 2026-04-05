<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';

import { uiRuntime, applyRuntimeTheme } from './runtime';

type ThemePreference = 'system' | 'light' | 'dark';

const route = useRoute();

const serverReachable = ref(uiRuntime.stores.app.state.connection.isServerReachable);
const browserOnline = ref(uiRuntime.stores.app.state.connection.isBrowserOnline);
const lastConnectionError = ref<string | null>(uiRuntime.stores.app.state.connection.lastErrorMessage);

const pageTitle = computed(() => {
  const match = uiRuntime.routes.find((item) => item.path === route.path);
  return match?.pageTitle ?? 'FamilyCo';
});

const connectionLabel = computed(() => (serverReachable.value ? 'Connected' : 'Disconnected'));
const showConnectionWarning = computed(() => !serverReachable.value);

let healthCheckTimer: ReturnType<typeof setInterval> | null = null;
let systemThemeMediaQuery: MediaQueryList | null = null;

const globalErrorMessage = ref<string | null>(null);
const isReconnecting = ref(false);

const resolveErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return 'Unexpected application error';
};

const setGlobalError = (error: unknown): void => {
  globalErrorMessage.value = resolveErrorMessage(error);
};

const clearGlobalError = (): void => {
  globalErrorMessage.value = null;
};

const setConnectionState = (reachable: boolean, errorMessage: string | null): void => {
  serverReachable.value = reachable;
  lastConnectionError.value = errorMessage;
  uiRuntime.stores.app.setServerReachable(reachable, new Date().toISOString(), errorMessage);
};

const setBrowserConnection = (isOnline: boolean): void => {
  browserOnline.value = isOnline;
  uiRuntime.stores.app.setBrowserOnline(isOnline);
};

const parseThemePreference = (value: unknown): ThemePreference | null => {
  if (value === 'system' || value === 'light' || value === 'dark') {
    return value;
  }

  return null;
};

const applyThemePreference = (preference: ThemePreference): void => {
  const systemPrefersDark =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  uiRuntime.stores.app.applyThemePreference(preference, systemPrefersDark);
  applyRuntimeTheme();
};

const loadThemePreference = async (): Promise<void> => {
  try {
    await uiRuntime.stores.settings.load();
    const stored = uiRuntime.stores.settings.state.data.find((item) => item.key === 'ui.theme.preference');
    const preference = parseThemePreference(stored?.value);

    applyThemePreference(preference ?? 'system');
  } catch {
    applyThemePreference('system');
  }
};

const handleSystemThemeChange = (event: MediaQueryListEvent): void => {
  if (uiRuntime.stores.app.state.themePreference !== 'system') {
    return;
  }

  uiRuntime.stores.app.refreshThemeFromSystem(event.matches);
  applyRuntimeTheme();
};

const checkHttpHealth = async (): Promise<void> => {
  const baseUrl = uiRuntime.stores.app.state.connection.baseURL;
  const response = await fetch(`${baseUrl}/health`, {
    method: 'GET'
  });

  if (!response.ok) {
    throw new Error(`HEALTH_CHECK_FAILED:${response.status}`);
  }

  const payload = (await response.json()) as { status?: string };
  if (payload.status !== 'ok') {
    throw new Error('HEALTH_CHECK_FAILED:invalid-payload');
  }
};

const checkHealth = async () => {
  try {
    if (window.familycoDesktop?.invoke) {
      try {
        await window.familycoDesktop.invoke('desktop:health', {});
        setConnectionState(true, null);
        return;
      } catch {
        // Fall through to HTTP health probe if IPC is not ready.
      }
    }

    await checkHttpHealth();
    setConnectionState(true, null);
  } catch (error) {
    setConnectionState(false, resolveErrorMessage(error));
  }
};

const handleWindowError = (event: ErrorEvent): void => {
  setGlobalError(event.error ?? event.message);
};

const handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
  setGlobalError(event.reason);
};

const retryRuntime = async (): Promise<void> => {
  clearGlobalError();
  isReconnecting.value = true;
  try {
    await checkHealth();
  } finally {
    isReconnecting.value = false;
  }
};

const handleOnline = (): void => {
  setBrowserConnection(true);
  void checkHealth();
};

const handleOffline = (): void => {
  setBrowserConnection(false);
  setConnectionState(false, 'No internet connection detected');
};

onMounted(async () => {
  setBrowserConnection(navigator.onLine);
  window.addEventListener('error', handleWindowError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  await loadThemePreference();
  await checkHealth();

  if (typeof window.matchMedia === 'function') {
    systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    systemThemeMediaQuery.addEventListener('change', handleSystemThemeChange);
  }

  healthCheckTimer = setInterval(() => {
    void checkHealth();
  }, 15000);
});

onUnmounted(() => {
  window.removeEventListener('error', handleWindowError);
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);

  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }

  if (systemThemeMediaQuery) {
    systemThemeMediaQuery.removeEventListener('change', handleSystemThemeChange);
    systemThemeMediaQuery = null;
  }
});
</script>

<template>
  <div :class="uiRuntime.layout.defaultContainerClasses.shell">
    <aside class="fc-sidebar">
      <div class="fc-brand">
        <h1>FamilyCo</h1>
        <p>AI-native operating system</p>
      </div>

      <nav class="fc-nav">
        <RouterLink
          v-for="section in uiRuntime.navigation"
          :key="section.path"
          :to="section.path"
          class="fc-nav-item"
          active-class="fc-nav-item-active"
        >
          <span class="fc-nav-label">{{ section.label }}</span>
          <span class="fc-nav-desc">{{ section.description }}</span>
        </RouterLink>
      </nav>
    </aside>

    <div :class="uiRuntime.layout.defaultContainerClasses.contentWrap">
      <header class="fc-topbar">
        <div>
          <p class="fc-topbar-caption">Workspace</p>
          <h2>{{ pageTitle }}</h2>
        </div>

        <div class="fc-topbar-right">
          <span class="fc-connection" :data-online="serverReachable">
            {{ connectionLabel }}
          </span>
          <span class="fc-founder">Founder</span>
        </div>
      </header>

      <main :class="uiRuntime.layout.defaultContainerClasses.mainContent">
        <section v-if="showConnectionWarning" class="fc-warning" style="margin-bottom: 12px">
          <p style="margin: 0 0 8px">
            {{ browserOnline ? 'Server is unreachable right now.' : 'Network is offline, trying local server.' }}
          </p>
          <p v-if="lastConnectionError" class="fc-list-meta" style="margin: 0 0 8px">
            {{ lastConnectionError }}
          </p>
          <button class="fc-btn-secondary" type="button" :disabled="isReconnecting" @click="retryRuntime">
            {{ isReconnecting ? 'Reconnecting...' : 'Reconnect' }}
          </button>
        </section>

        <section v-if="globalErrorMessage" class="fc-error" style="margin-bottom: 12px">
          <p style="margin: 0 0 8px">{{ globalErrorMessage }}</p>
          <button class="fc-btn-secondary" type="button" @click="retryRuntime">Retry</button>
        </section>

        <RouterView />
      </main>
    </div>
  </div>
</template>
