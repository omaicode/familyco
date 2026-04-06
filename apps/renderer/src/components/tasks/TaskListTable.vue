<script setup lang="ts">
import type { TaskListItem } from '@familyco/ui';

import FcBadge from '../FcBadge.vue';
import FcButton from '../FcButton.vue';

defineProps<{
  tasks: TaskListItem[];
  allVisibleSelected: boolean;
  selectedTaskIds: string[];
  busyMap: Record<string, boolean>;
  allowedTransitions: Record<TaskListItem['status'], TaskListItem['status'][]>;
  getProjectName: (projectId: string) => string;
  getAgentName: (agentId: string | null | undefined) => string;
  formatPriority: (priority: TaskListItem['priority']) => string;
  formatStatus: (status: TaskListItem['status']) => string;
  formatRelative: (iso: string) => string;
}>();

const emit = defineEmits<{
  toggleSelectAll: [];
  toggleSelect: [taskId: string];
  move: [task: TaskListItem, status: TaskListItem['status']];
}>();

const formatTaskCode = (task: TaskListItem): string => `TASK-${task.id.slice(0, 8).toUpperCase()}`;

const summarizeDescription = (value: string): string => {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > 110 ? `${compact.slice(0, 107).trimEnd()}…` : compact;
};

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};
</script>

<template>
  <div class="task-table-header">
    <p class="task-table-summary">
      <strong>{{ tasks.length }}</strong>
      <span>{{ tasks.length === 1 ? 'task' : 'tasks' }}</span>
      <span class="task-table-summary-dot">•</span>
      <span>Sorted by newest created date</span>
    </p>
  </div>

  <div class="task-table-wrap">
    <table class="task-table">
      <thead>
        <tr>
          <th class="task-table-select-cell">
            <input
              :checked="allVisibleSelected"
              type="checkbox"
              class="fc-checkbox"
              @change="emit('toggleSelectAll')"
            />
          </th>
          <th>Task</th>
          <th>Project</th>
          <th>Assignee</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="task in tasks" :key="task.id">
          <td class="task-table-select-cell">
            <input
              :checked="selectedTaskIds.includes(task.id)"
              type="checkbox"
              class="fc-checkbox"
              @change="emit('toggleSelect', task.id)"
            />
          </td>
          <td class="task-table-main-cell">
            <span class="task-table-code">{{ formatTaskCode(task) }}</span>
            <strong class="task-table-title">{{ task.title }}</strong>
            <p class="task-table-brief">{{ summarizeDescription(task.description) || 'No execution brief yet.' }}</p>
          </td>
          <td class="task-table-project-cell">{{ getProjectName(task.projectId) }}</td>
          <td class="task-table-assignee-cell">{{ getAgentName(task.assigneeAgentId) }}</td>
          <td class="task-table-badge-cell">
            <FcBadge :status="task.status">{{ formatStatus(task.status) }}</FcBadge>
          </td>
          <td class="task-table-badge-cell">
            <span class="task-priority-pill" :data-priority="task.priority">
              {{ formatPriority(task.priority) }}
            </span>
          </td>
          <td class="task-table-time-cell" :title="formatDateTime(task.createdAt)">
            <strong>{{ formatRelative(task.createdAt) }}</strong>
            <span>{{ formatDateTime(task.createdAt) }}</span>
          </td>
          <td>
            <div v-if="allowedTransitions[task.status].length > 0" class="task-row-actions">
              <FcButton
                v-for="nextStatus in allowedTransitions[task.status].slice(0, 2)"
                :key="`${task.id}-${nextStatus}`"
                variant="secondary"
                size="sm"
                :disabled="busyMap[task.id] === true"
                @click="emit('move', task, nextStatus)"
              >
                {{ formatStatus(nextStatus) }}
              </FcButton>
            </div>
            <span v-else class="task-table-empty">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.task-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.task-table-summary {
  margin: 0;
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--fc-text-muted);
}

.task-table-summary strong {
  color: var(--fc-text-main);
}

.task-table-summary-dot {
  color: var(--fc-text-faint);
}

.task-table-wrap {
  overflow: auto;
  max-height: min(72vh, 820px);
  border: 1px solid color-mix(in srgb, var(--fc-border-subtle) 88%, transparent);
  border-radius: var(--fc-card-radius);
}

.task-table {
  width: 100%;
  min-width: 1040px;
  border-collapse: collapse;
  background: var(--fc-surface);
}

.task-table th,
.task-table td {
  text-align: left;
  vertical-align: top;
  padding: 10px 12px;
}

.task-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--fc-text-muted);
  background: color-mix(in srgb, var(--fc-surface) 92%, white);
  border-bottom: 1px solid var(--fc-border-subtle);
}

.task-table tbody tr + tr td {
  border-top: 1px solid color-mix(in srgb, var(--fc-border-subtle) 90%, transparent);
}

.task-table tbody tr:hover {
  background: color-mix(in srgb, var(--fc-primary) 4%, transparent);
}

.task-table-select-cell {
  width: 42px;
}

.task-table-main-cell {
  min-width: 300px;
}

.task-table-code {
  display: inline-block;
  margin-bottom: 4px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fc-text-muted);
}

.task-table-title {
  display: block;
  margin-bottom: 4px;
  font-size: 0.9rem;
  line-height: 1.4;
}

.task-table-brief {
  margin: 0;
  color: var(--fc-text-muted);
  font-size: 0.78rem;
  line-height: 1.45;
}

.task-table-project-cell,
.task-table-assignee-cell {
  min-width: 120px;
}

.task-table-badge-cell {
  white-space: nowrap;
}

.task-table-time-cell {
  min-width: 122px;
}

.task-table-time-cell strong,
.task-table-time-cell span {
  display: block;
}

.task-table-time-cell strong {
  font-size: 0.78rem;
  color: var(--fc-text-main);
}

.task-table-time-cell span {
  margin-top: 3px;
  font-size: 0.72rem;
  color: var(--fc-text-muted);
}

.task-priority-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 0.72rem;
  font-weight: 600;
  border: 1px solid var(--fc-border-subtle);
}

.task-priority-pill[data-priority='low'] {
  color: var(--fc-text-muted);
  background: var(--fc-surface-muted);
}

.task-priority-pill[data-priority='medium'] {
  color: var(--fc-info);
  background: color-mix(in srgb, var(--fc-info) 10%, var(--fc-surface));
  border-color: color-mix(in srgb, var(--fc-info) 30%, var(--fc-border-subtle));
}

.task-priority-pill[data-priority='high'] {
  color: var(--fc-warning);
  background: color-mix(in srgb, var(--fc-warning) 12%, var(--fc-surface));
  border-color: color-mix(in srgb, var(--fc-warning) 30%, var(--fc-border-subtle));
}

.task-priority-pill[data-priority='urgent'] {
  color: var(--fc-error);
  background: color-mix(in srgb, var(--fc-error) 10%, var(--fc-surface));
  border-color: color-mix(in srgb, var(--fc-error) 30%, var(--fc-border-subtle));
}

.task-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.task-table-empty {
  color: var(--fc-text-faint);
}
</style>
