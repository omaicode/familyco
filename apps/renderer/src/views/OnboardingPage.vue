<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  Zap, Building2, Key, Users, CheckCircle2, ChevronRight, ChevronLeft,
  Eye, EyeOff, AlertTriangle, ArrowRight, Sparkles
} from 'lucide-vue-next';

import { uiRuntime } from '../runtime';

type Provider = 'openai' | 'anthropic' | 'google';

const router = useRouter();

const currentStep = ref(1);
const TOTAL_STEPS = 4;
const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const done = ref(false);
const showApiKey = ref(false);

const createdResult = ref<{ executiveName: string; templateCount: number } | null>(null);

const form = reactive({
  companyName: '',
  departmentsText: 'Operations, Marketing, Research',
  provider: 'openai' as Provider,
  apiKey: '',
  defaultModel: 'gpt-4o',
});

interface ProviderOption {
  value: Provider;
  label: string;
  description: string;
  keyHint: string;
  defaultModel: string;
  models: string[];
}

const providerOptions: ProviderOption[] = [
  {
    value: 'openai',
    label: 'OpenAI',
    description: 'GPT-4o, o1, o3 — best for general-purpose agents',
    keyHint: 'sk-…',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1'],
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    description: 'Claude — great for reasoning and long-context tasks',
    keyHint: 'sk-ant-…',
    defaultModel: 'claude-sonnet-4-5',
    models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5'],
  },
  {
    value: 'google',
    label: 'Google AI',
    description: 'Gemini — multimodal and fast for structured tasks',
    keyHint: 'AIza…',
    defaultModel: 'gemini-2.5-pro',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  },
];

const selectedProvider = computed(() => providerOptions.find(p => p.value === form.provider)!);

const departments = computed(() =>
  form.departmentsText.split(',').map(s => s.trim()).filter(s => s.length > 0)
);

const canNext = computed(() => {
  if (currentStep.value === 2) return form.companyName.trim().length > 0;
  if (currentStep.value === 3) return form.apiKey.trim().length > 0;
  return true;
});

const selectProvider = (p: Provider) => {
  form.provider = p;
  form.defaultModel = providerOptions.find(o => o.value === p)!.defaultModel;
  showApiKey.value = false;
  form.apiKey = '';
};

const next = () => { if (currentStep.value < TOTAL_STEPS) currentStep.value++; };
const prev = () => { if (currentStep.value > 1) currentStep.value--; };

const initialize = async () => {
  isSubmitting.value = true;
  errorMessage.value = null;
  try {
    await uiRuntime.api.upsertSetting({ key: 'provider.name', value: form.provider });
    await uiRuntime.api.upsertSetting({ key: 'provider.apiKey', value: form.apiKey });
    await uiRuntime.api.upsertSetting({ key: 'provider.defaultModel', value: form.defaultModel });
    const result = await uiRuntime.api.initializeSetup({
      companyName: form.companyName.trim(),
      departments: departments.value,
    });
    await uiRuntime.api.upsertSetting({ key: 'onboarding.complete', value: true });
    createdResult.value = {
      executiveName: result.executiveAgent.name,
      templateCount: result.departmentTemplates.length,
    };
    done.value = true;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Initialization failed. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
};

const goToDashboard = () => router.replace('/chat');
</script>

<template>
  <div class="ob-shell">
    <!-- Brand watermark -->
    <div class="ob-brand">
      <Zap :size="16" />
      <span>FamilyCo</span>
    </div>

    <!-- ── Success screen ─────────────────────────────── -->
    <Transition name="ob-fade" mode="out-in">
      <div v-if="done && createdResult" class="ob-card" style="text-align:center;">
        <div class="ob-success-icon">
          <CheckCircle2 :size="36" />
        </div>
        <h2 style="margin:0 0 8px;font-size:1.5rem;">You're all set!</h2>
        <p style="margin:0 0 24px;color:var(--fc-text-muted);font-size:0.9375rem;line-height:1.6;">
          Executive agent <strong>{{ createdResult.executiveName }}</strong> is ready.
          <template v-if="createdResult.templateCount > 0">
            {{ createdResult.templateCount }} optional department template{{ createdResult.templateCount !== 1 ? 's' : '' }} were saved for later approval.
          </template>
          <template v-else>
            You can add optional department templates later as your AI company grows.
          </template>
        </p>
        <button class="ob-btn-primary ob-btn-lg" style="width:100%;" @click="goToDashboard">
          Open Executive Chat <ArrowRight :size="16" />
        </button>
      </div>

      <!-- ── Wizard card ─────────────────────────────── -->
      <div v-else class="ob-card">
        <!-- Step indicator -->
        <div class="ob-steps" aria-label="Setup progress">
          <div
            v-for="n in TOTAL_STEPS"
            :key="n"
            class="ob-step-dot"
            :class="{
              'ob-step-active': n === currentStep,
              'ob-step-done': n < currentStep,
            }"
          ></div>
        </div>

        <!-- ── Step 1: Welcome ──────────────────────── -->
        <Transition name="ob-step" mode="out-in">
          <div v-if="currentStep === 1" key="step1" class="ob-step-body">
            <div class="ob-step-icon ob-step-icon-primary">
              <Sparkles :size="28" />
            </div>
            <h2 class="ob-title">Welcome to FamilyCo</h2>
            <p class="ob-subtitle">
              Your AI-powered operating system for managing teams, tasks, and workflows.<br />
              Let's take 2 minutes to set up your workspace.
            </p>

            <div class="ob-feature-list">
              <div class="ob-feature-item">
                <Building2 :size="16" style="color:var(--fc-primary);flex-shrink:0;" />
                <span>Create your company and first executive agent</span>
              </div>
              <div class="ob-feature-item">
                <Key :size="16" style="color:var(--fc-primary);flex-shrink:0;" />
                <span>Connect your AI provider</span>
              </div>
              <div class="ob-feature-item">
                <Users :size="16" style="color:var(--fc-primary);flex-shrink:0;" />
                <span>Save optional future department templates</span>
              </div>
            </div>

            <button class="ob-btn-primary ob-btn-lg" style="width:100%;margin-top:8px;" @click="next">
              Get started <ChevronRight :size="16" />
            </button>
          </div>
        </Transition>

        <!-- ── Step 2: Company info ─────────────────── -->
        <Transition name="ob-step" mode="out-in">
          <div v-if="currentStep === 2" key="step2" class="ob-step-body">
            <div class="ob-step-icon ob-step-icon-info">
              <Building2 :size="28" />
            </div>
            <h2 class="ob-title">Company details</h2>
            <p class="ob-subtitle">Name your company and list any future departments you may want later. They stay as templates until the L0 executive proposes them and the Founder approves.</p>

            <div class="ob-form-group">
              <label class="ob-label">Company name <span class="ob-required">*</span></label>
              <input
                v-model="form.companyName"
                class="ob-input"
                placeholder="e.g. Acme Corp"
                maxlength="80"
                autofocus
              />
            </div>

            <div class="ob-form-group">
              <label class="ob-label">Future departments <span class="ob-optional">optional</span></label>
              <input
                v-model="form.departmentsText"
                class="ob-input"
                placeholder="Operations, Marketing, Research"
              />
              <p class="ob-hint">Comma-separated optional ideas. They are saved as templates only — no extra agents are created during setup.</p>
              <!-- Preview chips -->
              <div v-if="departments.length > 0" class="ob-chip-row">
                <span v-for="dept in departments" :key="dept" class="ob-chip">{{ dept }}</span>
              </div>
            </div>

            <div class="ob-actions">
              <button class="ob-btn-ghost" @click="prev">
                <ChevronLeft :size="16" /> Back
              </button>
              <button class="ob-btn-primary" :disabled="!canNext" @click="next">
                Next <ChevronRight :size="16" />
              </button>
            </div>
          </div>
        </Transition>

        <!-- ── Step 3: AI Provider ──────────────────── -->
        <Transition name="ob-step" mode="out-in">
          <div v-if="currentStep === 3" key="step3" class="ob-step-body">
            <div class="ob-step-icon ob-step-icon-accent">
              <Key :size="28" />
            </div>
            <h2 class="ob-title">AI provider</h2>
            <p class="ob-subtitle">Choose your AI provider and paste your API key. This is used by your agents to reason and act.</p>

            <!-- Provider selector -->
            <div class="ob-provider-grid">
              <button
                v-for="opt in providerOptions"
                :key="opt.value"
                class="ob-provider-card"
                :class="{ 'ob-provider-selected': form.provider === opt.value }"
                @click="selectProvider(opt.value)"
              >
                <span class="ob-provider-name">{{ opt.label }}</span>
                <span class="ob-provider-desc">{{ opt.description }}</span>
              </button>
            </div>

            <!-- API Key -->
            <div class="ob-form-group">
              <label class="ob-label">API Key <span class="ob-required">*</span></label>
              <div class="ob-input-wrap">
                <input
                  v-model="form.apiKey"
                  :type="showApiKey ? 'text' : 'password'"
                  class="ob-input ob-input-password"
                  :placeholder="selectedProvider.keyHint"
                  autocomplete="off"
                  spellcheck="false"
                />
                <button
                  type="button"
                  class="ob-eye-btn"
                  :aria-label="showApiKey ? 'Hide key' : 'Show key'"
                  @click="showApiKey = !showApiKey"
                >
                  <component :is="showApiKey ? EyeOff : Eye" :size="15" />
                </button>
              </div>
              <p class="ob-hint">Stored locally in your database — never sent anywhere else.</p>
            </div>

            <!-- Default model -->
            <div class="ob-form-group">
              <label class="ob-label">Default model</label>
              <select v-model="form.defaultModel" class="ob-input ob-select">
                <option v-for="m in selectedProvider.models" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>

            <div class="ob-actions">
              <button class="ob-btn-ghost" @click="prev">
                <ChevronLeft :size="16" /> Back
              </button>
              <button class="ob-btn-primary" :disabled="!canNext" @click="next">
                Next <ChevronRight :size="16" />
              </button>
            </div>
          </div>
        </Transition>

        <!-- ── Step 4: Review & Initialize ─────────── -->
        <Transition name="ob-step" mode="out-in">
          <div v-if="currentStep === 4" key="step4" class="ob-step-body">
            <div class="ob-step-icon ob-step-icon-success">
              <Users :size="28" />
            </div>
            <h2 class="ob-title">Review & launch</h2>
            <p class="ob-subtitle">Everything looks good. Click initialize to create your workspace with one mandatory L0 executive agent.</p>

            <!-- Summary -->
            <div class="ob-summary">
              <div class="ob-summary-row">
                <span class="ob-summary-label">Company</span>
                <span class="ob-summary-value">{{ form.companyName }}</span>
              </div>
              <div class="ob-summary-row">
                <span class="ob-summary-label">Templates</span>
                <span class="ob-summary-value">{{ departments.length > 0 ? departments.join(', ') : 'No optional templates yet' }}</span>
              </div>
              <div class="ob-summary-row">
                <span class="ob-summary-label">AI Provider</span>
                <span class="ob-summary-value">{{ selectedProvider.label }}</span>
              </div>
              <div class="ob-summary-row">
                <span class="ob-summary-label">Model</span>
                <span class="ob-summary-value">{{ form.defaultModel }}</span>
              </div>
              <div class="ob-summary-row">
                <span class="ob-summary-label">Agents created</span>
                <span class="ob-summary-value">1 executive (L0) only — extra roles stay optional until approval.</span>
              </div>
            </div>

            <!-- Error -->
            <div v-if="errorMessage" class="ob-error">
              <AlertTriangle :size="15" style="flex-shrink:0;" />
              <span>{{ errorMessage }}</span>
            </div>

            <div class="ob-actions">
              <button class="ob-btn-ghost" :disabled="isSubmitting" @click="prev">
                <ChevronLeft :size="16" /> Back
              </button>
              <button class="ob-btn-primary" :disabled="isSubmitting" @click="initialize">
                <Zap :size="15" />
                {{ isSubmitting ? 'Initializing…' : 'Initialize workspace' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ── Shell ────────────────────────────────────────────── */
.ob-shell {
  min-height: 100vh;
  background: var(--fc-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  position: relative;
}

/* ── Brand watermark ──────────────────────────────────── */
.ob-brand {
  position: absolute;
  top: 20px;
  left: 24px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--fc-primary);
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

/* ── Card ─────────────────────────────────────────────── */
.ob-card {
  width: 100%;
  max-width: 480px;
  background: var(--fc-surface);
  border: 1px solid var(--fc-border-subtle);
  border-radius: 16px;
  padding: 36px 32px;
  box-shadow: 0 4px 24px color-mix(in srgb, var(--fc-text) 6%, transparent);
}

/* ── Step indicators ──────────────────────────────────── */
.ob-steps {
  display: flex;
  gap: 6px;
  margin-bottom: 28px;
}

.ob-step-dot {
  height: 4px;
  flex: 1;
  border-radius: 2px;
  background: var(--fc-border-subtle);
  transition: background 0.25s;
}

.ob-step-active { background: var(--fc-primary); }
.ob-step-done   { background: color-mix(in srgb, var(--fc-primary) 45%, var(--fc-border-subtle)); }

/* ── Step body ────────────────────────────────────────── */
.ob-step-body {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── Step icon ────────────────────────────────────────── */
.ob-step-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  border: 1px solid transparent;
}

.ob-step-icon-primary {
  background: color-mix(in srgb, var(--fc-primary) 12%, var(--fc-surface));
  border-color: color-mix(in srgb, var(--fc-primary) 25%, var(--fc-border-subtle));
  color: var(--fc-primary);
}

.ob-step-icon-info {
  background: color-mix(in srgb, var(--fc-info) 12%, var(--fc-surface));
  border-color: color-mix(in srgb, var(--fc-info) 25%, var(--fc-border-subtle));
  color: var(--fc-info);
}

.ob-step-icon-accent {
  background: color-mix(in srgb, var(--fc-warning) 12%, var(--fc-surface));
  border-color: color-mix(in srgb, var(--fc-warning) 25%, var(--fc-border-subtle));
  color: var(--fc-warning);
}

.ob-step-icon-success {
  background: color-mix(in srgb, var(--fc-success) 12%, var(--fc-surface));
  border-color: color-mix(in srgb, var(--fc-success) 25%, var(--fc-border-subtle));
  color: var(--fc-success);
}

/* ── Typography ───────────────────────────────────────── */
.ob-title {
  margin: 0 0 8px;
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.ob-subtitle {
  margin: 0 0 24px;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--fc-text-muted);
}

/* ── Feature list (step 1) ────────────────────────────── */
.ob-feature-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 28px;
  padding: 16px;
  background: var(--fc-bg);
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
}

.ob-feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.875rem;
  color: var(--fc-text);
}

/* ── Form ─────────────────────────────────────────────── */
.ob-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.ob-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--fc-text);
}

.ob-required {
  color: var(--fc-error, #e55);
  margin-left: 2px;
}

.ob-optional {
  color: var(--fc-text-muted);
  font-weight: 500;
  margin-left: 4px;
  text-transform: lowercase;
}

.ob-input {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 12px;
  border: 1px solid var(--fc-border);
  border-radius: 8px;
  background: var(--fc-bg);
  color: var(--fc-text);
  font-size: 0.9375rem;
  outline: none;
  transition: border-color 0.15s;
}

.ob-input:focus {
  border-color: var(--fc-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--fc-primary) 15%, transparent);
}

.ob-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--fc-text-muted);
}

/* ── Password field ───────────────────────────────────── */
.ob-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.ob-input-password {
  padding-right: 40px;
}

.ob-eye-btn {
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--fc-text-muted);
  display: flex;
  align-items: center;
  border-radius: 4px;
}

.ob-eye-btn:hover { color: var(--fc-text); }

/* ── Select ───────────────────────────────────────────── */
.ob-select {
  appearance: none;
  cursor: pointer;
}

/* ── Chip row ─────────────────────────────────────────── */
.ob-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

.ob-chip {
  padding: 2px 10px;
  border-radius: 99px;
  background: color-mix(in srgb, var(--fc-primary) 12%, var(--fc-bg));
  border: 1px solid color-mix(in srgb, var(--fc-primary) 25%, var(--fc-border-subtle));
  color: var(--fc-primary);
  font-size: 0.8125rem;
  font-weight: 500;
}

/* ── Provider grid ────────────────────────────────────── */
.ob-provider-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.ob-provider-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  padding: 12px 14px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
  background: var(--fc-bg);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  width: 100%;
}

.ob-provider-card:hover {
  border-color: var(--fc-primary);
  background: color-mix(in srgb, var(--fc-primary) 4%, var(--fc-bg));
}

.ob-provider-selected {
  border-color: var(--fc-primary) !important;
  background: color-mix(in srgb, var(--fc-primary) 8%, var(--fc-bg)) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--fc-primary) 12%, transparent);
}

.ob-provider-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--fc-text);
  margin-bottom: 2px;
}

.ob-provider-desc {
  font-size: 0.8125rem;
  color: var(--fc-text-muted);
}

/* ── Summary ──────────────────────────────────────────── */
.ob-summary {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 20px;
}

.ob-summary-row {
  display: flex;
  gap: 12px;
  align-items: baseline;
  padding: 10px 14px;
  font-size: 0.875rem;
  border-bottom: 1px solid var(--fc-border-subtle);
}

.ob-summary-row:last-child { border-bottom: none; }

.ob-summary-label {
  font-weight: 600;
  width: 120px;
  flex-shrink: 0;
  color: var(--fc-text-muted);
}

.ob-summary-value {
  color: var(--fc-text);
  word-break: break-word;
}

/* ── Error ────────────────────────────────────────────── */
.ob-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--fc-error, #e55) 30%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-error, #e55) 8%, var(--fc-surface));
  border-radius: 8px;
  color: var(--fc-error, #e55);
  font-size: 0.875rem;
  margin-bottom: 16px;
}

/* ── Success ──────────────────────────────────────────── */
.ob-success-icon {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--fc-success) 12%, var(--fc-surface));
  border: 1px solid color-mix(in srgb, var(--fc-success) 30%, var(--fc-border-subtle));
  color: var(--fc-success);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
}

/* ── Actions ──────────────────────────────────────────── */
.ob-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

/* ── Buttons ──────────────────────────────────────────── */
.ob-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: var(--fc-primary);
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  white-space: nowrap;
}

.ob-btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ob-btn-primary:not(:disabled):hover { opacity: 0.9; }
.ob-btn-primary:not(:disabled):active { transform: scale(0.98); }

.ob-btn-lg { padding: 12px 24px; font-size: 1rem; }

.ob-btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 10px 14px;
  background: transparent;
  color: var(--fc-text-muted);
  font-size: 0.875rem;
  font-weight: 500;
  border: 1px solid var(--fc-border-subtle);
  border-radius: 8px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.ob-btn-ghost:hover { color: var(--fc-text); border-color: var(--fc-border); }
.ob-btn-ghost:disabled { opacity: 0.45; cursor: not-allowed; }

/* ── Transitions ──────────────────────────────────────── */
.ob-fade-enter-active { transition: opacity 0.3s ease; }
.ob-fade-leave-active { transition: opacity 0.2s ease; }
.ob-fade-enter-from, .ob-fade-leave-to { opacity: 0; }

.ob-step-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.ob-step-leave-active { transition: opacity 0.15s ease; }
.ob-step-enter-from  { opacity: 0; transform: translateX(10px); }
.ob-step-leave-to    { opacity: 0; }
</style>
