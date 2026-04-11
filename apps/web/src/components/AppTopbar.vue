<script setup lang="ts">
import type { SupportedLocale } from '@familyco/ui';
import { onMounted, onUnmounted, ref } from 'vue';
import { Languages, Menu, X } from 'lucide-vue-next';

import { useI18n } from '../composables/useI18n';

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
let resizeObserver: ResizeObserver | null = null;

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
});

onUnmounted(() => {
  window.removeEventListener('resize', syncTopbarHeight);
  resizeObserver?.disconnect();
  resizeObserver = null;
  document.documentElement.style.setProperty('--fc-topbar-height', '0px');
});
</script>

<template>
  <header ref="topbarRef" class="fc-topbar">
    <div class="fc-topbar-left">
      <button class="fc-hamburger" :aria-label="t('Toggle menu')" @click="emit('toggleMobile')">
        <component :is="props.mobileMenuOpen ? X : Menu" :size="18" />
      </button>
      <h2 class="fc-topbar-title">{{ props.pageTitle }}</h2>
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
    </div>
  </header>
</template>
