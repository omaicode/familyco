<script setup lang="ts">
import type { TaskListItem } from '@familyco/ui';
import { ClipboardList } from 'lucide-vue-next';

import { useI18n } from '../../composables/useI18n';
import FcBadge from '../FcBadge.vue';

const props = defineProps<{
  tasks: TaskListItem[];
  selectedTask: TaskListItem | null;
  selectedTaskId: string | null;
  isLoading: boolean;
  errorMessage: string | null;
  getProjectName: (projectId: string) => string;
  formatRelative: (iso: string) => string;
  formatTimestamp: (iso: string) => string;
}>();

const emit = defineEmits<{
  (event: 'select-task', taskId: string): void;
}>();

const { t } = useI18n();

const TASK_STATUS_LABELS: Record<TaskListItem['status'], string> = {
  pending: 'Pending', in_progress: 'In progress', review: 'In review', done: 'Done', blocked: 'Blocked', cancelled: 'Cancelled'
};
const TASK_PRIORITY_LABELS: Record<TaskListItem['priority'], string> = {
  low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent'
};

const getStatusLabel = (status: TaskListItem['status']): string => t(TASK_STATUS_LABELS[status]);
const getPriorityLabel = (priority: TaskListItem['priority']): string => t(TASK_PRIORITY_LABELS[priority]);
const getUpdatedLabel = (iso: string): string => t('updated {{time}}', { time: props.formatRelative(iso) });
</script>

<template>
  <section class="ag-subsection">
    <div class="ag-subsection-head">
      <div>
        <h5>{{ t('Current workload') }}</h5>
        <p>{{ t('Review the tasks this agent is actively handling and inspect the live brief.') }}</p>
      </div>
      <ClipboardList :size="16" class="ag-muted-icon" />
    </div>

    <div v-if="isLoading" class="ag-empty-state">
      <p>{{ t('Loading agent tasks…') }}</p>
    </div>

    <div v-else-if="errorMessage" class="fc-warning">
      <p>{{ errorMessage }}</p>
    </div>

    <div v-else-if="tasks.length === 0" class="fc-empty ag-empty-state">
      <h4>{{ t('No active tasks yet') }}</h4>
      <p>{{ t('This agent has no current assignments in progress right now.') }}</p>
    </div>

    <div v-else class="ag-task-layout">
      <div class="ag-task-list">
        <button
          v-for="task in tasks"
          :key="task.id"
          type="button"
          class="ag-task-row"
          :class="{ 'is-selected': task.id === selectedTaskId }"
          @click="emit('select-task', task.id)"
        >
          <div class="ag-task-row-top">
            <strong>{{ task.title }}</strong>
            <FcBadge :status="task.status">{{ getStatusLabel(task.status) }}</FcBadge>
          </div>
          <p class="fc-list-meta">{{ getProjectName(task.projectId) }} · {{ getPriorityLabel(task.priority) }}</p>
          <p class="ag-task-row-meta">{{ getUpdatedLabel(task.updatedAt) }}</p>
        </button>
      </div>

      <div v-if="selectedTask" class="ag-task-detail">
        <div class="ag-task-detail-head">
          <div>
            <h6>{{ selectedTask.title }}</h6>
            <p>{{ getProjectName(selectedTask.projectId) }}</p>
          </div>
          <FcBadge :status="selectedTask.priority">{{ getPriorityLabel(selectedTask.priority) }}</FcBadge>
        </div>

        <p class="ag-task-description">{{ selectedTask.description || t('No task brief provided yet.') }}</p>

        <dl class="ag-task-facts">
          <div>
            <dt>{{ t('Status') }}</dt>
            <dd>{{ getStatusLabel(selectedTask.status) }}</dd>
          </div>
          <div>
            <dt>{{ t('Priority') }}</dt>
            <dd>{{ getPriorityLabel(selectedTask.priority) }}</dd>
          </div>
          <div>
            <dt>{{ t('Created') }}</dt>
            <dd :title="formatTimestamp(selectedTask.createdAt)">{{ formatRelative(selectedTask.createdAt) }}</dd>
          </div>
          <div>
            <dt>{{ t('Last update') }}</dt>
            <dd :title="formatTimestamp(selectedTask.updatedAt)">{{ formatRelative(selectedTask.updatedAt) }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ag-subsection {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-control-radius);
  background: var(--fc-surface-muted);
}

.ag-subsection-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.ag-subsection-head h5 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
}
.ag-subsection-head p {
  margin: 4px 0 0;
  font-size: 0.78rem;
  color: var(--fc-text-muted);
}

.ag-muted-icon {
  color: var(--fc-text-faint);
  flex-shrink: 0;
}

.ag-empty-state {
  padding: 16px;
}

.ag-task-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
  gap: 10px;
}

.ag-task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ag-task-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--fc-control-radius);
  border: 1px solid var(--fc-border-subtle);
  background: var(--fc-surface);
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.ag-task-row:hover,
.ag-task-row.is-selected {
  border-color: color-mix(in srgb, var(--fc-primary) 35%, var(--fc-border-subtle));
  box-shadow: 0 4px 10px rgba(16, 24, 40, 0.05);
}

.ag-task-row-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.ag-task-row-top strong {
  font-size: 0.84rem;
  line-height: 1.35;
}

.ag-task-row-meta {
  margin: 0;
  font-size: 0.74rem;
  color: var(--fc-text-muted);
}

.ag-task-detail {
  padding: 12px;
  border-radius: var(--fc-control-radius);
  border: 1px solid var(--fc-border-subtle);
  background: var(--fc-surface);
}

.ag-task-detail-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.ag-task-detail-head h6 {
  margin: 0;
  font-size: 0.92rem;
}
.ag-task-detail-head p {
  margin: 4px 0 0;
  font-size: 0.76rem;
  color: var(--fc-text-muted);
}

.ag-task-description {
  margin: 12px 0;
  font-size: 0.82rem;
  line-height: 1.55;
  white-space: pre-wrap;
}

.ag-task-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.ag-task-facts div {
  padding: 8px 10px;
  border-radius: var(--fc-control-radius);
  background: var(--fc-surface-muted);
}

.ag-task-facts dt {
  margin: 0 0 4px;
  font-size: 0.72rem;
  color: var(--fc-text-muted);
}

.ag-task-facts dd {
  margin: 0;
  font-size: 0.8rem;
}

@media (max-width: 980px) {
  .ag-task-layout,
  .ag-task-facts { grid-template-columns: 1fr; }
}
</style>
