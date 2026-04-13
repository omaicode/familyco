<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  Sun, Moon, Monitor, Save, RefreshCw,
  Key, Palette, Database, ChevronRight,
  Building2, Wallet, Cpu, Download, Copy, RotateCcw, ShieldAlert, MapPin, FolderOpen, CheckCircle2,
} from 'lucide-vue-next';

import { applyRuntimeTheme, uiRuntime } from '../runtime';
import { useAutoReload } from '../composables/useAutoReload';
import FcButton from '../components/FcButton.vue';
import FcInput from '../components/FcInput.vue';
import FcSelect from '../components/FcSelect.vue';
import ProviderSettingsSection from '../components/settings/ProviderSettingsSection.vue';
import { useTutorialTour } from '../composables/useTutorialTour';
import { useI18n } from '../composables/useI18n';
import { useToast } from '../plugins/toast.plugin';

// ── Types ─────────────────────────────────────────────────
type ThemePreference = 'system' | 'light' | 'dark';
type Section = 'company' | 'budget' | 'agents' | 'provider' | 'appearance' | 'workspace' | 'system';

// ── State ─────────────────────────────────────────────────
const router = useRouter();
const { t } = useI18n();
const toast = useToast();
const tour = useTutorialTour();
const replayTour = () => { router.push('/dashboard').then(() => tour.start(t)); };

const activeSection = ref<Section>('company');
const feedback = ref<{ type: 'success' | 'error'; text: string } | null>(null);

// ── Company form ─────────────────────────────────────
const companyName = ref('');
const companyDescription = ref('');
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


// ── Provider section ref ──────────────────────────────────
const providerSectionRef = ref<InstanceType<typeof ProviderSettingsSection> | null>(null);

// ── Workspace form ────────────────────────────────────────
const workspacePath = ref('');
const workspaceSaving = ref(false);
const isBrowsingWorkspace = ref(false);
const isDesktop = typeof window !== 'undefined' && typeof (window as unknown as Record<string, unknown>).familycoDesktop === 'object';

// ── Appearance ────────────────────────────────────────────
const themePreference = ref<ThemePreference>('system');
const themeSaving = ref(false);

// ── System ────────────────────────────────────────────────
const systemBusy = ref(false);
const systemInfo = reactive({
  runtimeMode: 'Browser',
  apiBaseUrl: '',
  serverReachable: false,
  lastHealthCheckAt: '',
  onboardingComplete: false,
  settingsCount: 0
});

// ── Helpers ───────────────────────────────────────────────
const parseThemePreference = (v: unknown): ThemePreference | null =>
  (v === 'system' || v === 'light' || v === 'dark') ? v : null;

const getSetting = (key: string): unknown =>
  uiRuntime.stores.settings.state.data.find(s => s.key === key)?.value;

const setFeedback = (type: 'success' | 'error', text: string) => {
  feedback.value = null;
  toast.show({ type, message: text });
};

const formatDateTime = (iso: string): string => {
  if (!iso) return 'Not checked yet';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
};

// ── Load ──────────────────────────────────────────────────
const reload = async () => {
  feedback.value = null;
  await uiRuntime.stores.settings.load();

  themePreference.value = parseThemePreference(getSetting('ui.theme.preference')) ?? 'system';
  applyTheme(themePreference.value);

  // Company
  companyName.value     = typeof getSetting('company.name') === 'string' ? getSetting('company.name') as string : '';
  companyDescription.value = typeof getSetting('company.description') === 'string'
    ? getSetting('company.description') as string
    : typeof getSetting('company.goal') === 'string'
      ? getSetting('company.goal') as string
      : '';
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

  // Workspace
  workspacePath.value = typeof getSetting('workspace.path') === 'string' ? getSetting('workspace.path') as string : '';

  // System diagnostics
  systemInfo.runtimeMode = typeof window !== 'undefined' && typeof window.familycoDesktop?.invoke === 'function'
    ? 'Desktop app'
    : 'Browser';
  systemInfo.apiBaseUrl = uiRuntime.stores.app.state.connection.baseURL;
  systemInfo.serverReachable = uiRuntime.stores.app.state.connection.isServerReachable;
  systemInfo.lastHealthCheckAt = uiRuntime.stores.app.state.connection.lastHealthCheckAt ?? '';
  systemInfo.onboardingComplete = getSetting('onboarding.complete') === true;
  systemInfo.settingsCount = uiRuntime.stores.settings.state.data.filter(s => s.key !== 'provider.apiKey').length;
};

// ── Apply theme ───────────────────────────────────────────
const applyTheme = (pref: ThemePreference) => {
  const dark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  uiRuntime.stores.app.applyThemePreference(pref, dark);
  applyRuntimeTheme();
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
    await uiRuntime.api.upsertSetting({ key: 'company.name',        value: companyName.value.trim() });
    await uiRuntime.api.upsertSetting({ key: 'company.description', value: companyDescription.value.trim() });
    await uiRuntime.api.upsertSetting({ key: 'company.timezone',    value: companyTimezone.value });
    await uiRuntime.stores.settings.load();
    setFeedback('success', 'Company settings saved');
  } catch (err) {
    setFeedback('error', err instanceof Error ? err.message : 'Failed to save company settings');
  } finally {
    companySaving.value = false;
  }
};

// ── Save: workspace ───────────────────────────────────────
const saveWorkspace = async () => {
  workspaceSaving.value = true;
  feedback.value = null;
  try {
    await uiRuntime.api.upsertSetting({ key: 'workspace.path', value: workspacePath.value.trim() });
    await uiRuntime.stores.settings.load();
    setFeedback('success', 'Workspace path saved');
  } catch (err) {
    setFeedback('error', err instanceof Error ? err.message : 'Failed to save workspace path');
  } finally {
    workspaceSaving.value = false;
  }
};

const browseWorkspace = async () => {
  if (!isDesktop) return;
  isBrowsingWorkspace.value = true;
  try {
    const desktop = (window as unknown as Record<string, unknown>).familycoDesktop as {
      invoke: (channel: string, payload: Record<string, never>) => Promise<{ canceled: boolean; filePaths: string[] }>
    };
    const result = await desktop.invoke('desktop:dialog:open-directory', {});
    if (!result.canceled && result.filePaths.length > 0) {
      workspacePath.value = result.filePaths[0] ?? '';
    }
  } catch {
    // Ignore dialog errors
  } finally {
    isBrowsingWorkspace.value = false;
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

// ── System actions ────────────────────────────────────────
const exportSettings = async () => {
  systemBusy.value = true;
  feedback.value = null;
  try {
    const payload = visibleSettings.value.map((item) => ({ key: item.key, value: item.value }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `familyco-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setFeedback('success', 'Workspace settings exported');
  } catch (err) {
    setFeedback('error', err instanceof Error ? err.message : 'Failed to export settings');
  } finally {
    systemBusy.value = false;
  }
};

const copyApiBaseUrl = async () => {
  if (!systemInfo.apiBaseUrl) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(systemInfo.apiBaseUrl);
      setFeedback('success', 'API URL copied');
      return;
    }
    window.prompt('Copy API URL', systemInfo.apiBaseUrl);
  } catch (err) {
    setFeedback('error', err instanceof Error ? err.message : 'Failed to copy API URL');
  }
};

const clearProviderKey = async () => {
  systemBusy.value = true;
  feedback.value = null;
  try {
    await uiRuntime.api.upsertSetting({ key: 'provider.apiKey', value: '' });
    await uiRuntime.api.upsertSetting({ key: 'provider.copilot.apiKey', value: '' });
    await uiRuntime.api.upsertSetting({ key: 'provider.openai.apiKey', value: '' });
    await uiRuntime.api.upsertSetting({ key: 'provider.claude.apiKey', value: '' });
    await reload();
    setFeedback('success', 'All stored API keys cleared');
  } catch (err) {
    setFeedback('error', err instanceof Error ? err.message : 'Failed to clear provider key');
  } finally {
    systemBusy.value = false;
  }
};

const restartOnboarding = async () => {
  systemBusy.value = true;
  feedback.value = null;
  try {
    await uiRuntime.api.upsertSetting({ key: 'onboarding.complete', value: false });
    await uiRuntime.stores.settings.load();
    await router.replace('/setup');
  } catch (err) {
    setFeedback('error', err instanceof Error ? err.message : 'Failed to restart onboarding');
  } finally {
    systemBusy.value = false;
  }
};

// ── Visible settings (hide secrets) ───────────────────────
const visibleSettings = computed(() =>
  uiRuntime.stores.settings.state.data.filter(s => !s.key.toLowerCase().includes('apikey'))
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
      <button
        class="fc-btn-secondary"
        :disabled="themeSaving || companySaving || budgetSaving || agentsSaving || systemBusy"
        @click="reload"
      >
        <RefreshCw :size="14" />
        Refresh
      </button>
    </div>

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
          :class="{ 'st-nav-item-active': activeSection === 'workspace' }"
          @click="activeSection = 'workspace'"
        >
          <FolderOpen :size="15" class="st-nav-icon" />
          <span>Workspace</span>
          <ChevronRight :size="13" class="st-nav-chevron" />
        </button>
        <button
          class="st-nav-item"
          :class="{ 'st-nav-item-active': activeSection === 'system' }"
          @click="activeSection = 'system'"
        >
          <Database :size="15" class="st-nav-icon" />
          <span>System</span>
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
                <p>Define your company's identity and business description. Agents use this as core context when reasoning about work.</p>
              </div>
            </div>

            <div class="st-field-group">
              <label class="st-label" for="st-company-name">Company name</label>
              <FcInput id="st-company-name" v-model="companyName" placeholder="e.g. Acme Corp" />
            </div>

            <div class="st-field-group">
              <label class="st-label" for="st-company-description">Company description</label>
              <textarea
                id="st-company-description"
                v-model="companyDescription"
                class="fc-textarea"
                rows="4"
                placeholder="e.g. AI-native operating system for founders who need execution speed, approval safety, and visibility."
              />
              <p class="st-hint" style="font-family:inherit;letter-spacing:normal;">This description is injected into the executive agent context so it understands the business and operating style.</p>
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
                <h4>AI Adapter</h4>
                <p>Select your AI adapter and set your API key. Used by all agents to reason and act.</p>
              </div>
            </div>
            <ProviderSettingsSection
              ref="providerSectionRef"
              @feedback="(type, text) => setFeedback(type, text)"
            />
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

          <!-- ── Workspace ──────────────────────────── -->
          <div v-else-if="activeSection === 'workspace'" key="workspace">
            <div class="st-pane-header">
              <FolderOpen :size="16" class="st-pane-icon" />
              <div>
                <h4>Workspace</h4>
                <p>Set the local folder where FamilyCo stores project files and agent outputs. New projects will be created as sub-folders inside this directory.</p>
              </div>
            </div>

            <div class="st-field-group">
              <label class="st-label">Workspace folder path</label>

              <button
                type="button"
                class="st-folder-pick-btn"
                :disabled="isBrowsingWorkspace"
                :title="isDesktop ? '' : 'Folder picker requires the desktop app'"
                @click="isDesktop ? browseWorkspace() : undefined"
              >
                <FolderOpen :size="16" />
                <span v-if="isBrowsingWorkspace">Browsing…</span>
                <span v-else-if="workspacePath">Change folder</span>
                <span v-else>Choose workspace folder</span>
              </button>

              <div v-if="workspacePath" class="st-path-display st-path-ok">
                <CheckCircle2 :size="13" style="color:var(--fc-success);flex-shrink:0;" />
                <code style="word-break:break-all;">{{ workspacePath }}</code>
              </div>
              <div v-else-if="!isDesktop" class="st-path-display st-path-warn">
                <ShieldAlert :size="13" style="flex-shrink:0;" />
                <span>Folder picker is only available in the desktop app. Run FamilyCo as a desktop app to set the workspace path.</span>
              </div>

              <p class="st-hint" style="font-family:inherit;letter-spacing:normal;">
                The folder and its <code>projects/</code> sub-directory will be created automatically when a new project is added.
              </p>
            </div>

            <div v-if="workspacePath" class="st-kv-list" style="margin-bottom:16px;">
              <div class="st-kv-row">
                <code class="st-kv-key">Projects will be saved to</code>
                <span class="st-kv-value" style="word-break:break-all;">{{ workspacePath }}/projects/&lt;project-slug&gt;</span>
              </div>
            </div>

            <div class="st-actions">
              <FcButton variant="primary" size="sm" :disabled="workspaceSaving" @click="saveWorkspace">
                <Save :size="13" />
                {{ workspaceSaving ? 'Saving…' : 'Save workspace path' }}
              </FcButton>
            </div>
          </div>

          <!-- ── System ────────────────────────────── -->
          <div v-else-if="activeSection === 'system'" key="system">
            <div class="st-pane-header">
              <Database :size="16" class="st-pane-icon" />
              <div>
                <h4>System</h4>
                <p>Workspace actions, runtime diagnostics, and recovery tools for your FamilyCo environment.</p>
              </div>
            </div>

            <div class="st-system-grid">
              <section class="st-system-card">
                <div class="st-system-card-head">
                  <h5>Runtime diagnostics</h5>
                  <p>Quick visibility into the current workspace connection state.</p>
                </div>

                <div class="st-kv-list">
                  <div class="st-kv-row">
                    <code class="st-kv-key">Runtime mode</code>
                    <span class="st-kv-value">{{ systemInfo.runtimeMode }}</span>
                  </div>
                  <div class="st-kv-row">
                    <code class="st-kv-key">API base URL</code>
                    <span class="st-kv-value">{{ systemInfo.apiBaseUrl || 'Not set' }}</span>
                  </div>
                  <div class="st-kv-row">
                    <code class="st-kv-key">Server status</code>
                    <span class="st-kv-value" :class="systemInfo.serverReachable ? 'st-status-ok' : 'st-status-bad'">
                      {{ systemInfo.serverReachable ? 'Reachable' : 'Unavailable' }}
                    </span>
                  </div>
                  <div class="st-kv-row">
                    <code class="st-kv-key">Last health check</code>
                    <span class="st-kv-value">{{ formatDateTime(systemInfo.lastHealthCheckAt) }}</span>
                  </div>
                  <div class="st-kv-row">
                    <code class="st-kv-key">Stored settings</code>
                    <span class="st-kv-value">{{ systemInfo.settingsCount }}</span>
                  </div>
                </div>

                <div class="st-actions">
                  <FcButton variant="secondary" size="sm" :disabled="systemBusy || !systemInfo.apiBaseUrl" @click="copyApiBaseUrl">
                    <Copy :size="13" />
                    Copy API URL
                  </FcButton>
                </div>
              </section>

              <section class="st-system-card">
                <div class="st-system-card-head">
                  <h5>Workspace actions</h5>
                  <p>Useful maintenance actions for your current workspace.</p>
                </div>

                <div class="st-system-actions">
                  <FcButton variant="secondary" size="sm" :disabled="systemBusy || visibleSettings.length === 0" @click="exportSettings">
                    <Download :size="13" />
                    Export settings
                  </FcButton>
                  <FcButton variant="secondary" size="sm" @click="replayTour">
                    <MapPin :size="13" />
                    {{ t('Take a tour') }}
                  </FcButton>
                </div>
                <p class="st-hint">Exports a JSON snapshot of the current workspace settings. Provider API keys are excluded for safety.</p>
              </section>

              <section class="st-system-card st-system-card-danger">
                <div class="st-system-card-head">
                  <h5>Recovery</h5>
                  <p>Use these carefully when you need to recover or reconfigure the workspace.</p>
                </div>

                <div class="st-system-actions">
                  <FcButton variant="secondary" size="sm" :disabled="systemBusy" @click="clearProviderKey">
                    <ShieldAlert :size="13" />
                    Clear provider key
                  </FcButton>
                  <FcButton variant="danger" size="sm" :disabled="systemBusy || !systemInfo.onboardingComplete" @click="restartOnboarding">
                    <RotateCcw :size="13" />
                    Restart onboarding
                  </FcButton>
                </div>
                <p class="st-hint">Restarting onboarding sends you back to the setup wizard so you can reconfigure the workspace from scratch.</p>
              </section>

              <details class="st-raw-settings">
                <summary>Raw stored settings</summary>

                <div v-if="visibleSettings.length === 0" class="fc-empty" style="padding:20px 0 4px;">
                  <p style="margin:0;font-size:0.875rem;">No settings stored yet.</p>
                </div>
                <div v-else class="st-kv-list" style="margin-top:12px;">
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
              </details>
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

/* ── Folder picker ───────────────────────────────────────── */
.st-folder-pick-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  width: 100%;
  border: 1.5px dashed var(--fc-border-subtle);
  border-radius: 8px;
  background: var(--fc-surface);
  color: var(--fc-primary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  margin-bottom: 4px;
}
.st-folder-pick-btn:hover:not(:disabled) {
  border-color: var(--fc-primary);
  background: color-mix(in srgb, var(--fc-primary) 5%, var(--fc-surface));
}
.st-folder-pick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.st-path-display {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 0.8125rem;
  margin-bottom: 6px;
}
.st-path-ok {
  background: color-mix(in srgb, var(--fc-success) 8%, var(--fc-surface));
  border: 1px solid color-mix(in srgb, var(--fc-success) 20%, var(--fc-border-subtle));
}
.st-path-ok code { font-size: 0.8rem; color: var(--fc-text-main); }
.st-path-warn {
  background: color-mix(in srgb, var(--fc-warning) 8%, var(--fc-surface));
  border: 1px solid color-mix(in srgb, var(--fc-warning) 20%, var(--fc-border-subtle));
  color: var(--fc-text-muted);
}

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

/* ── Test connection (settings) ────────────────────────── */
.st-btn-test {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 7px;
  border: 1px solid var(--fc-border);
  background: var(--fc-surface);
  color: var(--fc-text-muted);
  font-size: 12.5px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.st-btn-test:not(:disabled):hover { border-color: var(--fc-accent); color: var(--fc-text); }
.st-btn-test:disabled { opacity: 0.45; cursor: not-allowed; }

.st-test-result {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 7px 12px;
  border-radius: 7px;
  font-size: 12.5px;
}
.st-test-ok { background: color-mix(in srgb, var(--fc-success, #22c55e) 12%, transparent); color: #16a34a; }
.st-test-fail { background: color-mix(in srgb, #ef4444 12%, transparent); color: #dc2626; }
.st-test-latency { margin-left: 6px; opacity: 0.65; font-size: 11px; }

@keyframes st-spin { to { transform: rotate(360deg); } }
.st-spin { animation: st-spin 0.8s linear infinite; }

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

/* ── System cards ────────────────────────────────────────── */
.st-system-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.st-system-card {
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
  background: color-mix(in srgb, var(--fc-surface) 92%, transparent);
  padding: 14px;
}

.st-system-card-head {
  margin-bottom: 12px;
}

.st-system-card-head h5 {
  margin: 0 0 4px;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--fc-text-main);
}

.st-system-card-head p {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--fc-text-muted);
  line-height: 1.5;
}

.st-system-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.st-system-card-danger {
  border-color: color-mix(in srgb, var(--fc-danger) 25%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-danger) 4%, var(--fc-surface));
}

.st-status-ok { color: var(--fc-success); font-weight: 600; }
.st-status-bad { color: var(--fc-danger); font-weight: 600; }

.st-raw-settings {
  border: 1px dashed var(--fc-border-subtle);
  border-radius: 10px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--fc-surface) 95%, transparent);
}

.st-raw-settings summary {
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--fc-text-main);
}

.st-raw-settings[open] summary { margin-bottom: 2px; }

/* ── KV list ─────────────────────────────────────────────── */
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
