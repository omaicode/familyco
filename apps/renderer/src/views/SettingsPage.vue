<script setup lang="ts">
import { onMounted, reactive } from 'vue';

import { uiRuntime } from '../runtime';

const form = reactive({
  key: 'provider.defaultModel',
  value: 'gpt-5.3-codex'
});

const reload = async () => {
  await uiRuntime.stores.settings.load();
};

const save = async () => {
  await uiRuntime.stores.settings.upsert({
    key: form.key,
    value: form.value
  });
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
