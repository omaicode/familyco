<script setup lang="ts">
import { reactive, ref } from 'vue';

import { uiRuntime } from '../runtime';

const form = reactive({
  companyName: 'FamilyCo',
  departmentsText: 'Operations,Marketing,Research'
});
const created = ref<null | { executiveName: string; departmentCount: number }>(null);
const errorMessage = ref<string | null>(null);
const isSubmitting = ref(false);

const runSetup = async () => {
  isSubmitting.value = true;
  errorMessage.value = null;

  try {
    const departments = form.departmentsText
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const result = await uiRuntime.api.initializeSetup({
      companyName: form.companyName,
      departments
    });

    created.value = {
      executiveName: result.executiveAgent.name,
      departmentCount: result.departmentAgents.length
    };
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Setup initialization failed';
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>Workspace Setup</h3>
        <p>Initialize your first executive and department agents.</p>
      </div>
    </div>

    <article class="fc-card">
      <h4 style="margin-top: 0">Initialize company</h4>
      <div class="fc-form-grid">
        <input v-model="form.companyName" class="fc-input" placeholder="Company name" />
        <input
          v-model="form.departmentsText"
          class="fc-input"
          placeholder="Departments (comma separated)"
        />
      </div>
      <div class="fc-toolbar" style="margin-top: 10px">
        <button class="fc-btn-primary" :disabled="isSubmitting" @click="runSetup">
          {{ isSubmitting ? 'Initializing...' : 'Initialize setup' }}
        </button>
      </div>

      <p v-if="errorMessage" class="fc-error" style="margin-top: 12px">{{ errorMessage }}</p>
      <p v-if="created" class="fc-list-meta" style="margin-top: 12px">
        Created executive {{ created.executiveName }} with {{ created.departmentCount }} department agents.
      </p>
    </article>
  </section>
</template>
