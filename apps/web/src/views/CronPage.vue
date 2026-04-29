<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { CalendarClock, RefreshCw } from 'lucide-vue-next';
import type { AgentListItem, CronJobItem, CronRunRecord } from '@familyco/ui';

import { uiRuntime } from '../runtime';
import { useI18n } from '../composables/useI18n';
import { useToast } from '../plugins/toast.plugin';
import { parseApiError } from '../utils/api-error';

const { t } = useI18n();
const toast = useToast();

const isLoading = ref(false);
const isRefreshing = ref(false);
const isSaving = ref(false);
const deletingId = ref<string | null>(null);
const loadingHistoryId = ref<string | null>(null);

const jobs = ref<CronJobItem[]>([]);
const runs = ref<CronRunRecord[]>([]);
const selectedJobId = ref<string | null>(null);
const agents = ref<AgentListItem[]>([]);
const editingId = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const showForm = ref(false);

const form = reactive<{
  name: string;
  prompt: string;
  schedule: string;
  agentId: string;
  enabled: boolean;
}>({
  name: '',
  prompt: '',
  schedule: '0 7 * * *',
  agentId: '',
  enabled: true
});

const selectedJob = computed(() => jobs.value.find((job) => job.id === selectedJobId.value) ?? null);

const resetForm = (): void => {
  editingId.value = null;
  form.name = '';
  form.prompt = '';
  form.schedule = '0 7 * * *';
  form.agentId = '';
  form.enabled = true;
};

const openCreateForm = (): void => {
  resetForm();
  showForm.value = true;
};

const closeForm = (): void => {
  resetForm();
  showForm.value = false;
};

const loadAgents = async (): Promise<void> => {
  agents.value = await uiRuntime.api.listAgents();
};

const loadJobs = async (): Promise<void> => {
  jobs.value = await uiRuntime.api.listCronJobs();
};

const loadHistory = async (jobId: string): Promise<void> => {
  selectedJobId.value = jobId;
  loadingHistoryId.value = jobId;
  try {
    runs.value = await uiRuntime.api.listCronRuns(jobId, { limit: 50 });
  } finally {
    loadingHistoryId.value = null;
  }
};

const refresh = async (): Promise<void> => {
  isRefreshing.value = true;
  errorMessage.value = null;
  try {
    await loadJobs();
    if (selectedJobId.value) {
      await loadHistory(selectedJobId.value);
    }
  } catch (error) {
    const parsed = parseApiError(error);
    errorMessage.value = parsed.message || t('Failed to load cron jobs');
  } finally {
    isRefreshing.value = false;
  }
};

const selectForEdit = (job: CronJobItem): void => {
  editingId.value = job.id;
  form.name = job.name;
  form.prompt = job.prompt;
  form.schedule = job.schedule;
  form.agentId = job.agentId;
  form.enabled = job.enabled;
  showForm.value = true;
};

const removeJob = async (job: CronJobItem): Promise<void> => {
  if (!window.confirm(t('Delete cron confirm', { name: job.name }))) {
    return;
  }

  deletingId.value = job.id;
  try {
    await uiRuntime.api.deleteCronJob(job.id);
    if (selectedJobId.value === job.id) {
      selectedJobId.value = null;
      runs.value = [];
    }
    if (editingId.value === job.id) {
      resetForm();
    }
    await loadJobs();
    toast.success(t('Cron deleted'));
  } catch (error) {
    const parsed = parseApiError(error);
    toast.error(parsed.message || t('Failed to delete cron job'));
  } finally {
    deletingId.value = null;
  }
};

const saveJob = async (): Promise<void> => {
  isSaving.value = true;
  try {
    if (editingId.value) {
      await uiRuntime.api.updateCronJob({
        cronId: editingId.value,
        name: form.name,
        prompt: form.prompt,
        schedule: form.schedule,
        enabled: form.enabled,
        ...(form.agentId.trim() ? { agentId: form.agentId.trim() } : {})
      });
      toast.success(t('Cron updated'));
    } else {
      await uiRuntime.api.createCronJob({
        name: form.name,
        prompt: form.prompt,
        schedule: form.schedule,
        enabled: form.enabled,
        ...(form.agentId.trim() ? { agentId: form.agentId.trim() } : {})
      });
      toast.success(t('Cron created'));
    }

    await loadJobs();
    if (selectedJobId.value) {
      await loadHistory(selectedJobId.value);
    }
    closeForm();
  } catch (error) {
    const parsed = parseApiError(error);
    toast.error(parsed.message || t('Failed to save cron job'));
  } finally {
    isSaving.value = false;
  }
};

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const formatJson = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? '');
  }
};

onMounted(async () => {
  isLoading.value = true;
  errorMessage.value = null;
  try {
    await Promise.all([loadAgents(), loadJobs()]);
  } catch (error) {
    const parsed = parseApiError(error);
    errorMessage.value = parsed.message || t('Failed to load cron jobs');
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>{{ t('Cron') }}</h3>
        <p>{{ t('Manage recurring requests, schedules, and run history.') }}</p>
      </div>
      <div class="fc-inline-actions">
        <button class="fc-btn-secondary" :disabled="isRefreshing" @click="refresh">
          <RefreshCw :size="14" :class="{ 'fc-spin': isRefreshing }" />
          {{ isRefreshing ? t('Refreshing…') : t('Refresh') }}
        </button>
        <button v-if="!showForm" class="fc-btn-primary" @click="openCreateForm">
          {{ t('New cron') }}
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="fc-loading">
      <p style="margin: 0">{{ t('Loading cron jobs…') }}</p>
    </div>

    <div v-else-if="errorMessage" class="fc-error">
      <p>{{ errorMessage }}</p>
      <button class="fc-btn-secondary" @click="refresh">{{ t('Retry') }}</button>
    </div>

    <template v-else>
      <article v-if="showForm" class="fc-card" style="margin-bottom: 16px;">
        <h4 class="fc-card-title">{{ editingId ? t('Edit cron') : t('New cron') }}</h4>
        <p class="fc-card-desc">{{ t('Use a 5-field cron expression: minute hour day month weekday.') }}</p>
        <div style="display: grid; gap: 10px; margin-top: 12px;">
          <input v-model="form.name" class="fc-input" :placeholder="t('Cron name')" />
          <input v-model="form.schedule" class="fc-input" :placeholder="t('Cron schedule')" />
          <select v-model="form.agentId" class="fc-input">
            <option value="">{{ t('Default executive agent') }}</option>
            <option v-for="agent in agents" :key="agent.id" :value="agent.id">
              {{ agent.name }} ({{ agent.level }})
            </option>
          </select>
          <textarea
            v-model="form.prompt"
            class="fc-textarea"
            rows="4"
            :placeholder="t('Prompt to execute on each run')"
          />
          <label style="display:flex; align-items:center; gap:8px;">
            <input v-model="form.enabled" type="checkbox" />
            <span>{{ t('Enabled') }}</span>
          </label>
          <div class="fc-inline-actions">
            <button class="fc-btn-primary" :disabled="isSaving" @click="saveJob">
              {{ isSaving ? t('Saving…') : editingId ? t('Update') : t('Create') }}
            </button>
            <button class="fc-btn-secondary" :disabled="isSaving" @click="closeForm">
              {{ t('Cancel') }}
            </button>
          </div>
        </div>
      </article>

      <div v-if="jobs.length === 0" class="fc-empty">
        <CalendarClock :size="22" class="fc-empty-icon" />
        <h4>{{ t('No cron jobs') }}</h4>
        <p>{{ t('Manage recurring requests, schedules, and run history.') }}</p>
      </div>

      <article v-else class="fc-card" style="margin-bottom: 16px;">
        <table class="fc-budget-table">
          <thead>
            <tr>
              <th>{{ t('Name') }}</th>
              <th>{{ t('Schedule') }}</th>
              <th>{{ t('State') }}</th>
              <th>{{ t('Next run') }}</th>
              <th>{{ t('Actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in jobs" :key="job.id">
              <td>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <strong>{{ job.name }}</strong>
                  <span class="fc-list-meta">{{ job.prompt }}</span>
                </div>
              </td>
              <td><code>{{ job.schedule }}</code></td>
              <td>
                <span class="fc-badge" :data-status="job.enabled ? 'active' : 'paused'">
                  {{ job.enabled ? t('Enabled') : t('Disabled') }}
                </span>
              </td>
              <td>{{ formatDateTime(job.nextRunAt) }}</td>
              <td>
                <div class="fc-inline-actions">
                  <button class="fc-btn-secondary" @click="selectForEdit(job)">{{ t('Edit') }}</button>
                  <button class="fc-btn-secondary" @click="loadHistory(job.id)">
                    {{ loadingHistoryId === job.id ? t('Loading…') : t('History') }}
                  </button>
                  <button class="fc-btn-danger" :disabled="deletingId === job.id" @click="removeJob(job)">
                    {{ deletingId === job.id ? t('Deleting…') : t('Delete') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </article>

      <article v-if="selectedJob" class="fc-card">
        <h4 class="fc-card-title">
          {{ t('Run history') }}: {{ selectedJob.name }}
        </h4>
        <p class="fc-card-desc">{{ t('Each run stores input/output and error details.') }}</p>
        <div v-if="runs.length === 0" class="fc-empty" style="margin-top: 12px;">
          <h4>{{ t('No run history yet') }}</h4>
        </div>
        <div v-else style="display: grid; gap: 10px; margin-top: 12px;">
          <article
            v-for="run in runs"
            :key="run.id"
            class="fc-message-card"
            style="display: grid; gap: 8px;"
          >
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <span class="fc-badge" :data-status="run.status === 'success' ? 'done' : 'error'">
                {{ run.status === 'success' ? t('Success') : t('Failed') }}
              </span>
              <small class="fc-list-meta">
                {{ t('Started at') }}: {{ formatDateTime(run.startedAt) }}
              </small>
            </div>
            <div style="display:grid; gap:8px;">
              <div>
                <strong>{{ t('Input') }}</strong>
                <pre class="cron-json">{{ formatJson(run.input) }}</pre>
              </div>
              <div v-if="run.output">
                <strong>{{ t('Output') }}</strong>
                <pre class="cron-json">{{ formatJson(run.output) }}</pre>
              </div>
              <div v-if="run.error">
                <strong>{{ t('Error') }}</strong>
                <pre class="cron-json">{{ formatJson(run.error) }}</pre>
              </div>
            </div>
          </article>
        </div>
      </article>
    </template>
  </section>
</template>

<style scoped>
.cron-json {
  margin: 6px 0 0;
  padding: 10px;
  background: var(--fc-surface-muted);
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-control-radius);
  font-size: 0.75rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
