<script setup lang="ts">
import type { AgentListItem } from '@familyco/ui';
import { Cpu, Save, Loader2, CheckCircle2 } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';

import { useI18n } from '../../composables/useI18n';
import { uiRuntime } from '../../runtime';
import { ADAPTER_OPTIONS, type AdapterId } from '../../constants/adapter-options';
import FcButton from '../FcButton.vue';
import FcSelect from '../FcSelect.vue';

const props = defineProps<{
  agent: AgentListItem;
}>();

const emit = defineEmits<{
  feedback: [type: 'success' | 'error', text: string];
}>();

const { t } = useI18n();

const draftAdapterId = ref<AdapterId | ''>('');
const draftModel = ref('');
const saving = ref(false);
const saved = ref(false);

const availableModels = computed<string[]>(() => {
  if (!draftAdapterId.value) return [];
  return ADAPTER_OPTIONS.find(a => a.value === draftAdapterId.value)?.models ?? [];
});

const hasOverride = computed(() => !!draftAdapterId.value);

const load = () => {
  const id = props.agent.aiAdapterId;
  draftAdapterId.value = (id === 'copilot' || id === 'openai' || id === 'claude') ? id : '';
  draftModel.value = props.agent.aiModel ?? '';
  saved.value = false;
};

watch(() => props.agent.id, load, { immediate: true });

const onAdapterChange = (newId: AdapterId | '') => {
  draftAdapterId.value = newId;
  if (newId) {
    const models = ADAPTER_OPTIONS.find(a => a.value === newId)?.models ?? [];
    if (!models.includes(draftModel.value)) draftModel.value = models[0] ?? '';
  } else {
    draftModel.value = '';
  }
  saved.value = false;
};

const save = async () => {
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
    saved.value = true;
    emit('feedback', 'success', 'AI configuration saved');
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

    <!-- Adapter selector -->
    <div class="aac-field">
      <label class="aac-label" for="aac-adapter">{{ t('AI adapter') }}</label>
      <FcSelect id="aac-adapter" :model-value="draftAdapterId" @update:model-value="onAdapterChange($event as AdapterId | '')">
        <option value="">{{ t('Default (system setting)') }}</option>
        <option v-for="opt in ADAPTER_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </FcSelect>
      <p class="aac-hint">{{ t('Agents without an override will use the system-level adapter.') }}</p>
    </div>

    <!-- Model selector (only when override is set) -->
    <div v-if="hasOverride" class="aac-field">
      <label class="aac-label" for="aac-model">{{ t('AI model') }}</label>
      <FcSelect id="aac-model" v-model="draftModel">
        <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
      </FcSelect>
    </div>

    <!-- Current override summary -->
    <div v-if="!isDirty && hasOverride" class="aac-current">
      <CheckCircle2 :size="12" />
      <span>{{ t('Override active') }}: {{ draftAdapterId }} / {{ draftModel }}</span>
    </div>

    <div class="aac-actions">
      <FcButton variant="primary" size="sm" :disabled="saving || !isDirty" @click="save">
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
