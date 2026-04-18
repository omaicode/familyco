<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import {
  Save, CheckCircle2, AlertTriangle
} from 'lucide-vue-next';
import FcButton from '../FcButton.vue';
import FcPasswordInput from '../FcPasswordInput.vue';
import FcSelect from '../FcSelect.vue';
import { uiRuntime } from '../../runtime';
import { useI18n } from '../../composables/useI18n';
import { ADAPTER_OPTIONS, getDefaultAdapterModel, normalizeAdapterModel, type AdapterId } from '../../constants/adapter-options';

const { t } = useI18n();

const emit = defineEmits<{
  feedback: [type: 'success' | 'error', text: string];
}>();

// ── Primary adapter state ─────────────────────────────────
const providerName = ref<AdapterId>('openai');
const providerModel = ref('gpt-5-mini');
const providerSaving = ref(false);
const providerTestResult = ref<{ ok: boolean; latencyMs?: number; error?: string } | null>(null);

const providerDraft = reactive<Record<AdapterId, { apiKey: string; model: string }>>({
  openai:  { apiKey: '', model: 'gpt-5-mini' },
  claude:  { apiKey: '', model: 'claude-sonnet-4-5' },
});

// ── Per-adapter API keys ───────────────────────────────────
const adapterKeys = reactive<Record<AdapterId, { key: string; saving: boolean; testing: boolean; testResult: { ok: boolean; latencyMs?: number; error?: string } | null }>>({
  openai:  { key: '', saving: false, testing: false, testResult: null },
  claude:  { key: '', saving: false, testing: false, testResult: null },
});

const selectedAdapter = computed(() => ADAPTER_OPTIONS.find(p => p.value === providerName.value)!);
const maskedKey = computed(() => {
  const k = providerDraft[providerName.value].apiKey;
  if (!k) return '';
  if (k.length <= 8) return '•'.repeat(k.length);
  return k.slice(0, 6) + '•'.repeat(Math.min(k.length - 8, 20)) + k.slice(-4);
});

const getSetting = (key: string): unknown =>
  uiRuntime.stores.settings.state.data.find(s => s.key === key)?.value;

// ── Load from settings ─────────────────────────────────────
const load = () => {
  const storedProvider = getSetting('provider.name');
  const normalised = storedProvider === 'anthropic' ? 'claude' : storedProvider;
  const activeAdapter: AdapterId =
    (normalised === 'openai' || normalised === 'claude')
      ? normalised
      : 'openai';

  const globalKey = typeof getSetting('provider.apiKey') === 'string' ? getSetting('provider.apiKey') as string : '';
  const loadedModel = typeof getSetting('provider.defaultModel') === 'string'
    ? getSetting('provider.defaultModel') as string
    : getDefaultAdapterModel(activeAdapter);
  const normalizedModel = normalizeAdapterModel(activeAdapter, loadedModel);

  providerDraft[activeAdapter] = { apiKey: globalKey, model: normalizedModel };
  providerName.value = activeAdapter;
  providerModel.value = normalizedModel;

  for (const adapter of ADAPTER_OPTIONS) {
    const perKey = getSetting(`provider.${adapter.value}.apiKey`);
    adapterKeys[adapter.value].key = typeof perKey === 'string' ? perKey : '';
    adapterKeys[adapter.value].testResult = null;
  }
};

defineExpose({ load });

// ── Adapter change ─────────────────────────────────────────
const onAdapterChange = (newAdapter: AdapterId) => {
  providerDraft[providerName.value] = {
    apiKey: providerDraft[providerName.value].apiKey,
    model: providerModel.value,
  };
  providerName.value = newAdapter;
  providerModel.value = providerDraft[newAdapter].model;
  providerTestResult.value = null;
};

// ── Save primary adapter ───────────────────────────────────
const savePrimaryAdapter = async () => {
  const apiKey = providerDraft[providerName.value].apiKey.trim();
  if (!apiKey) {
    emit('feedback', 'error', t('Connection failed'));
    return;
  }

  providerSaving.value = true;
  providerTestResult.value = null;

  try {
    const testResult = await uiRuntime.api.testProviderAdapter({
      adapterId: providerName.value,
      apiKey,
      model: providerModel.value,
    });

    providerTestResult.value = {
      ok: testResult.ok,
      latencyMs: testResult.latencyMs,
      error: testResult.error
    };

    if (!testResult.ok) {
      emit('feedback', 'error', testResult.error ?? t('Connection failed'));
      return;
    }

    await uiRuntime.api.upsertSetting({ key: 'provider.name', value: providerName.value });
    await uiRuntime.api.upsertSetting({ key: 'provider.apiKey', value: apiKey });
    await uiRuntime.api.upsertSetting({ key: 'provider.defaultModel', value: providerModel.value });
    await uiRuntime.stores.settings.load();
    emit('feedback', 'success', 'Provider settings saved');
  } catch (err) {
    providerTestResult.value = { ok: false, error: err instanceof Error ? err.message : 'Connection test failed' };
    emit('feedback', 'error', err instanceof Error ? err.message : 'Failed to save provider settings');
  } finally {
    providerSaving.value = false;
  }
};

// ── Save per-adapter key ───────────────────────────────────
const saveAdapterKey = async (adapterId: AdapterId) => {
  const apiKey = adapterKeys[adapterId].key.trim();
  if (!apiKey) {
    emit('feedback', 'error', t('Connection failed'));
    return;
  }

  adapterKeys[adapterId].saving = true;
  adapterKeys[adapterId].testing = true;

  try {
    const model = getDefaultAdapterModel(adapterId);
    const testResult = await uiRuntime.api.testProviderAdapter({ adapterId, apiKey, model });

    adapterKeys[adapterId].testResult = {
      ok: testResult.ok,
      latencyMs: testResult.latencyMs,
      error: testResult.error
    };

    if (!testResult.ok) {
      emit('feedback', 'error', testResult.error ?? t('Connection failed'));
      return;
    }

    await uiRuntime.api.upsertSetting({ key: `provider.${adapterId}.apiKey`, value: apiKey });
    await uiRuntime.stores.settings.load();
    emit('feedback', 'success', `${ADAPTER_OPTIONS.find(a => a.value === adapterId)!.label} API key saved`);
  } catch (err) {
    adapterKeys[adapterId].testResult = { ok: false, error: err instanceof Error ? err.message : 'Connection test failed' };
    emit('feedback', 'error', err instanceof Error ? err.message : 'Failed to save API key');
  } finally {
    adapterKeys[adapterId].testing = false;
    adapterKeys[adapterId].saving = false;
  }
};

watch(() => uiRuntime.stores.settings.state.data, load, { immediate: true });
</script>

<template>
  <!-- Primary adapter -->
  <div class="pss-pane-header">
    <div>
      <h4>{{ t('AI adapter') }}</h4>
      <p>{{ t('Override for this agent') }}</p>
    </div>
  </div>

  <div class="pss-field-group">
    <label class="pss-label">{{ t('AI adapter') }}</label>
    <div class="pss-adapter-grid">
      <button
        v-for="opt in ADAPTER_OPTIONS"
        :key="opt.value"
        class="pss-adapter-btn"
        :class="{ 'pss-adapter-selected': providerName === opt.value }"
        @click="onAdapterChange(opt.value)"
      >
        <span class="pss-adapter-name">{{ opt.label }}</span>
        <span class="pss-adapter-hint">{{ opt.keyHint }}</span>
      </button>
    </div>
  </div>

  <div class="pss-field-group">
    <label class="pss-label" for="pss-model">{{ t('AI model') }}</label>
    <FcSelect id="pss-model" v-model="providerModel">
      <option v-for="m in selectedAdapter.models" :key="m" :value="m">{{ m }}</option>
    </FcSelect>
  </div>

  <div class="pss-field-group">
    <label class="pss-label" for="pss-apikey">
      {{ t('API Key') }}
      <span v-if="providerDraft[providerName].apiKey" class="pss-badge pss-badge-success">Saved</span>
    </label>
    <FcPasswordInput
      id="pss-apikey"
      v-model="providerDraft[providerName].apiKey"
      :placeholder="selectedAdapter.keyHint"
      @input="providerTestResult = null"
    />
    <p v-if="maskedKey" class="pss-hint">{{ maskedKey }}</p>
    <p class="pss-hint">{{ t('Stored locally in your workspace database. Never logged or sent externally.') }}</p>
  </div>

  <div v-if="providerTestResult" class="pss-test-result" :class="providerTestResult.ok ? 'pss-test-ok' : 'pss-test-fail'">
    <CheckCircle2 v-if="providerTestResult.ok" :size="13" />
    <AlertTriangle v-else :size="13" />
    <span v-if="providerTestResult.ok">
      {{ t('API key is valid and connection is live.') }}
      <span v-if="providerTestResult.latencyMs" class="pss-test-latency">{{ providerTestResult.latencyMs }}{{ t('ms') }}</span>
    </span>
    <span v-else>{{ providerTestResult.error ?? t('Connection failed') }}</span>
  </div>

  <div class="pss-actions">
    <FcButton variant="primary" size="sm" :disabled="providerSaving || !providerDraft[providerName].apiKey" @click="savePrimaryAdapter">
      <Save :size="13" />
      {{ providerSaving ? t('Saving…') : t('Save provider settings') }}
    </FcButton>
  </div>

  <!-- Per-adapter API keys -->
  <div class="pss-divider" />

  <div class="pss-pane-header">
    <div>
      <h4>{{ t('Per-adapter API keys') }}</h4>
      <p>{{ t('Configure an API key for each adapter you want to use. Agents with an adapter override will use the matching key.') }}</p>
    </div>
  </div>

  <div v-for="adapter in ADAPTER_OPTIONS" :key="adapter.value" class="pss-field-group">
    <label class="pss-label" :for="`pss-key-${adapter.value}`">
      {{ adapter.label }}
      <span v-if="adapterKeys[adapter.value].key" class="pss-badge pss-badge-success">Saved</span>
    </label>
    <div class="pss-inline-row">
      <FcPasswordInput
        :id="`pss-key-${adapter.value}`"
        v-model="adapterKeys[adapter.value].key"
        :placeholder="adapter.keyHint"
        @input="adapterKeys[adapter.value].testResult = null"
      />
      <FcButton variant="ghost" size="sm" :disabled="adapterKeys[adapter.value].saving || adapterKeys[adapter.value].testing || !adapterKeys[adapter.value].key.trim()" @click="saveAdapterKey(adapter.value)">
        <Save :size="12" />
        {{ adapterKeys[adapter.value].saving || adapterKeys[adapter.value].testing ? t('Saving…') : t('Save') }}
      </FcButton>
    </div>
    <div v-if="adapterKeys[adapter.value].testResult" class="pss-test-result" :class="adapterKeys[adapter.value].testResult!.ok ? 'pss-test-ok' : 'pss-test-fail'">
      <CheckCircle2 v-if="adapterKeys[adapter.value].testResult!.ok" :size="12" />
      <AlertTriangle v-else :size="12" />
      <span v-if="adapterKeys[adapter.value].testResult!.ok">
        {{ t('API key is valid and connection is live.') }}
        <span v-if="adapterKeys[adapter.value].testResult!.latencyMs" class="pss-test-latency">{{ adapterKeys[adapter.value].testResult!.latencyMs }}{{ t('ms') }}</span>
      </span>
      <span v-else>{{ adapterKeys[adapter.value].testResult!.error ?? t('Connection failed') }}</span>
    </div>
  </div>
</template>

<style scoped>
.pss-pane-header {
  margin-bottom: 20px;
}
.pss-pane-header h4 {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--fc-text);
  margin: 0 0 4px;
}
.pss-pane-header p {
  font-size: 0.8125rem;
  color: var(--fc-text-muted);
  margin: 0;
}

.pss-field-group {
  margin-bottom: 20px;
}
.pss-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--fc-text);
  margin-bottom: 8px;
}
.pss-hint {
  font-size: 0.75rem;
  color: var(--fc-text-muted);
  margin: 6px 0 0;
}

.pss-adapter-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.pss-adapter-btn {
  display: flex;
  flex-direction: column;
  padding: 10px 14px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: 8px;
  background: var(--fc-surface);
  cursor: pointer;
  text-align: left;
  min-width: 130px;
  transition: border-color 0.15s;
}
.pss-adapter-btn:hover { border-color: var(--fc-border); }
.pss-adapter-selected { border-color: var(--fc-accent) !important; background: color-mix(in srgb, var(--fc-accent) 8%, transparent); }
.pss-adapter-name { font-size: 0.8125rem; font-weight: 600; color: var(--fc-text); }
.pss-adapter-hint { font-size: 0.71rem; color: var(--fc-text-muted); font-family: monospace; margin-top: 2px; }

.pss-badge {
  font-size: 0.68rem;
  padding: 1px 7px;
  border-radius: 9999px;
  font-weight: 500;
}
.pss-badge-success { background: color-mix(in srgb, #22c55e 15%, transparent); color: #16a34a; }

.pss-actions { margin-top: 8px; display: flex; gap: 8px; }

.pss-divider {
  border: none;
  border-top: 1px solid var(--fc-border-subtle);
  margin: 28px 0;
}

.pss-inline-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.pss-inline-row > :first-child { flex: 1; }

.pss-test-result {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 6px 11px;
  border-radius: 7px;
  font-size: 12px;
}
.pss-test-ok { background: color-mix(in srgb, #22c55e 12%, transparent); color: #16a34a; }
.pss-test-fail { background: color-mix(in srgb, #ef4444 12%, transparent); color: #dc2626; }
.pss-test-latency { margin-left: 5px; opacity: 0.65; font-size: 10.5px; }
</style>
