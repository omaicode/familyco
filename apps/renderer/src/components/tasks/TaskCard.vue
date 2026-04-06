<script setup lang="ts">
import type { TaskListItem } from '@familyco/ui';
import {
  ArrowRight,
  CheckCircle2,
  Flag,
  GripVertical,
  PauseCircle,
  UserRound,
  Workflow
} from 'lucide-vue-next';

import MarkdownPreview from '../MarkdownPreview.vue';
import FcBadge from '../FcBadge.vue';
import FcButton from '../FcButton.vue';
import FcSelect from '../FcSelect.vue';

const props = withDefaults(defineProps<{
  task: TaskListItem;
  selected: boolean;
  busy: boolean;
  dragEnabled?: boolean;
  compactActions?: boolean;
  getProjectName: (projectId: string) => string;
  getAgentName: (agentId: string | null | undefined) => string;
  formatPriority: (priority: TaskListItem['priority']) => string;
  formatStatus: (status: TaskListItem['status']) => string;
  formatRelative: (iso: string) => string;
  transitions: TaskListItem['status'][];
}>(), {
  dragEnabled: true,
  compactActions: false
});

const emit = defineEmits<{
  toggleSelect: [taskId: string];
  move: [task: TaskListItem, status: TaskListItem['status']];
  changePriority: [task: TaskListItem, priority: TaskListItem['priority']];
  dragstart: [task: TaskListItem, event: DragEvent];
  dragend: [];
}>();

const getActionIcon = (status: TaskListItem['status']) => {
  if (status === 'done') return CheckCircle2;
  if (status === 'blocked') return PauseCircle;
  return ArrowRight;
};
</script>

<template>
  <article
    class="task-card"
    :class="{ 'task-card-busy': props.busy }"
    :draggable="props.dragEnabled"
    @dragstart="emit('dragstart', props.task, $event)"
    @dragend="emit('dragend')"
  >
    <div class="task-card-top">
      <label class="task-check">
        <input
          :checked="props.selected"
          type="checkbox"
          class="fc-checkbox"
          @change="emit('toggleSelect', props.task.id)"
        />
        <div>
          <span class="task-title">{{ props.task.title }}</span>
          <MarkdownPreview
            class="task-description-markdown"
            :source="props.task.description"
            :compact="true"
            empty-text="Add a Markdown brief so the assignee has execution context."
          />
        </div>
      </label>

      <div class="task-card-side">
        <span class="task-priority-pill" :data-priority="props.task.priority">
          <Flag :size="12" />
          {{ props.formatPriority(props.task.priority) }}
        </span>
        <span v-if="props.dragEnabled" class="task-drag-hint">
          <GripVertical :size="14" />
        </span>
      </div>
    </div>

    <div class="task-meta-grid">
      <span><Workflow :size="13" /> {{ props.getProjectName(props.task.projectId) }}</span>
      <span><UserRound :size="13" /> {{ props.getAgentName(props.task.assigneeAgentId) }}</span>
      <span>Updated {{ props.formatRelative(props.task.updatedAt) }}</span>
    </div>

    <div class="task-inline-field">
      <span>Priority</span>
      <FcSelect
        :model-value="props.task.priority"
        :disabled="props.busy"
        @update:modelValue="emit('changePriority', props.task, $event as TaskListItem['priority'])"
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </FcSelect>
    </div>

    <div class="task-card-footer">
      <FcBadge :status="props.task.status">{{ props.formatStatus(props.task.status) }}</FcBadge>

      <div class="task-actions">
        <FcButton
          v-for="nextStatus in props.compactActions ? props.transitions.slice(0, 2) : props.transitions"
          :key="`${props.task.id}-${nextStatus}`"
          variant="secondary"
          size="sm"
          :disabled="props.busy"
          @click="emit('move', props.task, nextStatus)"
        >
          <component :is="getActionIcon(nextStatus)" :size="12" />
          {{ props.formatStatus(nextStatus) }}
        </FcButton>
      </div>
    </div>
  </article>
</template>

<style scoped>
.task-card {
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-control-radius);
  padding: 12px;
  background: color-mix(in srgb, var(--fc-surface-muted) 40%, var(--fc-surface));
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-card-busy {
  opacity: 0.75;
}

.task-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.task-check {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex: 1;
}

.task-title {
  display: block;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--fc-text-main);
}

.task-description-markdown {
  margin-top: 4px;
  font-size: 0.8rem;
  color: var(--fc-text-muted);
}

.task-card-side {
  display: flex;
  align-items: center;
  gap: 6px;
}

.task-drag-hint {
  display: inline-flex;
  align-items: center;
  color: var(--fc-text-faint);
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

.task-meta-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
  color: var(--fc-text-muted);
  font-size: 0.76rem;
}

.task-meta-grid span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.task-inline-field {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
}

.task-inline-field span {
  font-size: 0.76rem;
  color: var(--fc-text-muted);
  font-weight: 600;
}

.task-inline-field :deep(select) {
  min-width: 118px;
}

.task-card-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
