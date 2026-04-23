<script setup lang="ts">
import type { ProviderAuthType, ProviderListItem } from '@familyco/ui';
import { computed, ref, watch } from 'vue';
import { ExternalLink, KeyRound, Link2, ShieldCheck } from 'lucide-vue-next';

import { useI18n } from '../../../composables/useI18n';
import FcButton from '../../FcButton.vue';
import FcModalShell from '../../FcModalShell.vue';
import FcPasswordInput from '../../FcPasswordInput.vue';
import FcSelect from '../../FcSelect.vue';

const props = defineProps<{
  provider: ProviderListItem | null;
  isDesktopRuntime: boolean;
  isBusy: boolean;
}>();

const emit = defineEmits<{
  close: [];
  connectApiKey: [payload: { providerId: string; apiKey: string; model: string }];
  connectOauth: [payload: { providerId: string; model: string }];
  selectPrimary: [payload: { providerId: string; model: string }];
  disconnect: [providerId: string];
}>();

const { t } = useI18n();
const apiKey = ref('');
const model = ref('');
const authMode = ref<ProviderAuthType>('apikey');

const supportsApiKey = computed(() => props.provider?.supportedAuthTypes.includes('apikey') ?? false);
const supportsOAuth = computed(() => props.provider?.supportedAuthTypes.includes('oauth') ?? false);
const canUseOAuth = computed(() => supportsOAuth.value && props.provider?.oauthAvailable && props.isDesktopRuntime);
const showAuthModeSwitcher = computed(() => supportsApiKey.value && canUseOAuth.value);

watch(
  () => props.provider,
  (provider) => {
    apiKey.value = '';
    model.value = provider?.currentModel ?? provider?.defaultModel ?? '';
    authMode.value = provider?.activeAuthType ?? (supportsApiKey.value ? 'apikey' : 'oauth');
  },
  { immediate: true }
);

const close = (): void => emit('close');

const connectApiKey = (): void => {
  if (!props.provider) {
    return;
  }

  emit('connectApiKey', {
    providerId: props.provider.id,
    apiKey: apiKey.value,
    model: model.value || props.provider.defaultModel
  });
};

const connectOAuth = (): void => {
  if (!props.provider) {
    return;
  }

  emit('connectOauth', {
    providerId: props.provider.id,
    model: model.value || props.provider.defaultModel
  });
};

const selectPrimary = (): void => {
  if (!props.provider) {
    return;
  }

  emit('selectPrimary', {
    providerId: props.provider.id,
    model: model.value || props.provider.defaultModel
  });
};

const disconnect = (): void => {
  if (!props.provider) {
    return;
  }

  emit('disconnect', props.provider.id);
};
</script>

<template>
  <FcModalShell
    :open="!!provider"
    :ariaLabel="t('provider.connectModal.title')"
    panel-class="provider-modal"
    @close="close"
  >
    <template v-if="provider">
      <div class="provider-modal__header">
        <div>
          <p class="provider-modal__eyebrow">{{ t('provider.connectModal.title') }}</p>
          <h3>{{ provider.name }}</h3>
          <p>{{ provider.description }}</p>
        </div>
        <span class="provider-modal__status" :class="provider.connected ? 'provider-modal__status--connected' : 'provider-modal__status--disconnected'">
          {{ provider.connected ? t('provider.connected') : t('provider.notConnected') }}
        </span>
      </div>

      <div class="provider-modal__field">
        <label class="provider-modal__label" for="provider-model">{{ t('AI model') }}</label>
        <FcSelect id="provider-model" v-model="model">
          <option v-for="item in provider.availableModels" :key="item" :value="item">{{ item }}</option>
        </FcSelect>
      </div>

      <div v-if="showAuthModeSwitcher" class="provider-modal__modes">
        <button
          type="button"
          class="provider-modal__mode-btn"
          :class="{ 'provider-modal__mode-btn--active': authMode === 'apikey' }"
          @click="authMode = 'apikey'"
        >
          <KeyRound :size="14" />
          {{ t('provider.connectModal.useApiKey') }}
        </button>
        <button
          type="button"
          class="provider-modal__mode-btn"
          :class="{ 'provider-modal__mode-btn--active': authMode === 'oauth' }"
          @click="authMode = 'oauth'"
        >
          <ShieldCheck :size="14" />
          {{ t('provider.connectModal.useOAuth') }}
        </button>
      </div>

      <div v-if="(authMode === 'apikey' || !canUseOAuth) && supportsApiKey" class="provider-modal__panel">
        <div class="provider-modal__field">
          <label class="provider-modal__label" for="provider-api-key">{{ t('API Key') }}</label>
          <FcPasswordInput
            id="provider-api-key"
            v-model="apiKey"
            :placeholder="provider.keyHint"
            :disabled="isBusy"
          />
        </div>
        <div class="provider-modal__actions">
          <FcButton variant="primary" size="sm" :disabled="isBusy || apiKey.trim().length === 0" @click="connectApiKey">
            <KeyRound :size="12" />
            {{ provider.connected ? t('provider.update') : t('provider.connect') }}
          </FcButton>
        </div>
      </div>

      <div v-else-if="canUseOAuth" class="provider-modal__panel provider-modal__panel--oauth">
        <p>{{ t('provider.connectModal.oauthHelp') }}</p>
        <div class="provider-modal__actions">
          <FcButton variant="primary" size="sm" :disabled="isBusy" @click="connectOAuth">
            <ExternalLink :size="12" />
            {{ provider.connected ? t('provider.reconnect') : t('provider.connectOAuth') }}
          </FcButton>
        </div>
      </div>

      <div v-else-if="supportsOAuth" class="provider-modal__panel provider-modal__panel--hint">
        <p>{{ t('provider.connectModal.desktopOnly') }}</p>
      </div>

      <div class="provider-modal__footer">
        <FcButton
          v-if="provider.connected && !provider.isPrimary"
          variant="secondary"
          size="sm"
          :disabled="isBusy"
          @click="selectPrimary"
        >
          <Link2 :size="12" />
          {{ t('provider.setDefault') }}
        </FcButton>
        <FcButton
          v-if="provider.connected"
          variant="ghost"
          size="sm"
          :disabled="isBusy"
          @click="disconnect"
        >
          {{ t('provider.disconnect') }}
        </FcButton>
        <FcButton variant="ghost" size="sm" :disabled="isBusy" @click="close">
          {{ t('Close') }}
        </FcButton>
      </div>
    </template>
  </FcModalShell>
</template>

<style scoped>
.provider-modal :deep(.fc-modal-shell__panel) {
  width: min(640px, 100%);
}

.provider-modal__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.provider-modal__eyebrow {
  margin: 0 0 4px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fc-accent);
}

.provider-modal__header h3 {
  margin: 0 0 6px;
  font-size: 1.125rem;
  color: var(--fc-text);
}

.provider-modal__header p {
  margin: 0;
  color: var(--fc-text-muted);
  font-size: 0.875rem;
  line-height: 1.5;
}

.provider-modal__status {
  display: inline-flex;
  align-items: center;
  height: fit-content;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.provider-modal__status--connected {
  color: #15803d;
  background: color-mix(in srgb, #16a34a 12%, transparent);
}

.provider-modal__status--disconnected {
  color: #b45309;
  background: color-mix(in srgb, #f59e0b 12%, transparent);
}

.provider-modal__field {
  margin-bottom: 16px;
}

.provider-modal__label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--fc-text);
}

.provider-modal__modes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.provider-modal__mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--fc-surface);
  color: var(--fc-text-muted);
}

.provider-modal__mode-btn--active {
  border-color: color-mix(in srgb, var(--fc-accent) 45%, var(--fc-border-subtle));
  color: var(--fc-accent);
  background: color-mix(in srgb, var(--fc-accent) 8%, transparent);
}

.provider-modal__panel {
  border: 1px solid var(--fc-border-subtle);
  border-radius: 14px;
  padding: 16px;
  background: color-mix(in srgb, var(--fc-surface) 92%, white);
}

.provider-modal__panel--oauth p,
.provider-modal__panel--hint p {
  margin: 0;
  color: var(--fc-text-muted);
  font-size: 0.875rem;
  line-height: 1.5;
}

.provider-modal__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.provider-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 18px;
}

@media (max-width: 640px) {
  .provider-modal__header {
    flex-direction: column;
  }

  .provider-modal__modes {
    grid-template-columns: 1fr;
  }
}
</style>
