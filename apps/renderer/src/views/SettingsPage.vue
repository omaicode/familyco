<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import {
  Settings, Sun, Moon, Monitor, Save, RefreshCw,
  CheckCircle2, AlertTriangle, X, Key, Server, Palette
} from 'lucide-vue-next';

import { applyRuntimeTheme, uiRuntime } from '../runtime';

type ThemePreference = 'system' | 'light' | 'dark';

const form = reactive({
  key: 'provider.defaultModel',
  value: 'gpt-5.3-codex'
});

const themePreference = ref<ThemePreference>('system');
const themeSaving = ref(false);
const settingSaving = ref(false);
const feedback = ref<{ type: 'success' | 'error'; text: string } | null>(null);

const parseThemePreference = (value: unknown): ThemePreference | null => {
  if (value === 'system' || value === 'light' || value === 'dark') return value;
  return null;
};

const setFeedback = (type: 'success' | 'error', text: string) => {
  feedback.value = { type, text };
  setTimeout(() => { if (feedback.value?.text === text) feedback.value = null; }, 4000);
};

const applyThemePreference = (preference: ThemePreference) => {
  const systemPrefersDark =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  uiRuntime.stores.app.applyThemePreference(preference, systemPrefersDark);
  applyRuntimeTheme();
};

const reload = async () => {
  feedback.value = null;
  await uiRuntime.stores.settings.load();
  const stored = uiRuntime.stores.settings.state.data.find(item => item.key === 'ui.theme.preference');
  themePreference.value = parseThemePreference(stored?.value) ?? 'system';
  applyThemePreference(themePreference.value);
};

const save = async () => {
  settingSaving.value = true;
  try {
    await uiRuntime.stores.settings.upsert({ key: form.key, value: form.value });
    setFeedback('success', 'Setting saved');
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to save setting');
  } finally {
    settingSaving.value = false;
  }
};

const saveThemePreference = async () => {
  themeSaving.value = true;
  feedback.value = null;
  try {
    applyThemePreference(themePreference.value);
    await uiRuntime.stores.settings.upsert({ key: 'ui.theme.preference', value: themePreference.value });
    setFeedback('success', 'Appearance saved');
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to save appearance');
  } finally {
    themeSaving.value = false;
  }
};

onMounted(async () => { await reload(); });
</script>

<template>
  <section>
    <!-- ── Header ──────────────────────────────────── -->
    <div class="fc-page-header">
      <div>
        <h3>Settings</h3>
        <p>Configure provider, appearance, and runtime preferences.</p>
      </div>
      <button class="fc-btn-secondary" @click="reload">
        <RefreshCw :size="14" />
        Refresh
      </button>
    </div>

    <!-- ── Feedback ─────────────────────────────────── -->
    <Transition name="fc-banner">
      <div
        v-if="feedback"
        class="fc-banner"
        :class="feedback.type === 'success' ? 'fc-banner-success' : 'fc-banner-error'"
        style="margin-bottom:14px;"
      >
        <component :is="feedback.type === 'success' ? CheckCircle2 : AlertTriangle" :size="15" />
        <span>{{ feedback.text }}</span>
        <button class="fc-btn-ghost fc-btn-icon" style="margin-left:auto;" @click="feedback = null">
          <X :size="12" />
        </button>
      </div>
    </Transition>

    <!-- ── Appearance ───────────────────────────────── -->
    <div class="fc-settings-section">
      <div class="fc-settings-section-header">
        <div style="display:flex;align-items:center;gap:8px;">
          <Palette :size="16" style="color:var(--fc-primary);" />
          <h4>Appearance</h4>
        </div>
        <p>Follow system theme or lock to light or dark mode.</p>
      </div>
      <div class="fc-settings-section-body">
        <div class="fc-theme-options" style="margin-bottom:16px;" role="radiogroup" aria-label="Theme preference">
          <!-- System -->
          <label
            class="fc-theme-option"
            :class="{ 'fc-theme-option-selected': themePreference === 'system' }"
            @click="themePreference = 'system'"
          >
            <input v-model="themePreference" type="radio" value="system" />
            <div class="fc-theme-preview fc-theme-preview-system"></div>
            <Monitor :size="14" />
            <span>System</span>
          </label>
          <!-- Light -->
          <label
            class="fc-theme-option"
            :class="{ 'fc-theme-option-selected': themePreference === 'light' }"
            @click="themePreference = 'light'"
          >
            <input v-model="themePreference" type="radio" value="light" />
            <div class="fc-theme-preview fc-theme-preview-light"></div>
            <Sun :size="14" />
            <span>Light</span>
          </label>
          <!-- Dark -->
          <label
            class="fc-theme-option"
            :class="{ 'fc-theme-option-selected': themePreference === 'dark' }"
            @click="themePreference = 'dark'"
          >
            <input v-model="themePreference" type="radio" value="dark" />
            <div class="fc-theme-preview fc-theme-preview-dark"></div>
            <Moon :size="14" />
            <span>Dark</span>
          </label>
        </div>

        <button class="fc-btn-primary fc-btn-sm" :disabled="themeSaving" @click="saveThemePreference">
          <Save :size="13" />
          {{ themeSaving ? 'Saving…' : 'Save appearance' }}
        </button>
      </div>
    </div>

    <!-- ── Provider settings ────────────────────────── -->
    <div class="fc-settings-section">
      <div class="fc-settings-section-header">
        <div style="display:flex;align-items:center;gap:8px;">
          <Key :size="16" style="color:var(--fc-primary);" />
          <h4>Provider configuration</h4>
        </div>
        <p>Set AI provider keys and model defaults.</p>
      </div>
      <div class="fc-settings-section-body">
        <div class="fc-form-grid" style="margin-bottom:12px;">
          <div class="fc-form-group">
            <label class="fc-label">Setting key</label>
            <input v-model="form.key" class="fc-input" placeholder="e.g. provider.defaultModel" />
          </div>
          <div class="fc-form-group">
            <label class="fc-label">Value</label>
            <input v-model="form.value" class="fc-input" placeholder="Setting value" />
          </div>
        </div>
        <button class="fc-btn-primary fc-btn-sm" :disabled="settingSaving" @click="save">
          <Save :size="13" />
          {{ settingSaving ? 'Saving…' : 'Save setting' }}
        </button>
      </div>
    </div>

    <!-- ── All settings list ────────────────────────── -->
    <div class="fc-settings-section">
      <div class="fc-settings-section-header">
        <div style="display:flex;align-items:center;gap:8px;">
          <Server :size="16" style="color:var(--fc-primary);" />
          <h4>All settings</h4>
        </div>
        <p>All stored configuration keys for this workspace.</p>
      </div>
      <div class="fc-settings-section-body">
        <div v-if="uiRuntime.stores.settings.state.data.length === 0" class="fc-empty" style="padding:24px;">
          <p style="margin:0; font-size:0.875rem;">No stored settings yet.</p>
        </div>
        <div v-else style="display:flex;flex-direction:column;gap:0;">
          <div
            v-for="setting in uiRuntime.stores.settings.state.data"
            :key="setting.key"
            class="fc-settings-row"
          >
            <div class="fc-settings-row-label">
              <strong>{{ setting.key }}</strong>
              <span>{{ typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
@keyframes fc-banner-in { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
.fc-banner-enter-active { animation: fc-banner-in 0.25s ease; }
.fc-banner-leave-active { transition: opacity 0.2s; }
.fc-banner-leave-to    { opacity: 0; }
</style>
