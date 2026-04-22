<script setup lang="ts">
import type { ProviderListItem } from '@familyco/ui';
import { computed } from 'vue';
import { CheckCircle2, CircleOff, Settings2 } from 'lucide-vue-next';

import { useI18n } from '../../../composables/useI18n';
import FcButton from '../../FcButton.vue';

const props = defineProps<{
  provider: ProviderListItem;
  isBusy: boolean;
}>();

const emit = defineEmits<{
  configure: [provider: ProviderListItem];
}>();

const { t } = useI18n();

const initials = computed(() =>
  props.provider.name
    .split(/\s+/u)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
);

const authTypesToText = (authTypes: string[]): string => {
  return authTypes
    .map((type) => {
      switch (type) {
        case 'apikey':
          return 'API Key';
        case 'oauth':
          return 'OAuth';
        default:
          return type.toUpperCase();
      }
    })
    .join(' / ');
};
</script>

<template>
  <article class="pcard" :class="{ 'pcard--primary': provider.isPrimary, 'pcard--connected': provider.connected }">
    <div class="pcard-header">
      <div class="pcard-logo" :data-provider="provider.logoId">
        <img :src="`assets/logo/` + provider.logoId + `.png`" :alt="provider.name" v-if="provider.logoId" />
      </div>
      <div class="pcard-copy">
        <div class="pcard-title-row">
          <h4>{{ provider.name }}</h4>
          <span v-if="provider.isPrimary" class="pcard-primary-badge">{{ t('provider.active') }}</span>
        </div>
        <p>{{ provider.description }}</p>
      </div>
    </div>

    <div class="pcard-status-row">
      <div class="pcard-status" :class="provider.connected ? 'pcard-status--connected' : 'pcard-status--disconnected'">
        <CheckCircle2 v-if="provider.connected" :size="14" />
        <CircleOff v-else :size="14" />
        <span>{{ provider.connected ? t('provider.connected') : t('provider.notConnected') }}</span>
      </div>
      <span v-if="provider.connectedAuthTypes.length > 0" class="pcard-methods">
        {{ authTypesToText(provider.connectedAuthTypes) }}
      </span>
    </div>

    <div class="pcard-footer">
      <FcButton variant="secondary" size="sm" :disabled="isBusy" @click="emit('configure', provider)">
        <Settings2 :size="12" />
        {{ t('provider.configure') }}
      </FcButton>
    </div>
  </article>
</template>

<style scoped>
.pcard {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 160px;
  padding: 14px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: 12px;
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--fc-accent) 10%, transparent), transparent 40%),
    var(--fc-surface);
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
}

.pcard--primary {
  border-color: color-mix(in srgb, var(--fc-accent) 42%, var(--fc-border-subtle));
}

.pcard--connected {
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.1);
}

.pcard-header {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.pcard-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--fc-accent) 16%, white);
  color: var(--fc-accent);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.pcard-copy {
  min-width: 0;
}

.pcard-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.pcard-title-row h4 {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--fc-text);
}

.pcard-copy p {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--fc-text-muted);
}

.pcard-primary-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 1px 6px;
  font-size: 0.64rem;
  font-weight: 700;
  color: var(--fc-accent);
  background: color-mix(in srgb, var(--fc-accent) 16%, transparent);
}

.pcard-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.pcard-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.pcard-status--connected {
  color: #15803d;
}

.pcard-status--disconnected {
  color: #b45309;
}

.pcard-methods {
  font-size: 0.65rem;
  color: var(--fc-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pcard-footer {
  margin-top: auto;
}
</style>
