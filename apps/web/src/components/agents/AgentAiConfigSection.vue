<script setup lang="ts">
import type { AgentListItem, ProviderListItem } from '@familyco/ui';
import { Cpu, Save, Loader2, CheckCircle2, AlertTriangle } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import { useI18n } from '../../composables/useI18n';
import { uiRuntime } from '../../runtime';
import { useProviders } from '../../composables/useProviders';
import FcButton from '../FcButton.vue';
import FcSelect from '../FcSelect.vue';

const props = defineProps<{
  agent: AgentListItem;
}>();

const emit = defineEmits<{
  feedback: [type: 'success' | 'error', text: string];
}>();

const { t } = useI18n();
const { providers, loading, loadProviders } = useProviders();

const draftAdapterId = ref('');
const draftModel = ref('');
const saving = ref(false);
const saved = ref(false);

const selectedProvider = computed<ProviderListItem | null>(() =>
  providers.value.find((provider) => provider.id === draftAdapterId.value) ?? null
);

const availableModels = computed<string[]>(() => {
  return selectedProvider.value?.availableModels ?? [];
});

const selectableProviders = computed<ProviderListItem[]>(() => {
  const currentOverrideId = props.agent.aiAdapterId ?? '';
  return providers.value.filter((provider) => provider.connected || provider.id === currentOverrideId);
});

const systemProvider = computed<ProviderListItem | null>(() =>
  providers.value.find((provider) => provider.isPrimary) ?? null
);

const hasOverride = computed(() => !!draftAdapterId.value);
const hasConnectedProviders = computed(() => providers.value.some((provider) => provider.connected));
const selectedProviderConnected = computed(() => !draftAdapterId.value || selectedProvider.value?.connected === true);

const syncDraftFromAgent = () => {
  draftAdapterId.value = props.agent.aiAdapterId?.trim() ?? '';

  if (!draftAdapterId.value) {
    draftModel.value = '';
    saved.value = false;
    return;
  }

  const provider = providers.value.find((item) => item.id === draftAdapterId.value) ?? null;
  const requestedModel = props.agent.aiModel?.trim() ?? '';
  if (!provider) {
    draftModel.value = requestedModel;
    saved.value = false;
    return;
  }

  draftModel.value =
    (requestedModel && provider.availableModels.includes(requestedModel) ? requestedModel : '') ||
    provider.currentModel ||
    provider.defaultModel ||
    provider.availableModels[0] ||
    '';
  saved.value = false;
};

const load = async () => {
  await loadProviders();
  syncDraftFromAgent();
};

watch(() => props.agent.id, () => {
  void load();
}, { immediate: true });

watch(() => [props.agent.aiAdapterId, props.agent.aiModel], () => {
  syncDraftFromAgent();
});

const onAdapterChange = (newId: string) => {
  draftAdapterId.value = newId;
  if (!newId) {
    draftModel.value = '';
    saved.value = false;
    return;
  }

  const provider = providers.value.find((item) => item.id === newId) ?? null;
  const nextModel = provider?.currentModel || provider?.defaultModel || provider?.availableModels[0] || '';
  if (!availableModels.value.includes(draftModel.value)) {
    draftModel.value = nextModel;
  }

  saved.value = false;
};

const save = async () => {
  if (draftAdapterId.value && !selectedProviderConnected.value) {
    emit('feedback', 'error', t('agent.ai.disconnectedOverride'));
    return;
  }

  saving.value = true;
  try {
    await uiRuntime.api.updateAgent({
      agentId: props.agent.id,
      name: props.agent.name,
      role: props.agent.role,
      department: props.agent.department,
      status: props.agent.status,
      aiAdapterId: draftAdapterId.value || null,
      aiModel: draftAdapterId.value ? (draftModel.value || null) : null,
    });
    await uiRuntime.stores.agents.loadAgents();
    await loadProviders();
    saved.value = true;
    emit('feedback', 'success', t('agent.ai.configurationSaved'));
    setTimeout(() => { saved.value = false; }, 2500);
  } catch (err) {
    emit('feedback', 'error', err instanceof Error ? err.message : 'Failed to save AI configuration');
  } finally {
    saving.value = false;
  }
};

const isDirty = computed(() => {
  const origAdapterId = props.agent.aiAdapterId ?? '';
  const origModel = props.agent.aiModel ?? '';
  return draftAdapterId.value !== origAdapterId || draftModel.value !== origModel;
});

const defaultOptionLabel = computed(() => {
  if (!systemProvider.value) {
    return t('Default (system setting)');
  }

  return `${t('Default (system setting)')} - ${systemProvider.value.name} / ${systemProvider.value.currentModel}`;
});
</script>

<template>
  <div class="aac-root">
    <div class="aac-header">
      <Cpu :size="14" class="aac-icon" />
      <div>
        <h5>{{ t('AI configuration') }}</h5>
        <p>{{ t('Override the system AI adapter for this agent. Leave blank to use the default.') }}</p>
      </div>
    </div>

    <div v-if="systemProvider" class="aac-current aac-current--system">
      <CheckCircle2 :size="12" />
      <span>{{ t('agent.ai.defaultSummary', { provider: systemProvider.name, model: systemProvider.currentModel }) }}</span>
    </div>
    <div v-else class="aac-warning">
      <AlertTriangle :size="12" />
      <span>{{ t('agent.ai.noSystemProvider') }}</span>
    </div>

    <div v-if="!hasConnectedProviders && !loading" class="aac-warning">
      <AlertTriangle :size="12" />
      <span>{{ t('agent.ai.connectedOnlyHint') }}</span>
    </div>

    <!-- Adapter selector -->
    <div class="aac-field">
      <label class="aac-label" for="aac-adapter">{{ t('AI adapter') }}</label>
      <FcSelect id="aac-adapter" :model-value="draftAdapterId" :disabled="loading" @update:model-value="onAdapterChange(String($event ?? ''))">
        <option value="">{{ defaultOptionLabel }}</option>
        <option v-for="provider in selectableProviders" :key="provider.id" :value="provider.id">
          {{ provider.name }}{{ provider.isPrimary ? ` • ${t('provider.active')}` : '' }}
        </option>
      </FcSelect>
      <p class="aac-hint">{{ t('agent.ai.connectedOnlyHint') }}</p>
    </div>

    <!-- Model selector (only when override is set) -->
    <div v-if="hasOverride" class="aac-field">
      <label class="aac-label" for="aac-model">{{ t('AI model') }}</label>
      <FcSelect id="aac-model" v-model="draftModel" :disabled="loading || !selectedProviderConnected">
        <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
      </FcSelect>
      <p v-if="selectedProvider" class="aac-hint">
        {{ t('agent.ai.overrideSummary', { provider: selectedProvider.name, model: selectedProvider.currentModel }) }}
      </p>
    </div>

    <div v-if="hasOverride && !selectedProviderConnected" class="aac-warning">
      <AlertTriangle :size="12" />
      <span>{{ t('agent.ai.disconnectedOverride') }}</span>
    </div>

    <!-- Current override summary -->
    <div v-if="!isDirty && hasOverride && selectedProvider" class="aac-current">
      <CheckCircle2 :size="12" />
      <span>{{ t('agent.ai.overrideSummary', { provider: selectedProvider.name, model: draftModel }) }}</span>
    </div>

    <div class="aac-actions">
      <FcButton variant="primary" size="sm" :disabled="saving || loading || !isDirty || (hasOverride && !selectedProviderConnected)" @click="save">
        <Loader2 v-if="saving" :size="12" class="aac-spin" />
        <Save v-else :size="12" />
        {{ saving ? t('Saving…') : t('Save AI config') }}
      </FcButton>
      <span v-if="saved" class="aac-saved-badge">
        <CheckCircle2 :size="11" />{{ t('Saved') }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.aac-root {
  padding: 2px 0;
}
.aac-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 20px;
}
.aac-icon {
  color: var(--fc-accent);
  flex-shrink: 0;
  margin-top: 2px;
}
.aac-header h5 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--fc-text);
  margin: 0 0 3px;
}
.aac-header p {
  font-size: 0.78125rem;
  color: var(--fc-text-muted);
  margin: 0;
}

.aac-field {
  margin-bottom: 16px;
}
.aac-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--fc-text);
  margin-bottom: 7px;
}
.aac-hint {
  font-size: 0.75rem;
  color: var(--fc-text-muted);
  margin: 5px 0 0;
}

.aac-current {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: #16a34a;
  background: color-mix(in srgb, #22c55e 12%, transparent);
  padding: 4px 10px;
  border-radius: 6px;
  margin-bottom: 14px;
}

.aac-current--system {
  color: var(--fc-accent);
  background: color-mix(in srgb, var(--fc-accent) 12%, transparent);
}

.aac-warning {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 14px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  color: #b45309;
  background: color-mix(in srgb, #f59e0b 12%, transparent);
}

.aac-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}
.aac-saved-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: #16a34a;
}

@keyframes aac-spin { to { transform: rotate(360deg); } }
.aac-spin { animation: aac-spin 0.8s linear infinite; }
</style>
