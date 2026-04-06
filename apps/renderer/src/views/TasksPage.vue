<script setup lang="ts">
import type { BulkUpdateTasksPayload, TaskListItem } from '@familyco/ui';
import { computed, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CheckSquare2,
  ClipboardList,
  Columns3,
  Flag,
  List,
  PauseCircle,
  Plus,
  RefreshCw,
  Search,
  Square,
  UserRound,
  Workflow
} from 'lucide-vue-next';

import { uiRuntime } from '../runtime';
import SkeletonList from '../components/SkeletonList.vue';
import { useAutoReload } from '../composables/useAutoReload';
import FcBadge from '../components/FcBadge.vue';
import FcBanner from '../components/FcBanner.vue';
import FcButton from '../components/FcButton.vue';
import FcCard from '../components/FcCard.vue';
import FcInput from '../components/FcInput.vue';
import FcSelect from '../components/FcSelect.vue';

type TaskStatus = TaskListItem['status'];
type TaskPriority = TaskListItem['priority'];
type StatusFilter = 'all' | TaskStatus;
type PriorityFilter = 'all' | TaskPriority;
type ViewMode = 'kanban' | 'list';

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
  {
    key: 'pending',
    title: 'Backlog',
    hint: 'Ready to start when capacity opens.'
  },
  {
    key: 'in_progress',
    title: 'Doing',
    hint: 'Active execution across the org.'
  },
  {
    key: 'review',
    title: 'Review',
    hint: 'Waiting for QA or approval.'
  },
  {
    key: 'blocked',
    title: 'Blocked',
    hint: 'Needs a decision or dependency cleared.'
  },
  {
    key: 'done',
    title: 'Done',
    hint: 'Completed and ready for reporting.'
  },
  {
    key: 'cancelled',
    title: 'Cancelled',
    hint: 'Stopped work kept for traceability.'
  }
];

const showCreateForm = ref(false);
const isRefreshing = ref(false);
const isCreating = ref(false);
const bulkBusy = ref(false);
const viewMode = ref<ViewMode>('kanban');
const selectedTaskIds = ref<string[]>([]);
const feedback = ref<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
const busyMap = ref<Record<string, boolean>>({});
const bulkStatus = ref<TaskStatus>('in_progress');
const bulkPriority = ref<TaskPriority>('high');

const filters = reactive({
  query: '',
  status: 'all' as StatusFilter,
  priority: 'all' as PriorityFilter,
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

const resetDraft = (): void => {
  draft.title = '';
  draft.description = '';
  draft.projectId = projectOptions.value[0]?.id ?? '';
  draft.assigneeAgentId = '';
  draft.createdBy = creatorOptions.value[0]?.id ?? assigneeOptions.value[0]?.id ?? '';
  draft.priority = 'medium';
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
  const query = normalizeText(filters.query).toLowerCase();

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

const allVisibleSelected = computed(() =>
  filteredTasks.value.length > 0 && filteredTasks.value.every((task) => selectedTaskIds.value.includes(task.id))
);

const selectedCount = computed(() => selectedTaskIds.value.length);

const isTaskBusy = (taskId: string): boolean => busyMap.value[taskId] === true;

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
  if (!draft.title || !draft.description || !draft.projectId || !draft.createdBy) {
    return;
  }

  isCreating.value = true;

  try {
    const result = await uiRuntime.stores.tasks.createTask({
      title: normalizeText(draft.title),
      description: draft.description.trim(),
      projectId: draft.projectId,
      assigneeAgentId: draft.assigneeAgentId || null,
      createdBy: draft.createdBy,
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

const onTaskPriorityChange = (task: TaskListItem, value: string): void => {
  void changePriority(task, value as TaskPriority);
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

useAutoReload(reload);
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>Tasks</h3>
        <p>Plan work in Kanban by default, triage by priority, and update many tasks in one move.</p>
      </div>
      <div class="fc-inline-actions">
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

        <div v-if="projectOptions.length === 0 || creatorOptions.length === 0" class="fc-warning">
          <p>Create at least one project and one L0/L1 agent before adding tasks.</p>
          <div class="fc-inline-actions">
            <RouterLink to="/projects" class="fc-btn-secondary">Open projects</RouterLink>
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
              <label class="fc-label">Project</label>
              <FcSelect v-model="draft.projectId">
                <option v-for="project in projectOptions" :key="project.id" :value="project.id">
                  {{ project.name }}
                </option>
              </FcSelect>
            </div>
            <div class="fc-form-group">
              <label class="fc-label">Assignee</label>
              <FcSelect v-model="draft.assigneeAgentId">
                <option value="">Unassigned</option>
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
            <textarea
              v-model="draft.description"
              class="fc-textarea"
              placeholder="Describe the outcome, constraints, and what ‘done’ should look like."
            />
          </div>

          <div class="fc-toolbar">
            <FcButton
              variant="primary"
              :disabled="isCreating || !draft.title || !draft.description || !draft.projectId || !draft.createdBy"
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

    <FcCard style="margin-bottom: 16px;">
      <div class="fc-section-header">
        <div>
          <h4>Filter queue</h4>
          <p class="fc-card-desc">Slice the board by status, priority, project, or owner.</p>
        </div>
      </div>

      <div class="fc-form-grid">
        <div class="fc-form-group">
          <label class="fc-label">Search</label>
          <div class="fc-search-wrap">
            <Search :size="15" class="fc-search-icon" />
            <FcInput v-model="filters.query" placeholder="Search title, project, assignee…" style="padding-left: 34px;" />
          </div>
        </div>
        <div class="fc-form-group">
          <label class="fc-label">Status</label>
          <FcSelect v-model="filters.status">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="review">Review</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </FcSelect>
        </div>
        <div class="fc-form-group">
          <label class="fc-label">Priority</label>
          <FcSelect v-model="filters.priority">
            <option value="all">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </FcSelect>
        </div>
        <div class="fc-form-group">
          <label class="fc-label">Project</label>
          <FcSelect v-model="filters.projectId">
            <option value="all">All projects</option>
            <option v-for="project in projectOptions" :key="project.id" :value="project.id">
              {{ project.name }}
            </option>
          </FcSelect>
        </div>
        <div class="fc-form-group">
          <label class="fc-label">Assignee</label>
          <FcSelect v-model="filters.assigneeAgentId">
            <option value="all">All assignees</option>
            <option v-for="agent in assigneeOptions" :key="agent.id" :value="agent.id">
              {{ agent.name }}
            </option>
          </FcSelect>
        </div>
      </div>
    </FcCard>

    <Transition name="fc-page">
      <FcCard v-if="selectedCount > 0" style="margin-bottom: 16px;">
        <div class="bulk-toolbar">
          <div>
            <strong>{{ selectedCount }} task{{ selectedCount === 1 ? '' : 's' }} selected</strong>
            <p class="fc-card-desc" style="margin-top: 4px;">Apply updates once instead of editing cards one by one.</p>
          </div>

          <div class="bulk-toolbar-actions">
            <button class="fc-btn-ghost" @click="toggleSelectAllVisible">
              <component :is="allVisibleSelected ? CheckSquare2 : Square" :size="14" />
              {{ allVisibleSelected ? 'Clear visible' : 'Select visible' }}
            </button>
            <div class="bulk-field">
              <FcSelect v-model="bulkStatus">
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="review">Review</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </FcSelect>
              <FcButton variant="secondary" :disabled="bulkBusy" @click="applyBulkStatus">Move selected</FcButton>
            </div>
            <div class="bulk-field">
              <FcSelect v-model="bulkPriority">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </FcSelect>
              <FcButton variant="secondary" :disabled="bulkBusy" @click="applyBulkPriority">Set priority</FcButton>
            </div>
            <FcButton variant="ghost" :disabled="bulkBusy" @click="clearSelection">Clear</FcButton>
          </div>
        </div>
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
      <p>Try a wider search or switch back to all projects, owners, and priorities.</p>
      <FcButton
        variant="secondary"
        @click="filters.query = ''; filters.status = 'all'; filters.priority = 'all'; filters.projectId = 'all'; filters.assigneeAgentId = 'all';"
      >
        Reset filters
      </FcButton>
    </div>

    <div v-else>
      <div v-if="viewMode === 'kanban'" class="kanban-board">
        <section v-for="group in taskGroups" :key="group.key" class="kanban-column">
          <div class="kanban-column-header">
            <div>
              <h4>{{ group.title }}</h4>
              <p>{{ group.hint }}</p>
            </div>
            <FcBadge :status="group.key">{{ group.tasks.length }}</FcBadge>
          </div>

          <div v-if="group.tasks.length === 0" class="kanban-empty-column">
            No tasks in this column.
          </div>

          <article v-for="task in group.tasks" :key="task.id" class="task-card">
            <div class="task-card-top">
              <label class="task-check">
                <input
                  :checked="selectedTaskIds.includes(task.id)"
                  type="checkbox"
                  class="fc-checkbox"
                  @change="toggleTaskSelection(task.id)"
                />
                <span class="task-title">{{ task.title }}</span>
              </label>
              <span class="task-priority-pill" :data-priority="task.priority">
                <Flag :size="12" />
                {{ formatPriority(task.priority) }}
              </span>
            </div>

            <p class="task-description">{{ task.description }}</p>

            <div class="task-meta-grid">
              <span><Workflow :size="13" /> {{ getProjectName(task.projectId) }}</span>
              <span><UserRound :size="13" /> {{ getAgentName(task.assigneeAgentId) }}</span>
            </div>

            <div class="task-inline-field">
              <span>Priority</span>
              <FcSelect
                :model-value="task.priority"
                :disabled="isTaskBusy(task.id)"
                @update:modelValue="onTaskPriorityChange(task, $event)"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </FcSelect>
            </div>

            <div class="task-card-footer">
              <span class="task-updated">Updated {{ formatRelative(task.updatedAt) }}</span>
              <div class="task-actions">
                <FcButton
                  v-for="nextStatus in ALLOWED_TRANSITIONS[task.status].slice(0, 2)"
                  :key="`${task.id}-${nextStatus}`"
                  variant="secondary"
                  size="sm"
                  :disabled="isTaskBusy(task.id)"
                  @click="moveTask(task, nextStatus)"
                >
                  <component :is="nextStatus === 'done' ? CheckCircle2 : nextStatus === 'blocked' ? PauseCircle : ArrowRight" :size="12" />
                  {{ formatStatus(nextStatus) }}
                </FcButton>
              </div>
            </div>
          </article>
        </section>
      </div>

      <div v-else class="list-stack">
        <FcCard v-for="group in taskGroups" :key="group.key">
          <div class="fc-section-header">
            <div>
              <h4>{{ group.title }}</h4>
              <p class="fc-card-desc">{{ group.hint }}</p>
            </div>
            <FcBadge :status="group.key">{{ group.tasks.length }}</FcBadge>
          </div>

          <div v-if="group.tasks.length === 0" class="kanban-empty-column">No tasks in this group.</div>

          <div v-else class="task-list-wrap">
            <article v-for="task in group.tasks" :key="task.id" class="task-item">
              <div class="task-item-top">
                <label class="task-check">
                  <input
                    :checked="selectedTaskIds.includes(task.id)"
                    type="checkbox"
                    class="fc-checkbox"
                    @change="toggleTaskSelection(task.id)"
                  />
                  <div>
                    <strong class="task-title">{{ task.title }}</strong>
                    <p class="task-description" style="margin-top: 4px;">{{ task.description }}</p>
                  </div>
                </label>
                <div class="task-chip-row">
                  <span class="task-priority-pill" :data-priority="task.priority">
                    <Flag :size="12" />
                    {{ formatPriority(task.priority) }}
                  </span>
                  <FcBadge :status="task.status">{{ formatStatus(task.status) }}</FcBadge>
                </div>
              </div>

              <div class="task-meta-grid">
                <span><Workflow :size="13" /> {{ getProjectName(task.projectId) }}</span>
                <span><UserRound :size="13" /> {{ getAgentName(task.assigneeAgentId) }}</span>
                <span>Updated {{ formatRelative(task.updatedAt) }}</span>
              </div>

              <div class="task-actions">
                <FcButton
                  v-for="nextStatus in ALLOWED_TRANSITIONS[task.status]"
                  :key="`${task.id}-${nextStatus}`"
                  variant="secondary"
                  size="sm"
                  :disabled="isTaskBusy(task.id)"
                  @click="moveTask(task, nextStatus)"
                >
                  <component :is="nextStatus === 'done' ? CheckCircle2 : nextStatus === 'blocked' ? PauseCircle : ArrowRight" :size="12" />
                  {{ formatStatus(nextStatus) }}
                </FcButton>
              </div>
            </article>
          </div>
        </FcCard>
      </div>
    </div>
  </section>
</template>

<style scoped>
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

.fc-search-wrap {
  position: relative;
}

.fc-search-icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--fc-text-muted);
  pointer-events: none;
}

.bulk-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.bulk-toolbar-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.bulk-field {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.kanban-board {
  display: grid;
  grid-template-columns: repeat(6, minmax(260px, 1fr));
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 6px;
}

.kanban-column {
  min-width: 260px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-card-radius);
  background: var(--fc-surface);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
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

.kanban-empty-column {
  border: 1px dashed var(--fc-border-subtle);
  border-radius: var(--fc-control-radius);
  padding: 12px;
  color: var(--fc-text-muted);
  font-size: 0.78rem;
  background: color-mix(in srgb, var(--fc-surface-muted) 50%, var(--fc-surface));
}

.task-card,
.task-item {
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-control-radius);
  padding: 12px;
  background: color-mix(in srgb, var(--fc-surface-muted) 40%, var(--fc-surface));
}

.task-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-card-top,
.task-item-top {
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

.task-description {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--fc-text-muted);
}

.task-chip-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
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

.task-updated {
  font-size: 0.74rem;
  color: var(--fc-text-muted);
}

.task-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.list-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@media (max-width: 1100px) {
  .bulk-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .bulk-toolbar-actions {
    width: 100%;
  }

  .bulk-field {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
