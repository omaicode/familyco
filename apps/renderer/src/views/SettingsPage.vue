<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import {
  Sun, Moon, Monitor, Save, RefreshCw,
  Key, Palette, Database, ChevronRight,
  Building2, Wallet, Cpu,
} from 'lucide-vue-next';

import { applyRuntimeTheme, uiRuntime } from '../runtime';
import { useAutoReload } from '../composables/useAutoReload';
import FcBanner from '../components/FcBanner.vue';
import FcButton from '../components/FcButton.vue';
import FcPasswordInput from '../components/FcPasswordInput.vue';
import FcSelect from '../components/FcSelect.vue';

// ── Types ─────────────────────────────────────────────────
type ThemePreference = 'system' | 'light' | 'dark';
type Provider = 'openai' | 'anthropic' | 'google';
type Section = 'company' | 'budget' | 'agents' | 'provider' | 'appearance' | 'advanced';

// ── State ─────────────────────────────────────────────────
const activeSection = ref<Section>('company');
const feedback = ref<{ type: 'success' | 'error'; text: string } | null>(null);

// ── Company form ─────────────────────────────────────
const companyName = ref('');
const companyGoal = ref('');
const companyTimezone = ref('Asia/Ho_Chi_Minh');
const companySaving = ref(false);

// ── Budget form ──────────────────────────────────────
const budgetMonthlyLimitUSD = ref(0);
const budgetEnforceMode = ref<'warn' | 'block'>('warn');
const budgetAlertThreshold = ref(80);
const budgetSaving = ref(false);

// ── Agents defaults form ──────────────────────────────
const agentHeartbeatMinutes = ref('60');
const agentDefaultApprovalMode = ref<'auto' | 'suggest' | 'review'>('suggest');
const agentsSaving = ref(false);


// ── Provider form ─────────────────────────────────────────
const providerName = ref<Provider>('openai');
const providerApiKey = ref('');
const providerModel = ref('gpt-4o');
const providerSaving = ref(false);

// Per-provider form cache (so switching back restores entered data)
const providerDraft = reactive<Record<Provider, { apiKey: string; model: string }>>({  
  openai:    { apiKey: '', model: 'gpt-4o' },
  anthropic: { apiKey: '', model: 'claude-sonnet-4-5' },
  google:    { apiKey: '', model: 'gemini-2.5-pro' },
});

// ── Appearance ────────────────────────────────────────────
const themePreference = ref<ThemePreference>('system');
const themeSaving = ref(false);

// ── Helpers ───────────────────────────────────────────────
interface ProviderOption { value: Provider; label: string; models: string[]; keyHint: string; }
const providerOptions: ProviderOption[] = [
  { value: 'openai',    label: 'OpenAI',      models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1'],                       keyHint: 'sk-…' },
  { value: 'anthropic', label: 'Anthropic',   models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5'],      keyHint: 'sk-ant-…' },
  { value: 'google',    label: 'Google AI',   models: ['gemini-2.5-pro', 'gemini-2.5-flash'],                            keyHint: 'AIza…' },
];
const selectedProvider = computed(() => providerOptions.find(p => p.value === providerName.value)!);

const parseThemePreference = (v: unknown): ThemePreference | null =>
  (v === 'system' || v === 'light' || v === 'dark') ? v : null;

const getSetting = (key: string): unknown =>
  uiRuntime.stores.settings.state.data.find(s => s.key === key)?.value;

const setFeedback = (type: 'success' | 'error', text: string) => {
  feedback.value = { type, text };
  setTimeout(() => { if (feedback.value?.text === text) feedback.value = null; }, 4000);
};

// ── Load ──────────────────────────────────────────────────
const reload = async () => {
  feedback.value = null;
  await uiRuntime.stores.settings.load();

  const storedProvider = getSetting('provider.name');
  const activeProvider: Provider =
    (storedProvider === 'openai' || storedProvider === 'anthropic' || storedProvider === 'google')
      ? storedProvider
      : 'openai';

  const loadedApiKey = typeof getSetting('provider.apiKey') === 'string' ? getSetting('provider.apiKey') as string : '';
  const loadedModel  = typeof getSetting('provider.defaultModel') === 'string' ? getSetting('provider.defaultModel') as string : providerOptions.find(p => p.value === activeProvider)!.models[0];

  // Persist loaded values into the per-provider draft so switching away and back doesn't lose them
  providerDraft[activeProvider] = { apiKey: loadedApiKey, model: loadedModel };

  providerName.value    = activeProvider;
  providerApiKey.value  = loadedApiKey;
  providerModel.value   = loadedModel;

  themePreference.value = parseThemePreference(getSetting('ui.theme.preference')) ?? 'system';
  applyTheme(themePreference.value);

  // Company
  companyName.value     = typeof getSetting('company.name') === 'string' ? getSetting('company.name') as string : '';
  companyGoal.value     = typeof getSetting('company.goal') === 'string' ? getSetting('company.goal') as string : '';
  companyTimezone.value = typeof getSetting('company.timezone') === 'string' ? getSetting('company.timezone') as string : 'Asia/Ho_Chi_Minh';

  // Budget
  const rawLimit = getSetting('budget.monthlyLimitUSD');
  budgetMonthlyLimitUSD.value = typeof rawLimit === 'number' ? rawLimit : (rawLimit ? Number(rawLimit) : 0);
  const rawMode = getSetting('budget.enforceMode');
  budgetEnforceMode.value = (rawMode === 'block') ? 'block' : 'warn';
  const rawThresh = getSetting('budget.alertThresholdPercent');
  budgetAlertThreshold.value = typeof rawThresh === 'number' ? rawThresh : (rawThresh ? Number(rawThresh) : 80);

  // Agent defaults
  const rawHb = getSetting('agent.defaultHeartbeatMinutes');
  agentHeartbeatMinutes.value = String(typeof rawHb === 'number' ? rawHb : (rawHb ? Number(rawHb) : 60));
  const rawMode2 = getSetting('agent.defaultApprovalMode');
  agentDefaultApprovalMode.value = (rawMode2 === 'auto' || rawMode2 === 'review') ? rawMode2 : 'suggest';
};

// ── Apply theme ───────────────────────────────────────────
const applyTheme = (pref: ThemePreference) => {
  const dark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  uiRuntime.stores.app.applyThemePreference(pref, dark);
  applyRuntimeTheme();
};

// ── Save: provider ────────────────────────────────────────
const saveProvider = async () => {
  providerSaving.value = true;
  feedback.value = null;
  try {
    await uiRuntime.api.upsertSetting({ key: 'provider.name', value: providerName.value });
    await uiRuntime.api.upsertSetting({ key: 'provider.apiKey', value: providerApiKey.value });
    await uiRuntime.api.upsertSetting({ key: 'provider.defaultModel', value: providerModel.value });
    await uiRuntime.stores.settings.load();
    setFeedback('success', 'Provider settings saved');
  } catch (err) {
    setFeedback('error', err instanceof Error ? err.message : 'Failed to save provider settings');
  } finally {
    providerSaving.value = false;
  }
};

// ── Save: appearance ──────────────────────────────────────
const saveTheme = async () => {
  themeSaving.value = true;
  feedback.value = null;
  try {
    applyTheme(themePreference.value);
    await uiRuntime.api.upsertSetting({ key: 'ui.theme.preference', value: themePreference.value });
    await uiRuntime.stores.settings.load();
    setFeedback('success', 'Appearance saved');
  } catch (err) {
    setFeedback('error', err instanceof Error ? err.message : 'Failed to save appearance');
  } finally {
    themeSaving.value = false;
  }
};

// ── Save: company ─────────────────────────────────────────
const saveCompany = async () => {
  companySaving.value = true;
  feedback.value = null;
  try {
    await uiRuntime.api.upsertSetting({ key: 'company.name',     value: companyName.value.trim() });
    await uiRuntime.api.upsertSetting({ key: 'company.goal',     value: companyGoal.value.trim() });
    await uiRuntime.api.upsertSetting({ key: 'company.timezone', value: companyTimezone.value });
    await uiRuntime.stores.settings.load();
    setFeedback('success', 'Company settings saved');
  } catch (err) {
    setFeedback('error', err instanceof Error ? err.message : 'Failed to save company settings');
  } finally {
    companySaving.value = false;
  }
};

// ── Save: budget ──────────────────────────────────────────
const saveBudget = async () => {
  budgetSaving.value = true;
  feedback.value = null;
  try {
    await uiRuntime.api.upsertSetting({ key: 'budget.monthlyLimitUSD',      value: budgetMonthlyLimitUSD.value });
    await uiRuntime.api.upsertSetting({ key: 'budget.enforceMode',          value: budgetEnforceMode.value });
    await uiRuntime.api.upsertSetting({ key: 'budget.alertThresholdPercent', value: budgetAlertThreshold.value });
    await uiRuntime.stores.settings.load();
    setFeedback('success', 'Budget settings saved');
  } catch (err) {
    setFeedback('error', err instanceof Error ? err.message : 'Failed to save budget settings');
  } finally {
    budgetSaving.value = false;
  }
};

// ── Save: agents defaults ─────────────────────────────────
const saveAgents = async () => {
  agentsSaving.value = true;
  feedback.value = null;
  try {
    await uiRuntime.api.upsertSetting({ key: 'agent.defaultHeartbeatMinutes', value: Number(agentHeartbeatMinutes.value) });
    await uiRuntime.api.upsertSetting({ key: 'agent.defaultApprovalMode',     value: agentDefaultApprovalMode.value });
    await uiRuntime.stores.settings.load();
    setFeedback('success', 'Agent defaults saved');
  } catch (err) {
    setFeedback('error', err instanceof Error ? err.message : 'Failed to save agent defaults');
  } finally {
    agentsSaving.value = false;
  }
};

// ── Provider change ───────────────────────────────────────
const onProviderChange = (newProvider: Provider) => {
  // Save current values into the draft cache before switching
  providerDraft[providerName.value] = {
    apiKey: providerApiKey.value,
    model:  providerModel.value,
  };
  // Restore draft for the new provider
  providerName.value   = newProvider;
  providerApiKey.value = providerDraft[newProvider].apiKey;
  providerModel.value  = providerDraft[newProvider].model;
};

// ── Masked key display ────────────────────────────────────
const maskedKey = computed(() => {
  const k = providerApiKey.value;
  if (!k) return '';
  if (k.length <= 8) return '•'.repeat(k.length);
  return k.slice(0, 6) + '•'.repeat(Math.min(k.length - 8, 20)) + k.slice(-4);
});

// ── Advanced: visible settings (hide secrets) ─────────────
const visibleSettings = computed(() =>
  uiRuntime.stores.settings.state.data.filter(s => s.key !== 'provider.apiKey')
);

useAutoReload(reload);
</script>

<template>
  <section>
    <!-- ── Header ──────────────────────────────────── -->
    <div class="fc-page-header">
      <div>
        <h3>Settings</h3>
        <p>Configure AI provider, appearance, and workspace preferences.</p>
      </div>
      <button class="fc-btn-secondary" :disabled="providerSaving || themeSaving" @click="reload">
        <RefreshCw :size="14" />
        Refresh
      </button>
    </div>

    <!-- ── Feedback ─────────────────────────────────── -->
    <Transition name="fc-banner">
      <FcBanner
        v-if="feedback"
        :type="feedback.type"
        closable
        style="margin-bottom:14px;"
        @close="feedback = null"
      >
        {{ feedback.text }}
      </FcBanner>
    </Transition>

    <!-- ── 2-column layout ─────────────────────────── -->
    <div class="st-layout">

      <!-- ── Category sidebar ──────────────────────── -->
      <nav class="st-nav" aria-label="Settings categories">
        <button
          class="st-nav-item"
          :class="{ 'st-nav-item-active': activeSection === 'company' }"
          @click="activeSection = 'company'"
        >
          <Building2 :size="15" class="st-nav-icon" />
          <span>Company</span>
          <ChevronRight :size="13" class="st-nav-chevron" />
        </button>
        <button
          class="st-nav-item"
          :class="{ 'st-nav-item-active': activeSection === 'budget' }"
          @click="activeSection = 'budget'"
        >
          <Wallet :size="15" class="st-nav-icon" />
          <span>Budget</span>
          <ChevronRight :size="13" class="st-nav-chevron" />
        </button>
        <button
          class="st-nav-item"
          :class="{ 'st-nav-item-active': activeSection === 'agents' }"
          @click="activeSection = 'agents'"
        >
          <Cpu :size="15" class="st-nav-icon" />
          <span>Agent Defaults</span>
          <ChevronRight :size="13" class="st-nav-chevron" />
        </button>
        <button
          class="st-nav-item"
          :class="{ 'st-nav-item-active': activeSection === 'provider' }"
          @click="activeSection = 'provider'"
        >
          <Key :size="15" class="st-nav-icon" />
          <span>AI Provider</span>
          <ChevronRight :size="13" class="st-nav-chevron" />
        </button>
        <button
          class="st-nav-item"
          :class="{ 'st-nav-item-active': activeSection === 'appearance' }"
          @click="activeSection = 'appearance'"
        >
          <Palette :size="15" class="st-nav-icon" />
          <span>Appearance</span>
          <ChevronRight :size="13" class="st-nav-chevron" />
        </button>
        <button
          class="st-nav-item"
          :class="{ 'st-nav-item-active': activeSection === 'advanced' }"
          @click="activeSection = 'advanced'"
        >
          <Database :size="15" class="st-nav-icon" />
          <span>Advanced</span>
          <ChevronRight :size="13" class="st-nav-chevron" />
        </button>
      </nav>

      <!-- ── Pane ──────────────────────────────────── -->
      <div class="st-pane">
        <Transition name="st-section" mode="out-in">

          <!-- ── Company ───────────────────────────── -->
          <div v-if="activeSection === 'company'" key="company">
            <div class="st-pane-header">
              <Building2 :size="16" class="st-pane-icon" />
              <div>
                <h4>Company</h4>
                <p>Define your company's identity and mission. Agents use this as their north star when reasoning about work.</p>
              </div>
            </div>

            <div class="st-field-group">
              <label class="st-label" for="st-company-name">Company name</label>
              <FcInput id="st-company-name" v-model="companyName" placeholder="e.g. Acme Corp" />
            </div>

            <div class="st-field-group">
              <label class="st-label" for="st-company-goal">Company goal</label>
              <textarea
                id="st-company-goal"
                v-model="companyGoal"
                class="fc-textarea"
                rows="4"
                placeholder="e.g. Build the #1 AI-powered accounting platform with $1M ARR by Q4 2026."
              />
              <p class="st-hint" style="font-family:inherit;letter-spacing:normal;">The reason the company exists. Injected into every agent's context as mission context.</p>
            </div>

            <div class="st-field-group">
              <label class="st-label" for="st-company-tz">Timezone</label>
              <FcSelect id="st-company-tz" v-model="companyTimezone">
                <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (UTC+7)</option>
                <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
                <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                <option value="UTC">UTC</option>
              </FcSelect>
              <p class="st-hint" style="font-family:inherit;letter-spacing:normal;">Used for scheduling heartbeats and displaying timestamps.</p>
            </div>

            <div class="st-actions">
              <FcButton variant="primary" size="sm" :disabled="companySaving" @click="saveCompany">
                <Save :size="13" />
                {{ companySaving ? 'Saving…' : 'Save company settings' }}
              </FcButton>
            </div>
          </div>

          <!-- ── Budget ────────────────────────────── -->
          <div v-else-if="activeSection === 'budget'" key="budget">
            <div class="st-pane-header">
              <Wallet :size="16" class="st-pane-icon" />
              <div>
                <h4>Budget</h4>
                <p>Control AI spend across all agents. Set monthly limits and decide what happens when the budget is exhausted.</p>
              </div>
            </div>

            <div class="st-field-group">
              <label class="st-label" for="st-budget-limit">Monthly limit (USD)</label>
              <div class="st-currency-wrap">
                <span class="st-currency-prefix">$</span>
                <input
                  id="st-budget-limit"
                  v-model.number="budgetMonthlyLimitUSD"
                  type="number"
                  min="0"
                  step="10"
                  class="fc-input st-currency-input"
                  placeholder="0"
                />
              </div>
              <p class="st-hint" style="font-family:inherit;letter-spacing:normal;">Set to 0 to disable budget enforcement. Applied company-wide across all agents.</p>
            </div>

            <div class="st-field-group">
              <label class="st-label">Alert threshold</label>
              <div class="st-radio-row">
                <label
                  v-for="pct in [50, 75, 90]"
                  :key="pct"
                  class="st-radio-opt"
                  :class="{ 'st-radio-opt-active': budgetAlertThreshold === pct }"
                >
                  <input v-model.number="budgetAlertThreshold" type="radio" :value="pct" class="sr-only" />
                  {{ pct }}%
                </label>
              </div>
              <p class="st-hint" style="font-family:inherit;letter-spacing:normal;">Send an alert notification when this percentage of the monthly budget is consumed.</p>
            </div>

            <div class="st-field-group">
              <label class="st-label">Enforcement mode</label>
              <div class="st-radio-row">
                <label class="st-radio-opt" :class="{ 'st-radio-opt-active': budgetEnforceMode === 'warn' }">
                  <input v-model="budgetEnforceMode" type="radio" value="warn" class="sr-only" />
                  Warn only
                </label>
                <label class="st-radio-opt" :class="{ 'st-radio-opt-active': budgetEnforceMode === 'block' }">
                  <input v-model="budgetEnforceMode" type="radio" value="block" class="sr-only" />
                  Block agents
                </label>
              </div>
              <p class="st-hint" style="font-family:inherit;letter-spacing:normal;">
                <strong>Warn only</strong> — agents keep running, an alert is sent to the inbox.<br />
                <strong>Block agents</strong> — all agent heartbeats are paused until reset.
              </p>
            </div>

            <div class="st-actions">
              <FcButton variant="primary" size="sm" :disabled="budgetSaving" @click="saveBudget">
                <Save :size="13" />
                {{ budgetSaving ? 'Saving…' : 'Save budget settings' }}
              </FcButton>
            </div>
          </div>

          <!-- ── Agent Defaults ────────────────────── -->
          <div v-else-if="activeSection === 'agents'" key="agents">
            <div class="st-pane-header">
              <Cpu :size="16" class="st-pane-icon" />
              <div>
                <h4>Agent Defaults</h4>
                <p>Default values applied when creating new agents. Individual agents can override these.</p>
              </div>
            </div>

            <div class="st-field-group">
              <label class="st-label" for="st-heartbeat">Heartbeat interval</label>
              <FcSelect id="st-heartbeat" v-model="agentHeartbeatMinutes">
                <option value="15">Every 15 minutes</option>
                <option value="30">Every 30 minutes</option>
                <option value="60">Every hour</option>
                <option value="120">Every 2 hours</option>
                <option value="240">Every 4 hours</option>
                <option value="480">Every 8 hours</option>
                <option value="1440">Once a day</option>
              </FcSelect>
              <p class="st-hint" style="font-family:inherit;letter-spacing:normal;">How often agents wake up to check for tasks and do work. More frequent = higher cost.</p>
            </div>

            <div class="st-field-group">
              <label class="st-label">Default approval mode</label>
              <div class="st-approval-grid">
                <label
                  class="st-approval-opt"
                  :class="{ 'st-approval-opt-active': agentDefaultApprovalMode === 'auto' }"
                >
                  <input v-model="agentDefaultApprovalMode" type="radio" value="auto" class="sr-only" />
                  <strong>Auto</strong>
                  <span>All actions execute immediately without review. Best for L0 executive agents.</span>
                </label>
                <label
                  class="st-approval-opt"
                  :class="{ 'st-approval-opt-active': agentDefaultApprovalMode === 'suggest' }"
                >
                  <input v-model="agentDefaultApprovalMode" type="radio" value="suggest" class="sr-only" />
                  <strong>Suggest</strong>
                  <span>Agent proposes actions, you review in the inbox before they execute.</span>
                </label>
                <label
                  class="st-approval-opt"
                  :class="{ 'st-approval-opt-active': agentDefaultApprovalMode === 'review' }"
                >
                  <input v-model="agentDefaultApprovalMode" type="radio" value="review" class="sr-only" />
                  <strong>Review all</strong>
                  <span>Every action requires explicit board approval. Highest governance, lowest speed.</span>
                </label>
              </div>
            </div>

            <div class="st-actions">
              <FcButton variant="primary" size="sm" :disabled="agentsSaving" @click="saveAgents">
                <Save :size="13" />
                {{ agentsSaving ? 'Saving…' : 'Save agent defaults' }}
              </FcButton>
            </div>
          </div>

          <!-- ── AI Provider ──────────────────────── -->
          <div v-else-if="activeSection === 'provider'" key="provider">
            <div class="st-pane-header">
              <Key :size="16" class="st-pane-icon" />
              <div>
                <h4>AI Provider</h4>
                <p>Select your AI provider and set your API key. Used by all agents to reason and act.</p>
              </div>
            </div>

            <!-- Provider selector -->
            <div class="st-field-group">
              <label class="st-label">Provider</label>
              <div class="st-provider-grid">
                <button
                  v-for="opt in providerOptions"
                  :key="opt.value"
                  class="st-provider-btn"
                  :class="{ 'st-provider-selected': providerName === opt.value }"
                  @click="onProviderChange(opt.value)"
                >
                  <span class="st-provider-name">{{ opt.label }}</span>
                  <span class="st-provider-hint">{{ opt.keyHint }}</span>
                </button>
              </div>
            </div>

            <!-- Default model -->
            <div class="st-field-group">
              <label class="st-label" for="st-model">Default model</label>
              <FcSelect id="st-model" v-model="providerModel">
                <option v-for="m in selectedProvider.models" :key="m" :value="m">{{ m }}</option>
              </FcSelect>
            </div>

            <!-- API Key -->
            <div class="st-field-group">
              <label class="st-label" for="st-apikey">
                API Key
                <span
                  v-if="providerApiKey"
                  class="st-label-badge st-label-badge-success"
                >Saved</span>
              </label>
              <FcPasswordInput
                id="st-apikey"
                v-model="providerApiKey"
                :placeholder="selectedProvider.keyHint"
              />
              <p v-if="maskedKey" class="st-hint">{{ maskedKey }}</p>
              <p class="st-hint">Stored locally in your workspace database. Never logged or sent externally.</p>
            </div>

            <div class="st-actions">
              <FcButton variant="primary" size="sm" :disabled="providerSaving || !providerApiKey" @click="saveProvider">
                <Save :size="13" />
                {{ providerSaving ? 'Saving…' : 'Save provider settings' }}
              </FcButton>
            </div>
          </div>

          <!-- ── Appearance ────────────────────────── -->
          <div v-else-if="activeSection === 'appearance'" key="appearance">
            <div class="st-pane-header">
              <Palette :size="16" class="st-pane-icon" />
              <div>
                <h4>Appearance</h4>
                <p>Follow the system theme or lock to light or dark mode.</p>
              </div>
            </div>

            <div class="st-field-group">
              <label class="st-label">Theme</label>
              <div class="st-theme-grid" role="radiogroup" aria-label="Theme preference">
                <label
                  class="st-theme-opt"
                  :class="{ 'st-theme-opt-active': themePreference === 'system' }"
                >
                  <input v-model="themePreference" type="radio" value="system" class="sr-only" />
                  <div class="st-theme-preview st-theme-preview-system"></div>
                  <Monitor :size="14" />
                  <span>System</span>
                </label>
                <label
                  class="st-theme-opt"
                  :class="{ 'st-theme-opt-active': themePreference === 'light' }"
                >
                  <input v-model="themePreference" type="radio" value="light" class="sr-only" />
                  <div class="st-theme-preview st-theme-preview-light"></div>
                  <Sun :size="14" />
                  <span>Light</span>
                </label>
                <label
                  class="st-theme-opt"
                  :class="{ 'st-theme-opt-active': themePreference === 'dark' }"
                >
                  <input v-model="themePreference" type="radio" value="dark" class="sr-only" />
                  <div class="st-theme-preview st-theme-preview-dark"></div>
                  <Moon :size="14" />
                  <span>Dark</span>
                </label>
              </div>
            </div>

            <div class="st-actions">
              <button class="fc-btn-primary fc-btn-sm" :disabled="themeSaving" @click="saveTheme">
                <Save :size="13" />
                {{ themeSaving ? 'Saving…' : 'Save appearance' }}
              </button>
            </div>
          </div>

          <!-- ── Advanced ──────────────────────────── -->
          <div v-else-if="activeSection === 'advanced'" key="advanced">
            <div class="st-pane-header">
              <Database :size="16" class="st-pane-icon" />
              <div>
                <h4>Advanced</h4>
                <p>All stored configuration keys in this workspace. API keys are hidden.</p>
              </div>
            </div>

            <div v-if="visibleSettings.length === 0" class="fc-empty" style="padding:32px 0;">
              <p style="margin:0;font-size:0.875rem;">No settings stored yet.</p>
            </div>
            <div v-else class="st-kv-list">
              <div
                v-for="s in visibleSettings"
                :key="s.key"
                class="st-kv-row"
              >
                <code class="st-kv-key">{{ s.key }}</code>
                <span class="st-kv-value">
                  {{ typeof s.value === 'string' ? s.value : JSON.stringify(s.value) }}
                </span>
              </div>
            </div>
          </div>

        </Transition>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ── 2-column layout ─────────────────────────────────────── */
.st-layout {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 20px;
  align-items: start;
}

/* ── Category nav ────────────────────────────────────────── */
.st-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--fc-surface);
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
  padding: 6px;
  position: sticky;
  top: 16px;
}

.st-nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 10px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--fc-text-muted);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
  width: 100%;
}

.st-nav-item:hover {
  background: var(--fc-surface-muted);
  color: var(--fc-text-main);
}

.st-nav-item-active {
  background: color-mix(in srgb, var(--fc-primary) 10%, var(--fc-surface));
  color: var(--fc-primary) !important;
  font-weight: 600;
}

.st-nav-icon { flex-shrink: 0; }

.st-nav-chevron {
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.15s;
}

.st-nav-item-active .st-nav-chevron,
.st-nav-item:hover .st-nav-chevron { opacity: 1; }

/* ── Pane ────────────────────────────────────────────────── */
.st-pane {
  background: var(--fc-surface);
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
  padding: 24px;
  min-height: 300px;
}

.st-pane-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--fc-border-subtle);
}

.st-pane-icon {
  color: var(--fc-primary);
  flex-shrink: 0;
  margin-top: 2px;
}

.st-pane-header h4 {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 700;
}

.st-pane-header p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--fc-text-muted);
  line-height: 1.5;
}

/* ── Fields ──────────────────────────────────────────────── */
.st-field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.st-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--fc-text);
}

.st-label-badge {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: 99px;
}

.st-label-badge-success {
  background: color-mix(in srgb, var(--fc-success) 12%, var(--fc-surface));
  color: var(--fc-success);
  border: 1px solid color-mix(in srgb, var(--fc-success) 25%, var(--fc-border-subtle));
}

.st-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--fc-text-muted);
  font-family: monospace;
  letter-spacing: 0.02em;
}

.st-hint:last-child { font-family: inherit; letter-spacing: normal; }

/* ── Input / Select: styles come from global styles.css ───── */
/* .fc-input, .fc-select, .fc-password-wrap, .fc-password-eye */

/* ── Provider grid ───────────────────────────────────────── */
.st-provider-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.st-provider-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 10px 14px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: 8px;
  background: var(--fc-surface);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  min-width: 100px;
  gap: 2px;
}

.st-provider-btn:hover {
  border-color: var(--fc-primary);
  background: color-mix(in srgb, var(--fc-primary) 4%, var(--fc-surface));
}

.st-provider-selected {
  border-color: var(--fc-primary) !important;
  background: color-mix(in srgb, var(--fc-primary) 10%, var(--fc-surface)) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--fc-primary) 12%, transparent);
}

.st-provider-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--fc-text-main);
}

.st-provider-hint {
  font-size: 0.75rem;
  color: var(--fc-text-muted);
  font-family: monospace;
}

/* ── Theme grid ──────────────────────────────────────────── */
.st-theme-grid {
  display: flex;
  gap: 10px;
}

.st-theme-opt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
  background: var(--fc-surface);
  cursor: pointer;
  font-size: 0.8125rem;
  color: var(--fc-text-muted);
  font-weight: 500;
  transition: border-color 0.15s, color 0.15s;
  min-width: 80px;
}

.st-theme-opt:hover { border-color: var(--fc-border-subtle); color: var(--fc-text-main); }

.st-theme-opt-active {
  border-color: var(--fc-primary) !important;
  color: var(--fc-primary) !important;
  background: color-mix(in srgb, var(--fc-primary) 8%, var(--fc-surface)) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--fc-primary) 12%, transparent);
}

.st-theme-preview {
  width: 52px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid var(--fc-border-subtle);
}

.st-theme-preview-light { background: #f9f9f7; }
.st-theme-preview-dark  { background: #1c1c1e; }
.st-theme-preview-system {
  background: linear-gradient(135deg, #f9f9f7 50%, #1c1c1e 50%);
}

/* ── Advanced: KV list ───────────────────────────────────── */
.st-kv-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--fc-border-subtle);
  border-radius: 8px;
  overflow: hidden;
}

.st-kv-row {
  display: flex;
  align-items: baseline;
  gap: 16px;
  padding: 10px 14px;
  font-size: 0.875rem;
  border-bottom: 1px solid var(--fc-border-subtle);
}

.st-kv-row:last-child { border-bottom: none; }

.st-kv-key {
  font-family: monospace;
  font-size: 0.8125rem;
  color: var(--fc-text-muted);
  width: 220px;
  flex-shrink: 0;
  word-break: break-all;
}

.st-kv-value {
  color: var(--fc-text);
  word-break: break-word;
  font-size: 0.875rem;
}

/* ── Actions ─────────────────────────────────────────────── */
.st-actions {
  display: flex;
  gap: 8px;
  padding-top: 4px;
}

/* ── Transitions ─────────────────────────────────────────── */
@keyframes fc-banner-in { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
.fc-banner-enter-active { animation: fc-banner-in 0.25s ease; }
.fc-banner-leave-active { transition: opacity 0.2s; }
.fc-banner-leave-to    { opacity: 0; }

.st-section-enter-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.st-section-leave-active { transition: opacity 0.12s ease; }
.st-section-enter-from   { opacity: 0; transform: translateY(6px); }
.st-section-leave-to     { opacity: 0; }

/* ── Screen reader only ──────────────────────────────────── */
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); border:0; }
</style>
