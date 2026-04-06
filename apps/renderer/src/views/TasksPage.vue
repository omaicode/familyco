<script setup lang="ts">
import type { BulkUpdateTasksPayload, TaskListItem } from '@familyco/ui';
import { computed, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import {
  AlertTriangle,
  ClipboardList,
  Columns3,
  List,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal
} from 'lucide-vue-next';

import { uiRuntime } from '../runtime';
import SkeletonList from '../components/SkeletonList.vue';
import { useAutoReload } from '../composables/useAutoReload';
import FcBanner from '../components/FcBanner.vue';
import FcButton from '../components/FcButton.vue';
import FcCard from '../components/FcCard.vue';
import FcInput from '../components/FcInput.vue';
import FcSelect from '../components/FcSelect.vue';
import MarkdownEditor from '../components/MarkdownEditor.vue';
import TaskBulkActionsBar from '../components/tasks/TaskBulkActionsBar.vue';
import TaskCard from '../components/tasks/TaskCard.vue';
import TaskFiltersModal from '../components/tasks/TaskFiltersModal.vue';
import TaskKanbanColumn from '../components/tasks/TaskKanbanColumn.vue';

type TaskStatus = TaskListItem['status'];
type TaskPriority = TaskListItem['priority'];
type StatusFilter = 'all' | TaskStatus;
type PriorityFilter = 'all' | TaskPriority;
type ViewMode = 'kanban' | 'list';

interface FilterState {
  status: StatusFilter;
  priority: PriorityFilter;
  projectId: string;
  assigneeAgentId: string;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  review: 'In review',
  done: 'Done',
  blocked: 'Blocked',
  cancelled: 'Cancelled'
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent'
};

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3
};

const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['review', 'blocked', 'cancelled'],
  review: ['done', 'in_progress', 'cancelled'],
  done: [],
  blocked: ['in_progress', 'cancelled'],
  cancelled: []
};

const KANBAN_COLUMNS: Array<{ key: TaskStatus; title: string; hint: string }> = [
  { key: 'pending', title: 'Backlog', hint: 'Ready to start when capacity opens.' },
  { key: 'in_progress', title: 'Doing', hint: 'Active execution across the org.' },
  { key: 'review', title: 'Review', hint: 'Waiting for QA or approval.' },
  { key: 'blocked', title: 'Blocked', hint: 'Needs a decision or dependency cleared.' },
  { key: 'done', title: 'Done', hint: 'Completed and ready for reporting.' },
  { key: 'cancelled', title: 'Cancelled', hint: 'Stopped work kept for traceability.' }
];

const showCreateForm = ref(false);
const filterModalOpen = ref(false);
const isRefreshing = ref(false);
const isCreating = ref(false);
const bulkBusy = ref(false);
const viewMode = ref<ViewMode>('kanban');
const searchQuery = ref('');
const draggingTaskId = ref<string | null>(null);
const selectedTaskIds = ref<string[]>([]);
const feedback = ref<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
const busyMap = ref<Record<string, boolean>>({});
const bulkStatus = ref<TaskStatus>('in_progress');
const bulkPriority = ref<TaskPriority>('high');

const filters = reactive<FilterState>({
  status: 'all',
  priority: 'all',
  projectId: 'all',
  assigneeAgentId: 'all'
});

const draft = reactive({
  title: '',
  description: '',
  projectId: '',
  assigneeAgentId: '',
  createdBy: '',
  priority: 'medium' as TaskPriority
});

const taskState = computed(() => uiRuntime.stores.tasks.state);

const setFeedback = (type: 'success' | 'error' | 'info', text: string): void => {
  feedback.value = { type, text };
  setTimeout(() => {
    if (feedback.value?.text === text) {
      feedback.value = null;
    }
  }, 4000);
};

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const projectOptions = computed(() => taskState.value.data.projects);
const assigneeOptions = computed(() => taskState.value.data.agents.filter((agent) => agent.status !== 'archived'));
const creatorOptions = computed(() =>
  taskState.value.data.agents.filter((agent) => agent.status !== 'archived' && agent.level !== 'L2')
);

const getProjectName = (projectId: string): string =>
  taskState.value.data.projects.find((project) => project.id === projectId)?.name ?? projectId;

const getAgentName = (agentId: string | null | undefined): string => {
  if (!agentId) {
    return 'Unassigned';
  }

  return taskState.value.data.agents.find((agent) => agent.id === agentId)?.name ?? agentId;
};

const formatRelative = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'recently';
  }

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const formatStatus = (status: TaskStatus): string => STATUS_LABELS[status];
const formatPriority = (priority: TaskPriority): string => PRIORITY_LABELS[priority];

const activeFilterCount = computed(
  () =>
    [filters.status !== 'all', filters.priority !== 'all', filters.projectId !== 'all', filters.assigneeAgentId !== 'all']
      .filter(Boolean).length
);

const activeFilterLabels = computed(() => {
  const labels: string[] = [];

  if (filters.status !== 'all') labels.push(`Status: ${formatStatus(filters.status)}`);
  if (filters.priority !== 'all') labels.push(`Priority: ${formatPriority(filters.priority)}`);
  if (filters.projectId !== 'all') labels.push(`Project: ${getProjectName(filters.projectId)}`);
  if (filters.assigneeAgentId !== 'all') labels.push(`Assignee: ${getAgentName(filters.assigneeAgentId)}`);

  return labels;
});

const resetDraft = (): void => {
  draft.title = '';
  draft.description = '';
  draft.projectId = projectOptions.value[0]?.id ?? '';
  draft.assigneeAgentId = '';
  draft.createdBy = creatorOptions.value[0]?.id ?? assigneeOptions.value[0]?.id ?? '';
  draft.priority = 'medium';
};

const resetFilters = (): void => {
  searchQuery.value = '';
  filters.status = 'all';
  filters.priority = 'all';
  filters.projectId = 'all';
  filters.assigneeAgentId = 'all';
  filterModalOpen.value = false;
};

const applyFilters = (nextFilters: { status: string; priority: string; projectId: string; assigneeAgentId: string }): void => {
  filters.status = nextFilters.status as StatusFilter;
  filters.priority = nextFilters.priority as PriorityFilter;
  filters.projectId = nextFilters.projectId;
  filters.assigneeAgentId = nextFilters.assigneeAgentId;
  filterModalOpen.value = false;
};

const reload = async (): Promise<void> => {
  feedback.value = null;
  isRefreshing.value = true;

  try {
    await uiRuntime.stores.tasks.loadTasks();

    if (!draft.projectId || !projectOptions.value.some((project) => project.id === draft.projectId)) {
      draft.projectId = projectOptions.value[0]?.id ?? '';
    }

    if (!draft.createdBy || !assigneeOptions.value.some((agent) => agent.id === draft.createdBy)) {
      draft.createdBy = creatorOptions.value[0]?.id ?? assigneeOptions.value[0]?.id ?? '';
    }
  } finally {
    isRefreshing.value = false;
  }
};

const metrics = computed(() => {
  const tasks = taskState.value.data.tasks;
  const open = tasks.filter((task) => ['pending', 'in_progress', 'review', 'blocked'].includes(task.status)).length;
  const blocked = tasks.filter((task) => task.status === 'blocked').length;
  const urgent = tasks.filter((task) => task.priority === 'urgent' && !['done', 'cancelled'].includes(task.status)).length;
  const done = tasks.filter((task) => task.status === 'done').length;

  return {
    total: tasks.length,
    open,
    blocked,
    urgent,
    done,
    completionRate: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100)
  };
});

const filteredTasks = computed(() => {
  const query = normalizeText(searchQuery.value).toLowerCase();

  return [...taskState.value.data.tasks]
    .filter((task) => {
      if (filters.status !== 'all' && task.status !== filters.status) {
        return false;
      }

      if (filters.priority !== 'all' && task.priority !== filters.priority) {
        return false;
      }

      if (filters.projectId !== 'all' && task.projectId !== filters.projectId) {
        return false;
      }

      if (filters.assigneeAgentId !== 'all' && task.assigneeAgentId !== filters.assigneeAgentId) {
        return false;
      }

      if (query) {
        const haystack = [
          task.title,
          task.description,
          task.priority,
          getProjectName(task.projectId),
          getAgentName(task.assigneeAgentId)
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(query);
      }

      return true;
    })
    .sort((left, right) => {
      const priorityDelta = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
});

const taskGroups = computed(() =>
  KANBAN_COLUMNS.map((column) => ({
    ...column,
    tasks: filteredTasks.value.filter((task) => task.status === column.key)
  }))
);

const listGroups = computed(() =>
  taskGroups.value.filter((group) => group.tasks.length > 0 || filters.status === group.key)
);

const allVisibleSelected = computed(() =>
  filteredTasks.value.length > 0 && filteredTasks.value.every((task) => selectedTaskIds.value.includes(task.id))
);

const selectedCount = computed(() => selectedTaskIds.value.length);

const toggleTaskSelection = (taskId: string): void => {
  selectedTaskIds.value = selectedTaskIds.value.includes(taskId)
    ? selectedTaskIds.value.filter((id) => id !== taskId)
    : [...selectedTaskIds.value, taskId];
};

const toggleSelectAllVisible = (): void => {
  if (allVisibleSelected.value) {
    selectedTaskIds.value = [];
    return;
  }

  selectedTaskIds.value = filteredTasks.value.map((task) => task.id);
};

const clearSelection = (): void => {
  selectedTaskIds.value = [];
};

const createTask = async (): Promise<void> => {
  if (!draft.title || !draft.description) {
    return;
  }

  isCreating.value = true;

  try {
    const result = await uiRuntime.stores.tasks.createTask({
      title: normalizeText(draft.title),
      description: draft.description.trim(),
      projectId: draft.projectId || undefined,
      assigneeAgentId: draft.assigneeAgentId || null,
      createdBy: draft.createdBy || undefined,
      priority: draft.priority
    });

    if ('approvalRequired' in result) {
      setFeedback('info', `Task request sent for approval${result.reason ? ` — ${result.reason}` : ''}.`);
    } else {
      setFeedback('success', `Task “${result.title}” created successfully.`);
    }

    resetDraft();
    showCreateForm.value = false;
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to create task');
  } finally {
    isCreating.value = false;
  }
};

const moveTask = async (task: TaskListItem, status: TaskStatus): Promise<void> => {
  busyMap.value = { ...busyMap.value, [task.id]: true };

  try {
    const result = await uiRuntime.stores.tasks.updateTaskStatus({
      taskId: task.id,
      status
    });

    if ('approvalRequired' in result) {
      setFeedback('info', `Status change queued for approval${result.reason ? ` — ${result.reason}` : ''}.`);
    } else {
      setFeedback('success', `Task moved to ${formatStatus(status).toLowerCase()}.`);
    }
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to update task status');
  } finally {
    busyMap.value = { ...busyMap.value, [task.id]: false };
  }
};

const changePriority = async (task: TaskListItem, priority: TaskPriority): Promise<void> => {
  if (task.priority === priority) {
    return;
  }

  busyMap.value = { ...busyMap.value, [task.id]: true };

  try {
    const result = await uiRuntime.stores.tasks.updateTaskPriority({
      taskId: task.id,
      priority
    });

    if ('approvalRequired' in result) {
      setFeedback('info', `Priority update queued for approval${result.reason ? ` — ${result.reason}` : ''}.`);
    } else {
      setFeedback('success', `Priority set to ${formatPriority(priority).toLowerCase()}.`);
    }
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to update priority');
  } finally {
    busyMap.value = { ...busyMap.value, [task.id]: false };
  }
};

const runBulkAction = async (payload: BulkUpdateTasksPayload, successText: string): Promise<void> => {
  if (selectedTaskIds.value.length === 0) {
    return;
  }

  bulkBusy.value = true;

  try {
    const result = await uiRuntime.stores.tasks.bulkUpdateTasks(payload);

    if ('approvalRequired' in result) {
      setFeedback('info', `Bulk update queued for approval${result.reason ? ` — ${result.reason}` : ''}.`);
    } else {
      setFeedback('success', successText);
    }

    clearSelection();
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Bulk task update failed');
  } finally {
    bulkBusy.value = false;
  }
};

const applyBulkStatus = async (): Promise<void> => {
  await runBulkAction(
    {
      taskIds: selectedTaskIds.value,
      action: 'update_status',
      status: bulkStatus.value
    },
    `Updated ${selectedTaskIds.value.length} tasks to ${formatStatus(bulkStatus.value).toLowerCase()}.`
  );
};

const applyBulkPriority = async (): Promise<void> => {
  await runBulkAction(
    {
      taskIds: selectedTaskIds.value,
      action: 'update_priority',
      priority: bulkPriority.value
    },
    `Updated ${selectedTaskIds.value.length} tasks to ${formatPriority(bulkPriority.value).toLowerCase()} priority.`
  );
};

const onDragTask = (task: TaskListItem, event: DragEvent): void => {
  draggingTaskId.value = task.id;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task.id);
  }
};

const onDragEnd = (): void => {
  draggingTaskId.value = null;
};

const handleDropOnColumn = async (targetStatus: TaskStatus): Promise<void> => {
  const taskId = draggingTaskId.value;
  draggingTaskId.value = null;

  if (!taskId) {
    return;
  }

  const task = taskState.value.data.tasks.find((item) => item.id === taskId);
  if (!task || task.status === targetStatus) {
    return;
  }

  if (!ALLOWED_TRANSITIONS[task.status].includes(targetStatus)) {
    setFeedback('error', `Cannot move task from ${formatStatus(task.status)} to ${formatStatus(targetStatus)}.`);
    return;
  }

  await moveTask(task, targetStatus);
};

useAutoReload(reload);
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>Tasks</h3>
        <p>Use a compact board-first workflow with drag-and-drop, hidden filters, and cleaner task cards.</p>
      </div>
      <div class="task-toolbar">
        <div class="task-search-wrap">
          <Search :size="15" class="task-search-icon" />
          <FcInput v-model="searchQuery" placeholder="Search tasks…" style="padding-left: 34px; min-width: 220px;" />
        </div>

        <button class="fc-btn-secondary task-filter-trigger" @click="filterModalOpen = true">
          <SlidersHorizontal :size="14" />
          Filters
          <span v-if="activeFilterCount > 0" class="task-filter-count">{{ activeFilterCount }}</span>
        </button>

        <div class="fc-tabs" role="tablist" aria-label="Task views">
          <button class="fc-tab" :class="{ 'fc-tab-active': viewMode === 'kanban' }" @click="viewMode = 'kanban'">
            <Columns3 :size="14" />
            Kanban
          </button>
          <button class="fc-tab" :class="{ 'fc-tab-active': viewMode === 'list' }" @click="viewMode = 'list'">
            <List :size="14" />
            List
          </button>
        </div>

        <button class="fc-btn-secondary" :disabled="isRefreshing" @click="reload">
          <RefreshCw :size="14" :class="{ 'fc-spin': isRefreshing }" />
          Refresh
        </button>

        <button class="fc-btn-primary" @click="showCreateForm = !showCreateForm">
          <Plus :size="14" />
          {{ showCreateForm ? 'Hide form' : 'New task' }}
        </button>
      </div>
    </div>

    <Transition name="fc-banner">
      <FcBanner
        v-if="feedback"
        :type="feedback.type"
        closable
        style="margin-bottom: 14px;"
        @close="feedback = null"
      >
        {{ feedback.text }}
      </FcBanner>
    </Transition>

    <TaskFiltersModal
      :open="filterModalOpen"
      :filters="filters"
      :project-options="projectOptions"
      :assignee-options="assigneeOptions"
      @close="filterModalOpen = false"
      @reset="resetFilters"
      @apply="applyFilters"
    />

    <div v-if="activeFilterLabels.length > 0" class="task-active-filters">
      <span v-for="label in activeFilterLabels" :key="label" class="task-active-chip">{{ label }}</span>
      <button class="fc-btn-ghost fc-btn-sm" @click="resetFilters">Clear</button>
    </div>

    <div class="fc-grid-kpi">
      <div class="fc-kpi-card" data-highlight="primary">
        <p class="fc-kpi-label">Open work</p>
        <p class="fc-kpi-value">{{ metrics.open }}</p>
        <p class="fc-kpi-sub">Everything still moving through the board</p>
      </div>
      <div class="fc-kpi-card" :data-highlight="metrics.urgent > 0 ? 'warning' : 'success'">
        <p class="fc-kpi-label">Urgent</p>
        <p class="fc-kpi-value">{{ metrics.urgent }}</p>
        <p class="fc-kpi-sub">High-focus items that need founder visibility</p>
      </div>
      <div class="fc-kpi-card" :data-highlight="metrics.blocked > 0 ? 'error' : 'success'">
        <p class="fc-kpi-label">Blocked</p>
        <p class="fc-kpi-value">{{ metrics.blocked }}</p>
        <p class="fc-kpi-sub">Clear these first to recover flow</p>
      </div>
      <div class="fc-kpi-card" data-highlight="success">
        <p class="fc-kpi-label">Completion rate</p>
        <p class="fc-kpi-value">{{ metrics.completionRate }}%</p>
        <p class="fc-kpi-sub">{{ metrics.done }} of {{ Math.max(metrics.total, 1) }} tasks completed</p>
      </div>
    </div>

    <Transition name="fc-page">
      <FcCard v-if="showCreateForm" style="margin-bottom: 16px;">
        <div class="fc-section-header">
          <div>
            <h4>Create task</h4>
            <p class="fc-card-desc">Capture the outcome, choose a priority, and keep the owner accountable.</p>
          </div>
        </div>

        <div v-if="creatorOptions.length === 0" class="fc-warning">
          <p>Complete setup first so the executive agent can receive new tasks.</p>
          <div class="fc-inline-actions">
            <RouterLink to="/setup" class="fc-btn-secondary">Open setup</RouterLink>
            <RouterLink to="/agents" class="fc-btn-secondary">Open agents</RouterLink>
          </div>
        </div>

        <template v-else>
          <div class="fc-form-grid" style="margin-bottom: 12px;">
            <div class="fc-form-group">
              <label class="fc-label">Task title</label>
              <FcInput v-model="draft.title" placeholder="e.g. Review onboarding checklist" />
            </div>
            <div class="fc-form-group">
              <label class="fc-label">Project <span class="fc-label-optional">optional</span></label>
              <FcSelect v-model="draft.projectId">
                <option value="">Use executive queue</option>
                <option v-for="project in projectOptions" :key="project.id" :value="project.id">
                  {{ project.name }}
                </option>
              </FcSelect>
            </div>
            <div class="fc-form-group">
              <label class="fc-label">Assignee <span class="fc-label-optional">defaults to L0</span></label>
              <FcSelect v-model="draft.assigneeAgentId">
                <option value="">Executive agent</option>
                <option v-for="agent in assigneeOptions" :key="agent.id" :value="agent.id">
                  {{ agent.name }} · {{ agent.role }}
                </option>
              </FcSelect>
            </div>
            <div class="fc-form-group">
              <label class="fc-label">Created by</label>
              <FcSelect v-model="draft.createdBy">
                <option v-for="agent in creatorOptions" :key="agent.id" :value="agent.id">
                  {{ agent.name }} · {{ agent.level }}
                </option>
              </FcSelect>
            </div>
          </div>

          <div class="fc-form-grid" style="margin-bottom: 12px;">
            <div class="fc-form-group">
              <label class="fc-label">Priority</label>
              <FcSelect v-model="draft.priority">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </FcSelect>
            </div>
          </div>

          <div class="fc-form-group" style="margin-bottom: 12px;">
            <label class="fc-label">Execution brief</label>
            <MarkdownEditor
              v-model="draft.description"
              placeholder="Describe the outcome, constraints, and what ‘done’ should look like using Markdown."
              preview-empty-text="The task brief preview will appear here."
            />
          </div>

          <div class="fc-toolbar">
            <FcButton
              variant="primary"
              :disabled="isCreating || !draft.title || !draft.description"
              @click="createTask"
            >
              <Plus :size="14" />
              {{ isCreating ? 'Creating…' : 'Create task' }}
            </FcButton>
            <FcButton variant="ghost" @click="showCreateForm = false">Cancel</FcButton>
          </div>
        </template>
      </FcCard>
    </Transition>

    <Transition name="fc-page">
      <FcCard v-if="selectedCount > 0" style="margin-bottom: 16px;">
        <TaskBulkActionsBar
          :selected-count="selectedCount"
          :all-visible-selected="allVisibleSelected"
          :busy="bulkBusy"
          v-model:bulk-status="bulkStatus"
          v-model:bulk-priority="bulkPriority"
          @toggle-all="toggleSelectAllVisible"
          @clear="clearSelection"
          @apply-status="applyBulkStatus"
          @apply-priority="applyBulkPriority"
        />
      </FcCard>
    </Transition>

    <div v-if="taskState.isLoading" class="fc-loading">
      <p style="margin: 0 0 12px; font-size: 0.875rem; color: var(--fc-text-muted);">Loading tasks…</p>
      <SkeletonList />
    </div>

    <div v-else-if="taskState.errorMessage" class="fc-error">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
        <AlertTriangle :size="16" />
        <p style="margin: 0;">{{ taskState.errorMessage }}</p>
      </div>
      <FcButton variant="secondary" size="sm" @click="reload">
        <RefreshCw :size="13" /> Retry
      </FcButton>
    </div>

    <div v-else-if="taskState.isEmpty" class="fc-empty">
      <ClipboardList :size="36" class="fc-empty-icon" />
      <h4>No tasks yet</h4>
      <p>Create the first task to turn project strategy into execution.</p>
      <FcButton variant="primary" @click="showCreateForm = true">
        <Plus :size="14" /> Create first task
      </FcButton>
    </div>

    <div v-else-if="filteredTasks.length === 0" class="fc-empty">
      <Search :size="36" class="fc-empty-icon" />
      <h4>No matches for this filter</h4>
      <p>Try a wider search or clear the active filters.</p>
      <FcButton variant="secondary" @click="resetFilters">Reset filters</FcButton>
    </div>

    <div v-else>
      <div v-if="viewMode === 'kanban'" class="kanban-board">
        <TaskKanbanColumn
          v-for="group in taskGroups"
          :key="group.key"
          :column="group"
          :tasks="group.tasks"
          :selected-task-ids="selectedTaskIds"
          :busy-map="busyMap"
          :allowed-transitions="ALLOWED_TRANSITIONS"
          :get-project-name="getProjectName"
          :get-agent-name="getAgentName"
          :format-priority="formatPriority"
          :format-status="formatStatus"
          :format-relative="formatRelative"
          @toggle-select="toggleTaskSelection"
          @move="moveTask"
          @change-priority="changePriority"
          @dragstart="onDragTask"
          @dragend="onDragEnd"
          @drop-task="handleDropOnColumn"
        />
      </div>

      <div v-else class="list-stack">
        <FcCard v-for="group in listGroups" :key="group.key">
          <div class="fc-section-header">
            <div>
              <h4>{{ group.title }}</h4>
              <p class="fc-card-desc">{{ group.hint }}</p>
            </div>
          </div>

          <div class="task-list-wrap">
            <TaskCard
              v-for="task in group.tasks"
              :key="task.id"
              :task="task"
              :selected="selectedTaskIds.includes(task.id)"
              :busy="busyMap[task.id] === true"
              :drag-enabled="false"
              :transitions="ALLOWED_TRANSITIONS[task.status]"
              :get-project-name="getProjectName"
              :get-agent-name="getAgentName"
              :format-priority="formatPriority"
              :format-status="formatStatus"
              :format-relative="formatRelative"
              @toggle-select="toggleTaskSelection"
              @move="moveTask"
              @change-priority="changePriority"
            />
          </div>
        </FcCard>
      </div>
    </div>
  </section>
</template>

<style scoped>
.fc-label-optional {
  color: var(--fc-text-muted);
  font-size: 0.75rem;
  font-weight: 500;
  margin-left: 4px;
}

.fc-spin {
  animation: fc-rotate 0.8s linear infinite;
}

@keyframes fc-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.task-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.task-search-wrap {
  position: relative;
}

.task-search-icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--fc-text-muted);
  pointer-events: none;
}

.task-filter-trigger {
  position: relative;
}

.task-filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--fc-primary) 16%, var(--fc-surface));
  color: var(--fc-primary);
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0 5px;
}

.task-active-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 16px;
}

.task-active-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 4px 10px;
  background: var(--fc-surface);
  border: 1px solid var(--fc-border-subtle);
  font-size: 0.74rem;
  color: var(--fc-text-muted);
}

.kanban-board {
  display: grid;
  grid-template-columns: repeat(6, minmax(260px, 1fr));
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 6px;
}

.list-stack,
.task-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-width: 1100px) {
  .task-toolbar {
    justify-content: flex-start;
  }

  .task-search-wrap {
    width: 100%;
  }

  .task-search-wrap :deep(input) {
    width: 100%;
  }
}
</style>
