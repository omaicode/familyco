<script setup lang="ts">
import type { ProviderListItem } from '@familyco/ui';
import { onMounted, ref } from 'vue';

import { useI18n } from '../../composables/useI18n';
import { useProviders } from '../../composables/useProviders';
import ProviderCard from './provider/ProviderCard.vue';
import ProviderSetupModal from './provider/ProviderSetupModal.vue';

const { t } = useI18n();

const emit = defineEmits<{
  feedback: [type: 'success' | 'error', text: string];
}>();

const {
  providers,
  loading,
  busy,
  loadProviders,
  connectApiKey,
  connectOAuth,
  disconnectProvider,
  selectProvider
} = useProviders();

const activeProvider = ref<ProviderListItem | null>(null);
const isDesktopRuntime = typeof window !== 'undefined' && typeof window.familycoDesktop?.invoke === 'function';

const load = async (): Promise<void> => {
  await loadProviders();
};

defineExpose({ load });

onMounted(() => {
  void load();
});

const openProvider = (provider: ProviderListItem): void => {
  activeProvider.value = provider;
};

const closeProvider = (): void => {
  activeProvider.value = null;
};

const handleConnectApiKey = async (payload: { providerId: string; apiKey: string; model: string }): Promise<void> => {
  const result = await connectApiKey(payload.providerId, payload.apiKey, payload.model);
  if (!result.ok) {
    emit('feedback', 'error', formatError(result.error));
    return;
  }

  closeProvider();
  emit('feedback', 'success', t('provider.connected'));
};

const handleConnectOAuth = async (payload: { providerId: string; model: string }): Promise<void> => {
  const result = await connectOAuth(payload.providerId, payload.model);
  if (!result.ok) {
    emit('feedback', 'error', formatError(result.error));
    return;
  }

  closeProvider();
  emit('feedback', 'success', t('provider.connected'));
};

const handleDisconnect = async (providerId: string): Promise<void> => {
  const result = await disconnectProvider(providerId);
  if (!result.ok) {
    emit('feedback', 'error', formatError(result.error));
    return;
  }

  closeProvider();
  emit('feedback', 'success', t('provider.disconnected'));
};

const handleSelectPrimary = async (payload: { providerId: string; model: string }): Promise<void> => {
  const result = await selectProvider(payload.providerId, payload.model);
  if (!result.ok) {
    emit('feedback', 'error', formatError(result.error));
    return;
  }

  closeProvider();
  emit('feedback', 'success', t('provider.defaultSet'));
};

function formatError(message?: string): string {
  if (!message) {
    return t('Connection failed');
  }

  const parts = message.split(':');
  if (parts.length >= 3) {
    return parts.slice(2).join(':');
  }

  return message;
}
</script>

<template>
  <div class="pss-pane-header">
    <div>
      <h4>{{ t('AI adapter') }}</h4>
      <p>{{ t('provider.sectionDescription') }}</p>
    </div>
  </div>

  <div v-if="loading && providers.length === 0" class="pss-empty-state">
    {{ t('Loading…') }}
  </div>

  <div v-else class="pss-grid">
    <ProviderCard
      v-for="provider in providers"
      :key="provider.id"
      :provider="provider"
      :is-busy="!!busy[provider.id]"
      @configure="openProvider"
    />
  </div>

  <ProviderSetupModal
    :provider="activeProvider"
    :is-desktop-runtime="isDesktopRuntime"
    :is-busy="activeProvider ? !!busy[activeProvider.id] : false"
    @close="closeProvider"
    @connect-api-key="handleConnectApiKey"
    @connect-oauth="handleConnectOAuth"
    @disconnect="handleDisconnect"
    @select-primary="handleSelectPrimary"
  />
</template>

<style scoped>
.pss-pane-header {
  margin-bottom: 20px;
}

.pss-pane-header h4 {
  margin: 0 0 4px;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--fc-text);
}

.pss-pane-header p {
  margin: 0;
  font-size: 0.82rem;
  color: var(--fc-text-muted);
}

.pss-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.pss-empty-state {
  padding: 22px;
  border: 1px dashed var(--fc-border-subtle);
  border-radius: 14px;
  text-align: center;
  color: var(--fc-text-muted);
  font-size: 0.875rem;
}
</style>
