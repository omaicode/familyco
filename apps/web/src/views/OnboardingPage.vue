<script setup lang="ts">
import type { SupportedLocale } from '@familyco/ui';
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  Building2, FolderOpen, Key, Users, CheckCircle2, ChevronRight, ChevronLeft,
  AlertTriangle, ArrowRight, Sparkles, Zap
} from 'lucide-vue-next';
import FamilyCoIcon from '../assets/familyco-icon.svg';
import FcButton from '../components/FcButton.vue';
import FcInput from '../components/FcInput.vue';
import FcTextarea from '../components/FcTextarea.vue';
import OnboardingProviderStep from '../components/onboarding/OnboardingProviderStep.vue';

import { uiRuntime } from '../runtime';
import { useI18n } from '../composables/useI18n';

const router = useRouter();
const { locale, setLocale, supportedLocales, t } = useI18n();

const currentStep = ref(1);
const TOTAL_STEPS = 5;
const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const done = ref(false);
const stepStageRef = ref<HTMLElement | null>(null);
const previousStepHeight = ref<number | null>(null);
let stepHeightCleanupTimer: ReturnType<typeof setTimeout> | null = null;

const createdResult = ref<{ executiveName: string; description: string } | null>(null);

// ── Folder picker state ──────────────────────────────────
const isBrowsing = ref(false);
const isDesktop = typeof window !== 'undefined' && typeof (window as unknown as Record<string, unknown>).familycoDesktop === 'object';

const form = reactive({
  companyName: '',
  companyDescription: '',
  workspacePath: ''
});

const providerSetup = reactive({
  ready: false,
  primaryProviderId: '',
  primaryProviderName: '',
  primaryModel: ''
});

const canNext = computed(() => {
  if (currentStep.value === 2) {
    return form.companyName.trim().length > 0 && form.companyDescription.trim().length > 0;
  }

  if (currentStep.value === 3) return form.workspacePath.trim().length > 0;
  if (currentStep.value === 4) return providerSetup.ready;
  return true;
});

const browseWorkspace = async () => {
  if (!isDesktop) return;
  isBrowsing.value = true;
  try {
    const desktop = (window as unknown as Record<string, unknown>).familycoDesktop as { invoke: (channel: string, payload: Record<string, never>) => Promise<{ canceled: boolean; filePaths: string[] }> };
    const result = await desktop.invoke('desktop:dialog:open-directory', {});
    if (!result.canceled && result.filePaths.length > 0) {
      form.workspacePath = result.filePaths[0] ?? '';
    }
  } catch {
    // Ignore dialog errors
  } finally {
    isBrowsing.value = false;
  }
};

const next = () => { if (currentStep.value < TOTAL_STEPS) currentStep.value++; };
const prev = () => { if (currentStep.value > 1) currentStep.value--; };

const upsertSetting = async (key: string, value: string | number | boolean): Promise<void> => {
  await uiRuntime.stores.settings.upsert({ key, value });
};

const initialize = async () => {
  isSubmitting.value = true;
  errorMessage.value = null;
  try {
    if (!providerSetup.ready || !providerSetup.primaryProviderId || !providerSetup.primaryModel) {
      throw new Error(t('onboarding.provider.required'));
    }

    if (form.workspacePath.trim()) {
      await upsertSetting('workspace.path', form.workspacePath.trim());
    }
    const result = await uiRuntime.api.initializeSetup({
      companyName: form.companyName.trim(),
      companyDescription: form.companyDescription.trim(),
    });
    await upsertSetting('onboarding.complete', true);
    createdResult.value = {
      executiveName: result.executiveAgent.name,
      description: result.companyDescription,
    };
    done.value = true;
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Initialization failed. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
};

const goToDashboard = () => router.replace('/dashboard');

const handleLocaleChange = (event: Event): void => {
  const nextLocale = (event.target as HTMLSelectElement).value as SupportedLocale;
  void setLocale(nextLocale);
};

const handleProviderStateChange = (state: {
  ready: boolean;
  primaryProviderId: string | null;
  primaryProviderName: string | null;
  primaryModel: string | null;
}): void => {
  providerSetup.ready = state.ready;
  providerSetup.primaryProviderId = state.primaryProviderId ?? '';
  providerSetup.primaryProviderName = state.primaryProviderName ?? '';
  providerSetup.primaryModel = state.primaryModel ?? '';
};

const cleanupStepStageHeight = (): void => {
  if (!stepStageRef.value) {
    return;
  }

  stepStageRef.value.style.removeProperty('height');
  stepStageRef.value.style.removeProperty('overflow');
  stepStageRef.value.style.removeProperty('transition');

  if (stepHeightCleanupTimer) {
    clearTimeout(stepHeightCleanupTimer);
    stepHeightCleanupTimer = null;
  }
};

const handleStepBeforeLeave = (el: Element): void => {
  previousStepHeight.value = (el as HTMLElement).offsetHeight;
};

const handleStepEnter = (el: Element): void => {
  const stage = stepStageRef.value;
  if (!stage) {
    return;
  }

  const nextHeight = (el as HTMLElement).offsetHeight;
  const fromHeight = previousStepHeight.value ?? stage.getBoundingClientRect().height;

  if (Math.abs(fromHeight - nextHeight) < 1) {
    cleanupStepStageHeight();
    return;
  }

  stage.style.height = `${fromHeight}px`;
  stage.style.overflow = 'hidden';
  stage.style.transition = 'height 320ms cubic-bezier(0.22, 1, 0.36, 1)';

  requestAnimationFrame(() => {
    if (!stepStageRef.value) {
      return;
    }
    stepStageRef.value.style.height = `${nextHeight}px`;
  });

  stepHeightCleanupTimer = setTimeout(() => {
    cleanupStepStageHeight();
  }, 360);
};

const handleStepAfterEnter = (): void => {
  previousStepHeight.value = null;
  cleanupStepStageHeight();
};
</script>

<template>
  <div class="ob-shell">
    <!-- Brand watermark -->
    <div class="ob-brand">
      <FamilyCoIcon />
      <span>{{ t('FamilyCo') }}</span>
    </div>

    <label class="ob-locale-switch">
      <span>{{ t('Language') }}</span>
      <select class="ob-locale-select" :value="locale" @change="handleLocaleChange">
        <option v-for="option in supportedLocales" :key="option.value" :value="option.value">
          {{ option.nativeLabel }}
        </option>
      </select>
    </label>

    <!-- ── Success screen ─────────────────────────────── -->
    <Transition name="ob-fade" mode="out-in">
      <div v-if="done && createdResult" class="ob-card" style="text-align:center;">
        <div class="ob-success-icon">
          <CheckCircle2 :size="36" />
        </div>
        <h2 style="margin:0 0 8px;font-size:1.5rem;">{{ t("You're all set!") }}</h2>
        <p style="margin:0 0 24px;color:var(--fc-text-muted);font-size:0.9375rem;line-height:1.6;">
          {{ t('Executive ready message', { name: createdResult.executiveName }) }}
          <span v-if="createdResult.description"> {{ t('Description') }}: {{ createdResult.description }}</span>
        </p>
        <FcButton class="ob-btn-primary ob-btn-lg" variant="primary" style="width:100%;" @click="goToDashboard">
          {{ t('Open Executive Chat') }} <ArrowRight :size="16" />
        </FcButton>
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

        <div ref="stepStageRef" class="ob-step-stage">
          <Transition
            name="ob-step"
            mode="out-in"
            @before-leave="handleStepBeforeLeave"
            @enter="handleStepEnter"
            @after-enter="handleStepAfterEnter"
          >
            <div :key="`step-${currentStep}`" class="ob-step-body">
            <!-- ── Step 1: Welcome ──────────────────────── -->
            <template v-if="currentStep === 1">
            <div class="ob-step-icon ob-step-icon-primary">
              <Sparkles :size="28" />
            </div>
            <h2 class="ob-title">{{ t('Welcome to FamilyCo') }}</h2>
            <p class="ob-subtitle">
              {{ t('Your AI-powered operating system for managing teams, tasks, and workflows.') }}<br />
              {{ t("Let's take 2 minutes to set up your workspace.") }}
            </p>

            <div class="ob-feature-list">
              <div class="ob-feature-item">
                <Building2 :size="16" style="color:var(--fc-primary);flex-shrink:0;" />
                <span>{{ t('Create your company and first executive agent') }}</span>
              </div>
              <div class="ob-feature-item">
                <Key :size="16" style="color:var(--fc-primary);flex-shrink:0;" />
                <span>{{ t('Connect your AI provider') }}</span>
              </div>
              <div class="ob-feature-item">
                <Users :size="16" style="color:var(--fc-primary);flex-shrink:0;" />
                <span>{{ t('Describe what your company does and how the executive should understand it') }}</span>
              </div>
            </div>

            <!-- <div class="ob-starter-list">
              <div class="ob-starter-head">
                <strong>{{ t('Try these first with your L0 executive') }}</strong>
                <p>{{ t('Use these starter workflows so the workspace does not feel empty on day one.') }}</p>
              </div>

              <article class="ob-starter-card">
                <strong>{{ t('Review this week') }}</strong>
                <p>{{ t('Ask the executive to review this week\'s priorities, blockers, and approvals that need your decision.') }}</p>
              </article>

              <article class="ob-starter-card">
                <strong>{{ t('Prepare content plan') }}</strong>
                <p>{{ t('Ask for a short content plan, campaign ideas, or a publishing checklist based on your company description.') }}</p>
              </article>

              <article class="ob-starter-card">
                <strong>{{ t('Check dev tasks') }}</strong>
                <p>{{ t('Ask the executive to inspect current projects and suggest the next engineering tasks to create today.') }}</p>
              </article>
            </div> -->

            <FcButton class="ob-btn-primary ob-btn-lg" variant="primary" style="width:100%;margin-top:8px;" @click="next">
              {{ t('Get started') }} <ChevronRight :size="16" />
            </FcButton>
            </template>

            <!-- ── Step 2: Company info ─────────────────── -->
            <template v-else-if="currentStep === 2">
            <div class="ob-step-icon ob-step-icon-info">
              <Building2 :size="28" />
            </div>
            <h2 class="ob-title">{{ t('Company details') }}</h2>
            <p class="ob-subtitle">{{ t('Name your company and add one clear description so the executive agent understands the business context from day one.') }}</p>

            <div class="ob-form-group">
              <label class="ob-label">{{ t('Company name') }} <span class="ob-required">*</span></label>
              <FcInput
                v-model="form.companyName"
                class="ob-input"
                placeholder="e.g. Acme Corp"
                maxlength="80"
                autofocus
              />
            </div>

            <div class="ob-form-group">
              <label class="ob-label">{{ t('Company description') }} <span class="ob-required">*</span></label>
              <FcTextarea
                v-model="form.companyDescription"
                class="ob-input"
                :rows="4"
                placeholder="e.g. We help founders run company operations with AI-native execution, approval safety, and fast delivery."
              />
              <p class="ob-hint">{{ t('Keep it concise but concrete so the executive has enough context for planning and tool use.') }}</p>
            </div>

            <div class="ob-actions">
              <FcButton class="ob-btn-ghost" variant="ghost" @click="prev">
                <ChevronLeft :size="16" /> {{ t('Back') }}
              </FcButton>
              <FcButton class="ob-btn-primary" variant="primary" :disabled="!canNext" @click="next">
                {{ t('Next') }} <ChevronRight :size="16" />
              </FcButton>
            </div>
            </template>

            <!-- ── Step 3: Workspace ───────────────────── -->
            <template v-else-if="currentStep === 3">
            <div class="ob-step-icon ob-step-icon-warning">
              <FolderOpen :size="28" />
            </div>
            <h2 class="ob-title">{{ t('workspace.step.title') }}</h2>
            <p class="ob-subtitle">{{ t('workspace.step.subtitle') }}</p>

            <div class="ob-form-group">
              <label class="ob-label">{{ t('workspace.path.label') }} <span class="ob-required">*</span></label>

              <!-- Electron: native folder dialog -->
              <template v-if="isDesktop">
                <button
                  type="button"
                  class="ob-btn-folder-pick"
                  :disabled="isBrowsing"
                  @click="browseWorkspace"
                >
                  <FolderOpen :size="18" />
                  <span v-if="isBrowsing">{{ t('Browsing…') }}</span>
                  <span v-else-if="form.workspacePath">{{ t('workspace.change.btn') }}</span>
                  <span v-else>{{ t('workspace.choose.btn') }}</span>
                </button>
                <div v-if="form.workspacePath" class="ob-path-display">
                  <CheckCircle2 :size="13" style="color:var(--fc-success);flex-shrink:0;" />
                  <code>{{ form.workspacePath }}</code>
                </div>
              </template>

              <!-- Web: manual path input -->
              <template v-else>
                <div class="ob-input-group">
                  <FolderOpen :size="15" class="ob-input-icon" />
                  <FcInput
                    v-model="form.workspacePath"
                    class="ob-input ob-input-with-icon"
                    :placeholder="t('workspace.path.placeholder')"
                    spellcheck="false"
                    autocomplete="off"
                  />
                </div>
                <div v-if="form.workspacePath" class="ob-path-display">
                  <CheckCircle2 :size="13" style="color:var(--fc-success);flex-shrink:0;" />
                  <code>{{ form.workspacePath }}</code>
                </div>
              </template>

              <p class="ob-hint">{{ t('workspace.path.hint') }}</p>
            </div>

            <div class="ob-actions">
              <FcButton class="ob-btn-ghost" variant="ghost" @click="prev">
                <ChevronLeft :size="16" /> {{ t('Back') }}
              </FcButton>
              <FcButton class="ob-btn-primary" variant="primary" :disabled="!canNext" @click="next">
                {{ t('Next') }} <ChevronRight :size="16" />
              </FcButton>
            </div>
            </template>

            <!-- ── Step 4: AI Provider ──────────────────── -->
            <template v-else-if="currentStep === 4">
            <div class="ob-step-icon ob-step-icon-accent">
              <Key :size="28" />
            </div>
            <h2 class="ob-title">{{ t('Connect AI adapter') }}</h2>
            <p class="ob-subtitle">{{ t('onboarding.provider.subtitle') }}</p>

            <OnboardingProviderStep
              :is-desktop-runtime="isDesktop"
              @state-change="handleProviderStateChange"
            />

            <div class="ob-actions">
              <FcButton class="ob-btn-ghost" variant="ghost" @click="prev">
                <ChevronLeft :size="16" /> {{ t('Back') }}
              </FcButton>
              <FcButton class="ob-btn-primary" variant="primary" :disabled="!canNext" @click="next">
                {{ t('Next') }} <ChevronRight :size="16" />
              </FcButton>
            </div>
            </template>

            <!-- ── Step 5: Review & Initialize ─────────── -->
            <template v-else>
            <div class="ob-step-icon ob-step-icon-success">
              <Users :size="28" />
            </div>
            <h2 class="ob-title">{{ t('Review & launch') }}</h2>
            <p class="ob-subtitle">{{ t('Everything looks good. Click initialize to create your workspace with one mandatory L0 executive agent.') }}</p>

            <!-- Summary -->
            <div class="ob-summary">
              <div class="ob-summary-row">
                <span class="ob-summary-label">{{ t('Company') }}</span>
                <span class="ob-summary-value">{{ form.companyName }}</span>
              </div>
              <div class="ob-summary-row">
                <span class="ob-summary-label">{{ t('Description') }}</span>
                <span class="ob-summary-value">{{ form.companyDescription || t('Not provided yet') }}</span>
              </div>
              <div class="ob-summary-row">
                <span class="ob-summary-label">{{ t('workspace.path.label') }}</span>
                <span class="ob-summary-value" style="word-break:break-all;">{{ form.workspacePath || t('Not provided yet') }}</span>
              </div>
              <div class="ob-summary-row">
                <span class="ob-summary-label">{{ t('AI provider') }}</span>
                <span class="ob-summary-value">{{ providerSetup.primaryProviderName || t('Not provided yet') }}</span>
              </div>
              <div class="ob-summary-row">
                <span class="ob-summary-label">{{ t('Default model') }}</span>
                <span class="ob-summary-value">{{ providerSetup.primaryModel || t('Not provided yet') }}</span>
              </div>
              <div class="ob-summary-row">
                <span class="ob-summary-label">{{ t('Agents created') }}</span>
                <span class="ob-summary-value">{{ t('1 executive (L0) only — extra roles stay optional until approval.') }}</span>
              </div>
            </div>

            <!-- Error -->
            <div v-if="errorMessage" class="ob-error">
              <AlertTriangle :size="15" style="flex-shrink:0;" />
              <span>{{ errorMessage }}</span>
            </div>

            <div class="ob-actions">
              <FcButton class="ob-btn-ghost" variant="ghost" :disabled="isSubmitting" @click="prev">
                <ChevronLeft :size="16" /> {{ t('Back') }}
              </FcButton>
              <FcButton class="ob-btn-primary" variant="primary" :disabled="isSubmitting" @click="initialize">
                <Zap :size="15" />
                {{ isSubmitting ? t('Initializing…') : t('Initialize workspace') }}
              </FcButton>
            </div>
            </template>
            </div>
          </Transition>
        </div>
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
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.ob-locale-switch {
  position: absolute;
  top: 16px;
  right: 24px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: 999px;
  background: var(--fc-surface);
  color: var(--fc-text-muted);
  font-size: 0.8125rem;
}

.ob-locale-select {
  border: none;
  background: transparent;
  color: var(--fc-text-main);
  font: inherit;
  outline: none;
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
  will-change: transform, opacity;
}

.ob-step-stage {
  position: relative;
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

.ob-step-icon-warning {
  background: color-mix(in srgb, var(--fc-info) 12%, var(--fc-surface));
  border-color: color-mix(in srgb, var(--fc-info) 25%, var(--fc-border-subtle));
  color: var(--fc-info);
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

.ob-starter-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.ob-starter-head strong {
  font-size: 0.87rem;
}

.ob-starter-head p,
.ob-starter-card p {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--fc-text-muted);
}

.ob-starter-card {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--fc-border-subtle);
  background: color-mix(in srgb, var(--fc-primary) 3%, var(--fc-surface));
}

.ob-starter-card strong {
  font-size: 0.85rem;
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

/* ── Folder picker button ─────────────────────────────── */
.ob-btn-folder-pick {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 11px 14px;
  border: 1.5px dashed var(--fc-border-subtle);
  border-radius: 8px;
  background: var(--fc-surface);
  color: var(--fc-primary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.ob-btn-folder-pick:hover:not(:disabled) {
  border-color: var(--fc-primary);
  background: color-mix(in srgb, var(--fc-primary) 5%, var(--fc-surface));
}
.ob-btn-folder-pick:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Path display ─────────────────────────────────────── */
.ob-path-display {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--fc-success) 8%, var(--fc-surface));
  border: 1px solid color-mix(in srgb, var(--fc-success) 20%, var(--fc-border-subtle));
  font-size: 0.8125rem;
  word-break: break-all;
}
.ob-path-display code { font-size: 0.8rem; color: var(--fc-text-main); }
.ob-path-muted {
  background: color-mix(in srgb, var(--fc-warning) 8%, var(--fc-surface));
  border-color: color-mix(in srgb, var(--fc-warning) 20%, var(--fc-border-subtle));
  color: var(--fc-text-muted);
}

/* ── Input with icon ──────────────────────────────────── */
.ob-input-group {
  position: relative;
  display: flex;
  align-items: center;
}
.ob-input-icon {
  position: absolute;
  left: 12px;
  color: var(--fc-text-muted);
  pointer-events: none;
}
.ob-input-with-icon {
  padding-left: 36px;
}

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

.ob-step-enter-active,
.ob-step-leave-active {
  transition: opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1), transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.ob-step-enter-from {
  opacity: 0;
  transform: translateX(18px) scale(0.995);
}

.ob-step-leave-to {
  opacity: 0;
  transform: translateX(-14px) scale(0.995);
}
</style>
