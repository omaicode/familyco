<script setup lang="ts">
import type { TaskListItem } from '@familyco/ui';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
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
import { useI18n } from '../../composables/useI18n';

const props = withDefaults(defineProps<{
  task: TaskListItem;
  selected: boolean;
  busy: boolean;
  dragEnabled?: boolean;
  compactActions?: boolean;
  kanbanCompact?: boolean;
  getProjectName: (projectId: string) => string;
  getAgentName: (agentId: string | null | undefined) => string;
  formatPriority: (priority: TaskListItem['priority']) => string;
  formatStatus: (status: TaskListItem['status']) => string;
  formatRelative: (iso: string) => string;
  transitions: TaskListItem['status'][];
}>(), {
  dragEnabled: true,
  compactActions: false,
  kanbanCompact: false
});

const emit = defineEmits<{
  toggleSelect: [taskId: string];
  move: [task: TaskListItem, status: TaskListItem['status']];
  changePriority: [task: TaskListItem, priority: TaskListItem['priority']];
  view: [taskId: string];
  dragstart: [task: TaskListItem, event: DragEvent];
  dragend: [];
}>();

const { t } = useI18n();

const getActionIcon = (status: TaskListItem['status']) => {
  if (status === 'done') return CheckCircle2;
  if (status === 'blocked') return PauseCircle;
  return ArrowRight;
};

const isCancelledTask = (task: TaskListItem): boolean => task.status === 'cancelled';
const formatTaskCode = (task: TaskListItem): string => `${task.id.slice(0, 8).toUpperCase()}`;
</script>

<template>
  <article
    class="task-card"
    :class="{
      'task-card-busy': props.busy,
      'task-card-kanban': props.kanbanCompact,
      'task-card-draggable': props.dragEnabled && !isCancelledTask(props.task),
      'task-card-locked': isCancelledTask(props.task)
    }"
    :draggable="props.dragEnabled && !isCancelledTask(props.task)"
    @dragstart="!isCancelledTask(props.task) && emit('dragstart', props.task, $event)"
    @dragend="emit('dragend')"
  >
    <div class="task-card-top">
      <div class="task-check">
        <input
          :checked="props.selected"
          :disabled="isCancelledTask(props.task)"
          type="checkbox"
          class="fc-checkbox"
          @click.stop
          @change="!isCancelledTask(props.task) && emit('toggleSelect', props.task.id)"
        />
        <div
          class="task-copy"
          :class="{ 'task-copy-clickable': props.kanbanCompact }"
          :role="props.kanbanCompact ? 'button' : undefined"
          :tabindex="props.kanbanCompact ? 0 : undefined"
          @click="props.kanbanCompact && emit('view', props.task.id)"
          @keydown.enter.prevent="props.kanbanCompact && emit('view', props.task.id)"
          @keydown.space.prevent="props.kanbanCompact && emit('view', props.task.id)"
        >
          <span v-if="props.kanbanCompact" class="task-code">{{ formatTaskCode(props.task) }}</span>
          <span class="task-title" :class="{ 'task-title-compact': props.kanbanCompact }">{{ props.task.title }}</span>

          <div v-if="props.kanbanCompact" class="task-compact-badges">
            <FcBadge :status="props.task.status">{{ props.formatStatus(props.task.status) }}</FcBadge>
            <span class="task-priority-pill" :data-priority="props.task.priority">
              <Flag :size="12" />
              {{ props.formatPriority(props.task.priority) }}
            </span>
          </div>

          <p v-if="props.kanbanCompact" class="task-compact-assignee">
            <UserRound :size="12" />
            {{ props.getAgentName(props.task.assigneeAgentId) }}
          </p>

          <MarkdownPreview
            v-else
            class="task-description-markdown"
            :source="props.task.description"
            :compact="true"
            empty-text="Add a Markdown brief so the assignee has execution context."
          />
        </div>
      </div>

      <div class="task-card-side">
        <span v-if="!props.kanbanCompact" class="task-priority-pill" :data-priority="props.task.priority">
          <Flag :size="12" />
          {{ props.formatPriority(props.task.priority) }}
        </span>
        <span v-if="props.dragEnabled && !isCancelledTask(props.task)" class="task-drag-hint">
          <GripVertical :size="14" />
        </span>
      </div>
    </div>

    <div v-if="!props.kanbanCompact" class="task-meta-grid">
      <span><Workflow :size="13" /> {{ props.getProjectName(props.task.projectId) }}</span>
      <span><UserRound :size="13" /> {{ props.getAgentName(props.task.assigneeAgentId) }}</span>
      <span>Updated {{ props.formatRelative(props.task.updatedAt) }}</span>
    </div>

    <div v-if="!props.kanbanCompact" class="task-inline-field">
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

    <div v-if="!props.kanbanCompact" class="task-card-footer">
      <FcBadge :status="props.task.status">{{ props.formatStatus(props.task.status) }}</FcBadge>

      <div class="task-actions">
        <FcButton variant="ghost" size="sm" :disabled="props.busy" @click.stop="emit('view', props.task.id)">
          <Eye :size="12" />
          {{ t('Details') }}
        </FcButton>
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
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.task-card-draggable {
  cursor: grab;
}

.task-card-draggable:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--fc-primary) 22%, var(--fc-border-subtle));
  box-shadow: 0 8px 20px color-mix(in srgb, var(--fc-primary) 10%, transparent);
}

.task-card-draggable:active {
  cursor: grabbing;
}

.task-card-busy {
  opacity: 0.75;
}

.task-card-locked {
  opacity: 0.9;
}

.task-card-locked .task-check {
  cursor: default;
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
  min-width: 0;
}

.task-copy {
  min-width: 0;
}

.task-copy-clickable {
  cursor: pointer;
}

.task-copy-clickable:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--fc-primary) 60%, transparent);
  outline-offset: 3px;
  border-radius: 8px;
}

.task-code {
  display: inline-block;
  margin-bottom: 4px;
  font-size: 0.67rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fc-text-muted);
}

.task-title {
  display: block;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--fc-text-main);
}

.task-title-compact {
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-description-markdown {
  margin-top: 4px;
  font-size: 0.8rem;
  color: var(--fc-text-muted);
}

.task-compact-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 7px;
}

.task-compact-assignee {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 7px 0 0;
  font-size: 0.74rem;
  color: var(--fc-text-muted);
}

.task-card-side {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
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

.task-card-kanban {
  padding: 12px;
  gap: 8px;
}

.task-card-kanban .task-priority-pill {
  padding: 2px 7px;
  font-size: 0.66rem;
}

.task-card-kanban :deep(.fc-badge) {
  padding: 2px 7px;
  font-size: 0.66rem;
}
</style>
