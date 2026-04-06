<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Zap, Building2, Users, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-vue-next';

import { uiRuntime } from '../runtime';

const form = reactive({
  companyName: 'FamilyCo',
  departmentsText: 'Operations,Marketing,Research'
});

const created = ref<null | { executiveName: string; templateCount: number }>(null);
const errorMessage = ref<string | null>(null);
const isSubmitting = ref(false);

const runSetup = async () => {
  isSubmitting.value = true;
  errorMessage.value = null;

  try {
    const departments = form.departmentsText
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);

    const result = await uiRuntime.api.initializeSetup({ companyName: form.companyName, departments });
    created.value = { executiveName: result.executiveAgent.name, templateCount: result.departmentTemplates.length };
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
        <h3>Workspace setup</h3>
        <p>Initialize FamilyCo with one executive agent and optional future department templates.</p>
      </div>
    </div>

    <!-- ── Success state ────────────────────────────── -->
    <Transition name="fc-page">
      <div v-if="created" class="fc-card" style="text-align:center;padding:40px 32px;margin-bottom:16px;">
        <div style="width:60px;height:60px;border-radius:16px;background:color-mix(in srgb,var(--fc-success) 12%,var(--fc-surface));display:flex;align-items:center;justify-content:center;margin:0 auto 16px;border:1px solid color-mix(in srgb,var(--fc-success) 30%,var(--fc-border-subtle));">
          <CheckCircle2 :size="28" style="color:var(--fc-success);" />
        </div>
        <h4 style="margin:0 0 8px;font-size:1.125rem;">Workspace initialized</h4>
        <p class="fc-list-meta" style="margin:0 0 16px;">
          Executive agent <strong>{{ created.executiveName }}</strong> created with
          {{ created.templateCount }} optional department template{{ created.templateCount !== 1 ? 's' : '' }} saved for later approval.
        </p>
        <div class="fc-inline-actions" style="justify-content:center;">
          <RouterLink class="fc-btn-primary" to="/chat">
            Open executive chat <ArrowRight :size="14" />
          </RouterLink>
          <RouterLink class="fc-btn-secondary" to="/agents">
            View agents
          </RouterLink>
        </div>
      </div>
    </Transition>

    <template v-if="!created">
      <!-- ── How it works ──────────────────────────── -->
      <div class="fc-grid-kpi" style="margin-bottom:16px;grid-template-columns:repeat(3,minmax(0,1fr));">
        <article class="fc-kpi-card" data-highlight="primary">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <Zap :size="16" style="color:var(--fc-primary);" />
            <p class="fc-kpi-label" style="margin:0;">Step 1</p>
          </div>
          <p style="margin:0;font-size:0.875rem;font-weight:600;">Name your company</p>
          <p class="fc-kpi-sub">Sets the foundation for your AI organization.</p>
        </article>
        <article class="fc-kpi-card" data-highlight="info">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <Building2 :size="16" style="color:var(--fc-info);" />
            <p class="fc-kpi-label" style="margin:0;">Step 2</p>
          </div>
          <p style="margin:0;font-size:0.875rem;font-weight:600;">Define departments</p>
          <p class="fc-kpi-sub">These stay as optional templates until they are approved.</p>
        </article>
        <article class="fc-kpi-card" data-highlight="success">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <Users :size="16" style="color:var(--fc-success);" />
            <p class="fc-kpi-label" style="margin:0;">Step 3</p>
          </div>
          <p style="margin:0;font-size:0.875rem;font-weight:600;">Initialize agents</p>
          <p class="fc-kpi-sub">A single L0 executive is enough to start operating.</p>
        </article>
      </div>

      <!-- ── Setup form ────────────────────────────── -->
      <div class="fc-settings-section">
        <div class="fc-settings-section-header">
          <h4>Initialize workspace</h4>
          <p>This creates your executive (L0) and stores any future department ideas as templates only.</p>
        </div>
        <div class="fc-settings-section-body">
          <div class="fc-form-grid" style="margin-bottom:16px;">
            <div class="fc-form-group">
              <label class="fc-label">Company name</label>
              <input v-model="form.companyName" class="fc-input" placeholder="Your company name" />
            </div>
            <div class="fc-form-group">
              <label class="fc-label">Departments</label>
              <input
                v-model="form.departmentsText"
                class="fc-input"
                placeholder="Comma-separated department names"
              />
              <p class="fc-list-meta" style="margin:4px 0 0;">e.g. Operations, Marketing, Research — saved as optional templates only.</p>
            </div>
          </div>

          <div v-if="errorMessage" class="fc-banner fc-banner-error" style="margin-bottom:12px;">
            <AlertTriangle :size="14" />
            <span>{{ errorMessage }}</span>
          </div>

          <button
            class="fc-btn-primary"
            :disabled="isSubmitting || !form.companyName"
            @click="runSetup"
          >
            <Zap :size="15" />
            {{ isSubmitting ? 'Initializing workspace…' : 'Initialize workspace' }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>
