<script setup lang="ts">
import type { TaskListItem } from '@familyco/ui';
import { ref } from 'vue';

import FcBadge from '../FcBadge.vue';
import TaskCard from './TaskCard.vue';

const props = defineProps<{
  column: {
    key: TaskListItem['status'];
    title: string;
    hint: string;
  };
  tasks: TaskListItem[];
  selectedTaskIds: string[];
  busyMap: Record<string, boolean>;
  draggingActive: boolean;
  getProjectName: (projectId: string) => string;
  getAgentName: (agentId: string | null | undefined) => string;
  formatPriority: (priority: TaskListItem['priority']) => string;
  formatStatus: (status: TaskListItem['status']) => string;
  formatRelative: (iso: string) => string;
  allowedTransitions: Record<TaskListItem['status'], TaskListItem['status'][]>;
}>();

const emit = defineEmits<{
  toggleSelect: [taskId: string];
  move: [task: TaskListItem, status: TaskListItem['status']];
  changePriority: [task: TaskListItem, priority: TaskListItem['priority']];
  dragstart: [task: TaskListItem, event: DragEvent];
  dragend: [];
  dropTask: [status: TaskListItem['status']];
}>();

const isOver = ref(false);

const onDrop = (): void => {
  isOver.value = false;
  emit('dropTask', props.column.key);
};
</script>

<template>
  <section
    class="kanban-column"
    :class="{ 'kanban-column-over': isOver, 'kanban-column-ready': props.draggingActive && !isOver }"
    @dragenter.prevent="isOver = true"
    @dragover.prevent
    @dragleave="isOver = false"
    @drop.prevent="onDrop"
  >
    <div class="kanban-column-header">
      <div>
        <h4>{{ props.column.title }}</h4>
        <p>{{ props.column.hint }}</p>
      </div>
      <FcBadge :status="props.column.key">{{ props.tasks.length }}</FcBadge>
    </div>

    <p v-if="props.draggingActive" class="kanban-drop-tip">
      {{ isOver ? 'Release to move here' : `Drop into ${props.column.title.toLowerCase()}` }}
    </p>

    <div v-if="props.tasks.length === 0" class="kanban-empty-column">
      Drop a task here to move it into {{ props.column.title.toLowerCase() }}.
    </div>

    <TaskCard
      v-for="task in props.tasks"
      :key="task.id"
      :task="task"
      :selected="props.selectedTaskIds.includes(task.id)"
      :busy="props.busyMap[task.id] === true"
      :compact-actions="true"
      :kanban-compact="true"
      :transitions="props.allowedTransitions[task.status]"
      :get-project-name="props.getProjectName"
      :get-agent-name="props.getAgentName"
      :format-priority="props.formatPriority"
      :format-status="props.formatStatus"
      :format-relative="props.formatRelative"
      @toggle-select="(taskId) => emit('toggleSelect', taskId)"
      @move="(task, status) => emit('move', task, status)"
      @change-priority="(task, priority) => emit('changePriority', task, priority)"
      @dragstart="(task, event) => emit('dragstart', task, event)"
      @dragend="() => emit('dragend')"
    />
  </section>
</template>

<style scoped>
.kanban-column {
  min-width: 340px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-card-radius);
  background: var(--fc-surface);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}

.kanban-column-over {
  border-color: var(--fc-primary);
  background: color-mix(in srgb, var(--fc-primary) 5%, var(--fc-surface));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--fc-primary) 30%, transparent);
}

.kanban-column-ready {
  border-style: dashed;
}

.kanban-column-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.kanban-column-header h4 {
  margin: 0;
  font-size: 0.9rem;
}

.kanban-column-header p {
  margin: 4px 0 0;
  font-size: 0.75rem;
  color: var(--fc-text-muted);
}

.kanban-drop-tip {
  margin: -2px 0 0;
  font-size: 0.72rem;
  color: var(--fc-text-muted);
}

.kanban-empty-column {
  border: 1px dashed var(--fc-border-subtle);
  border-radius: var(--fc-control-radius);
  padding: 12px;
  color: var(--fc-text-muted);
  font-size: 0.78rem;
  background: color-mix(in srgb, var(--fc-surface-muted) 50%, var(--fc-surface));
}
</style>
