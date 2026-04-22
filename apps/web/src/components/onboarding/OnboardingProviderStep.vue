<script setup lang="ts">
import type { ProviderListItem } from '@familyco/ui';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-vue-next';
import { computed, onMounted, ref, watch } from 'vue';

import { useI18n } from '../../composables/useI18n';
import { useProviders } from '../../composables/useProviders';
import ProviderCard from '../settings/provider/ProviderCard.vue';
import ProviderSetupModal from '../settings/provider/ProviderSetupModal.vue';

interface ProviderStepState {
  ready: boolean;
  primaryProviderId: string | null;
  primaryProviderName: string | null;
  primaryModel: string | null;
}

const props = defineProps<{
  isDesktopRuntime: boolean;
}>();

const emit = defineEmits<{
  stateChange: [state: ProviderStepState];
}>();

const { t } = useI18n();
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
const feedback = ref<{ type: 'success' | 'error'; text: string } | null>(null);

const primaryProvider = computed(() => providers.value.find((provider) => provider.isPrimary) ?? null);

const emitState = (): void => {
  emit('stateChange', {
    ready: !!primaryProvider.value?.connected,
    primaryProviderId: primaryProvider.value?.id ?? null,
    primaryProviderName: primaryProvider.value?.name ?? null,
    primaryModel: primaryProvider.value?.currentModel ?? null
  });
};

watch(primaryProvider, emitState, { immediate: true });

const load = async (): Promise<void> => {
  feedback.value = null;
  await loadProviders();
  emitState();
};

onMounted(() => {
  void load();
});

const openProvider = (provider: ProviderListItem): void => {
  feedback.value = null;
  activeProvider.value = provider;
};

const closeProvider = (): void => {
  activeProvider.value = null;
};

const handleConnectApiKey = async (payload: { providerId: string; apiKey: string; model: string }): Promise<void> => {
  feedback.value = null;
  const providerName = activeProvider.value?.name ?? payload.providerId;
  const connected = await connectApiKey(payload.providerId, payload.apiKey, payload.model);
  if (!connected.ok) {
    feedback.value = { type: 'error', text: formatError(connected.error) };
    return;
  }

  const selected = await selectProvider(payload.providerId, payload.model);
  if (!selected.ok) {
    feedback.value = { type: 'error', text: formatError(selected.error) };
    return;
  }

  closeProvider();
};

const handleConnectOAuth = async (payload: { providerId: string; model: string }): Promise<void> => {
  feedback.value = null;
  const providerName = activeProvider.value?.name ?? payload.providerId;
  const connected = await connectOAuth(payload.providerId, payload.model);
  if (!connected.ok) {
    feedback.value = { type: 'error', text: formatError(connected.error) };
    return;
  }

  const selected = await selectProvider(payload.providerId, payload.model);
  if (!selected.ok) {
    feedback.value = { type: 'error', text: formatError(selected.error) };
    return;
  }

  closeProvider();
};

const handleDisconnect = async (providerId: string): Promise<void> => {
  feedback.value = null;
  const result = await disconnectProvider(providerId);
  if (!result.ok) {
    feedback.value = { type: 'error', text: formatError(result.error) };
    return;
  }

  closeProvider();
  feedback.value = { type: 'success', text: t('provider.disconnected') };
};

const handleSelectPrimary = async (payload: { providerId: string; model: string }): Promise<void> => {
  feedback.value = null;
  const result = await selectProvider(payload.providerId, payload.model);
  if (!result.ok) {
    feedback.value = { type: 'error', text: formatError(result.error) };
    return;
  }

  closeProvider();
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
  <div class="op-step">
    <div v-if="loading && providers.length === 0" class="op-step__loading">
      <Loader2 :size="18" class="op-step__spin" />
      <span>{{ t('provider.loading') }}</span>
    </div>

    <div v-else class="op-step__grid">
      <ProviderCard
        v-for="provider in providers"
        :key="provider.id"
        :provider="provider"
        :is-busy="!!busy[provider.id]"
        @configure="openProvider"
      />
    </div>

    <div v-if="primaryProvider" class="op-step__banner op-step__banner--success">
      <CheckCircle2 :size="14" />
      <span>
        {{ t('onboarding.provider.selectedSummary', {
          provider: primaryProvider.name,
          model: primaryProvider.currentModel
        }) }}
      </span>
    </div>
    <div v-else class="op-step__banner op-step__banner--warning">
      <AlertTriangle :size="14" />
      <span>{{ t('onboarding.provider.required') }}</span>
    </div>

    <p class="op-step__hint">{{ t('onboarding.provider.selectionHint') }}</p>

    <div v-if="feedback" class="op-step__feedback" :class="feedback.type === 'success' ? 'op-step__feedback--success' : 'op-step__feedback--error'">
      <CheckCircle2 v-if="feedback.type === 'success'" :size="14" />
      <AlertTriangle v-else :size="14" />
      <span>{{ feedback.text }}</span>
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
  </div>
</template>

<style scoped>
.op-step {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.op-step__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.op-step__loading,
.op-step__banner,
.op-step__feedback {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 0.875rem;
}

.op-step__loading {
  border: 1px dashed var(--fc-border-subtle);
  color: var(--fc-text-muted);
  justify-content: center;
}

.op-step__banner--success,
.op-step__feedback--success {
  color: #15803d;
  background: color-mix(in srgb, #16a34a 10%, transparent);
  border: 1px solid color-mix(in srgb, #16a34a 24%, transparent);
}

.op-step__banner--warning,
.op-step__feedback--error {
  color: #b45309;
  background: color-mix(in srgb, #f59e0b 10%, transparent);
  border: 1px solid color-mix(in srgb, #f59e0b 24%, transparent);
}

.op-step__hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--fc-text-muted);
}

.op-step__spin {
  animation: op-step-spin 0.8s linear infinite;
}

@keyframes op-step-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>