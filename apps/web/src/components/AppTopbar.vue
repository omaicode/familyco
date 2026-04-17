<script setup lang="ts">
import type { SupportedLocale } from '@familyco/ui';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Languages, Menu, X } from 'lucide-vue-next';

import { useI18n } from '../composables/useI18n';

interface DesktopWindowState {
  isMaximized: boolean;
  isFullScreen: boolean;
  isMinimized: boolean;
}

interface DesktopWindowStateEvent extends DesktopWindowState {
  type: 'window-state';
}

const props = defineProps<{
  mobileMenuOpen: boolean;
  pageTitle: string;
  serverReachable: boolean;
  connectionLabel: string;
}>();

const emit = defineEmits<{
  toggleMobile: [];
}>();

const { locale, supportedLocales, setLocale, t } = useI18n();
const topbarRef = ref<HTMLElement | null>(null);
const isDesktopRuntime = ref(false);
const desktopPlatform = ref('web');
const isWindowMaximized = ref(false);
let resizeObserver: ResizeObserver | null = null;
let unsubscribeDesktopSystemEvents: (() => void) | null = null;

const showDesktopWindowControls = computed(
  () => isDesktopRuntime.value && desktopPlatform.value !== 'darwin'
);

const isWindowStatePayload = (payload: unknown): payload is DesktopWindowState => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Partial<DesktopWindowState>;
  return (
    typeof candidate.isMaximized === 'boolean' &&
    typeof candidate.isFullScreen === 'boolean' &&
    typeof candidate.isMinimized === 'boolean'
  );
};

const isWindowStateEventPayload = (payload: unknown): payload is DesktopWindowStateEvent => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Partial<DesktopWindowStateEvent>;
  return candidate.type === 'window-state' && isWindowStatePayload(payload);
};

const canUseDesktopApi = (): boolean =>
  typeof window !== 'undefined' && typeof window.familycoDesktop?.invoke === 'function';

const applyWindowState = (state: DesktopWindowState): void => {
  isWindowMaximized.value = state.isMaximized;
};

const refreshWindowState = async (): Promise<void> => {
  if (!canUseDesktopApi()) {
    return;
  }

  try {
    const payload = await window.familycoDesktop!.invoke('desktop:window:state', {});
    if (isWindowStatePayload(payload)) {
      applyWindowState(payload);
    }
  } catch {
    // Ignore transient IPC errors during startup.
  }
};

const minimizeDesktopWindow = async (): Promise<void> => {
  if (!canUseDesktopApi()) {
    return;
  }

  try {
    await window.familycoDesktop!.invoke('desktop:window:minimize', {});
  } catch {
    // Ignore action failures and keep UI responsive.
  }
};

const toggleDesktopWindowMaximize = async (): Promise<void> => {
  if (!canUseDesktopApi()) {
    return;
  }

  try {
    const payload = await window.familycoDesktop!.invoke('desktop:window:toggle-maximize', {});
    if (
      payload &&
      typeof payload === 'object' &&
      'isMaximized' in payload &&
      typeof (payload as { isMaximized: unknown }).isMaximized === 'boolean'
    ) {
      isWindowMaximized.value = (payload as { isMaximized: boolean }).isMaximized;
      return;
    }
  } catch {
    // Ignore action failures and fallback to state refresh below.
  }

  await refreshWindowState();
};

const closeDesktopWindow = async (): Promise<void> => {
  if (!canUseDesktopApi()) {
    return;
  }

  try {
    await window.familycoDesktop!.invoke('desktop:window:close', {});
  } catch {
    // Ignore action failures and keep UI responsive.
  }
};

const onLocaleChange = (event: Event): void => {
  const nextLocale = (event.target as HTMLSelectElement).value as SupportedLocale;
  void setLocale(nextLocale);
};

const syncTopbarHeight = (): void => {
  document.documentElement.style.setProperty('--fc-topbar-height', `${topbarRef.value?.offsetHeight ?? 0}px`);
};

onMounted(() => {
  syncTopbarHeight();
  window.addEventListener('resize', syncTopbarHeight);

  if (typeof ResizeObserver !== 'undefined' && topbarRef.value) {
    resizeObserver = new ResizeObserver(syncTopbarHeight);
    resizeObserver.observe(topbarRef.value);
  }

  if (!canUseDesktopApi()) {
    return;
  }

  isDesktopRuntime.value = true;
  desktopPlatform.value = window.familycoDesktopConfig?.platform ?? 'unknown';

  unsubscribeDesktopSystemEvents = window.familycoDesktop!.on('desktop:system:event', (payload) => {
    if (!isWindowStateEventPayload(payload)) {
      return;
    }

    applyWindowState(payload);
  });

  void refreshWindowState();
});

onUnmounted(() => {
  window.removeEventListener('resize', syncTopbarHeight);
  resizeObserver?.disconnect();
  resizeObserver = null;
  unsubscribeDesktopSystemEvents?.();
  unsubscribeDesktopSystemEvents = null;
  document.documentElement.style.setProperty('--fc-topbar-height', '0px');
});
</script>

<template>
  <header ref="topbarRef" class="fc-topbar">
    <div class="fc-topbar-left">
      <button class="fc-hamburger" :aria-label="t('Toggle menu')" @click="emit('toggleMobile')">
        <component :is="props.mobileMenuOpen ? X : Menu" :size="18" />
      </button>
      <slot name="title">
        <h1 class="fc-topbar-title">{{ props.pageTitle }}</h1>
      </slot>
    </div>

    <div class="fc-topbar-right">
      <div class="fc-connection-dot" :data-online="props.serverReachable">
        <span class="fc-dot-label">{{ props.connectionLabel }}</span>
      </div>

      <label class="fc-topbar-locale" :title="t('Language')">
        <Languages :size="15" />
        <select class="fc-topbar-select" :value="locale" @change="onLocaleChange">
          <option v-for="option in supportedLocales" :key="option.value" :value="option.value">
            {{ option.nativeLabel }}
          </option>
        </select>
      </label>

      <div v-if="showDesktopWindowControls" class="fc-window-controls" :aria-label="t('Window controls')" role="group">
        <button
          class="fc-window-control-btn"
          type="button"
          :title="t('Minimize window')"
          :aria-label="t('Minimize window')"
          @click="minimizeDesktopWindow"
        >
          <span class="fc-window-glyph fc-window-glyph-minimize" aria-hidden="true" />
        </button>
        <button
          class="fc-window-control-btn"
          type="button"
          :title="isWindowMaximized ? t('Restore window') : t('Maximize window')"
          :aria-label="isWindowMaximized ? t('Restore window') : t('Maximize window')"
          @click="toggleDesktopWindowMaximize"
        >
          <span
            class="fc-window-glyph"
            :class="isWindowMaximized ? 'fc-window-glyph-restore' : 'fc-window-glyph-maximize'"
            aria-hidden="true"
          />
        </button>
        <button
          class="fc-window-control-btn fc-window-control-btn-close"
          type="button"
          :title="t('Close window')"
          :aria-label="t('Close window')"
          @click="closeDesktopWindow"
        >
          <X :size="13" />
        </button>
      </div>
    </div>
  </header>
</template>
