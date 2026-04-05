<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';

import { applyRuntimeTheme, uiRuntime } from '../runtime';

type ThemePreference = 'system' | 'light' | 'dark';

const form = reactive({
  key: 'provider.defaultModel',
  value: 'gpt-5.3-codex'
});

const themePreference = ref<ThemePreference>('system');
const themeSaving = ref(false);
const feedback = ref<string | null>(null);

const parseThemePreference = (value: unknown): ThemePreference | null => {
  if (value === 'system' || value === 'light' || value === 'dark') {
    return value;
  }

  return null;
};

const applyThemePreference = (preference: ThemePreference): void => {
  const systemPrefersDark =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  uiRuntime.stores.app.applyThemePreference(preference, systemPrefersDark);
  applyRuntimeTheme();
};

const reload = async () => {
  feedback.value = null;
  await uiRuntime.stores.settings.load();
  const stored = uiRuntime.stores.settings.state.data.find((item) => item.key === 'ui.theme.preference');
  themePreference.value = parseThemePreference(stored?.value) ?? 'system';
  applyThemePreference(themePreference.value);
};

const save = async () => {
  await uiRuntime.stores.settings.upsert({
    key: form.key,
    value: form.value
  });
  feedback.value = 'Setting saved';
};

const saveThemePreference = async (): Promise<void> => {
  themeSaving.value = true;
  feedback.value = null;

  try {
    applyThemePreference(themePreference.value);
    await uiRuntime.stores.settings.upsert({
      key: 'ui.theme.preference',
      value: themePreference.value
    });
    feedback.value = 'Theme preference saved';
  } finally {
    themeSaving.value = false;
  }
};

onMounted(async () => {
  await reload();
});
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>Settings</h3>
        <p>Configure provider and runtime preferences.</p>
      </div>
      <button class="fc-btn-secondary" @click="reload">Refresh</button>
    </div>

    <article class="fc-card" style="margin-bottom: 12px">
      <h4 style="margin-top: 0">Appearance</h4>
      <p class="fc-list-meta" style="margin-top: 0">Follow system theme by default, or override manually.</p>
      <div class="fc-inline-actions" role="radiogroup" aria-label="Theme preference">
        <label>
          <input v-model="themePreference" type="radio" value="system" /> System
        </label>
        <label>
          <input v-model="themePreference" type="radio" value="light" /> Light
        </label>
        <label>
          <input v-model="themePreference" type="radio" value="dark" /> Dark
        </label>
      </div>
      <div class="fc-toolbar" style="margin-top: 10px">
        <button class="fc-btn-primary" :disabled="themeSaving" @click="saveThemePreference">
          {{ themeSaving ? 'Saving...' : 'Save appearance' }}
        </button>
      </div>
    </article>

    <div v-if="feedback" class="fc-banner-success">{{ feedback }}</div>

    <article class="fc-card" style="margin-bottom: 12px">
      <h4 style="margin-top: 0">Upsert setting</h4>
      <div class="fc-form-grid">
        <input v-model="form.key" class="fc-input" placeholder="Setting key" />
        <input v-model="form.value" class="fc-input" placeholder="Setting value" />
      </div>
      <div class="fc-toolbar" style="margin-top: 10px">
        <button class="fc-btn-primary" @click="save">Save setting</button>
      </div>
    </article>

    <div v-if="uiRuntime.stores.settings.state.isLoading" class="fc-loading">Loading settings...</div>

    <div v-else-if="uiRuntime.stores.settings.state.errorMessage" class="fc-error">
      <p>{{ uiRuntime.stores.settings.state.errorMessage }}</p>
      <button class="fc-btn-secondary" @click="reload">Retry</button>
    </div>

    <div v-else-if="uiRuntime.stores.settings.state.isEmpty" class="fc-empty">
      <p>No settings saved yet.</p>
    </div>

    <article v-else class="fc-card">
      <ul class="fc-list">
        <li v-for="item in uiRuntime.stores.settings.state.data" :key="item.key" class="fc-list-item">
          <div>
            <strong>{{ item.key }}</strong>
            <p class="fc-list-meta">{{ item.value }}</p>
          </div>
        </li>
      </ul>
    </article>
  </section>
</template>
