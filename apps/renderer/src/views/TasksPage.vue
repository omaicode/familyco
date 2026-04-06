<script setup lang="ts">
import type { TaskListItem } from '@familyco/ui';
import { computed, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  PauseCircle,
  Plus,
  RefreshCw,
  Search,
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
type StatusFilter = 'all' | TaskStatus;

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  review: 'In review',
  done: 'Done',
  blocked: 'Blocked',
  cancelled: 'Cancelled'
};

const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['review', 'blocked', 'cancelled'],
  review: ['done', 'in_progress', 'cancelled'],
  done: [],
  blocked: ['in_progress', 'cancelled'],
  cancelled: []
};

const showCreateForm = ref(false);
const isRefreshing = ref(false);
const isCreating = ref(false);
const feedback = ref<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
const busyMap = ref<Record<string, boolean>>({});

const filters = reactive({
  query: '',
  status: 'all' as StatusFilter,
  projectId: 'all',
  assigneeAgentId: 'all'
});

const draft = reactive({
  title: '',
  description: '',
  projectId: '',
  assigneeAgentId: '',
  createdBy: ''
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

const resetDraft = (): void => {
  draft.title = '';
  draft.description = '';
  draft.projectId = projectOptions.value[0]?.id ?? '';
  draft.assigneeAgentId = '';
  draft.createdBy = creatorOptions.value[0]?.id ?? assigneeOptions.value[0]?.id ?? '';
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
  const review = tasks.filter((task) => task.status === 'review').length;
  const done = tasks.filter((task) => task.status === 'done').length;

  return {
    total: tasks.length,
    open,
    blocked,
    review,
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
          getProjectName(task.projectId),
          getAgentName(task.assigneeAgentId)
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(query);
      }

      return true;
    })
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
});

const taskGroups = computed(() => {
  const sections: Array<{ key: TaskStatus; title: string; hint: string; tasks: TaskListItem[] }> = [
    {
      key: 'blocked',
      title: 'Needs attention',
      hint: 'Blocked work or actions waiting on a dependency.',
      tasks: filteredTasks.value.filter((task) => task.status === 'blocked')
    },
    {
      key: 'review',
      title: 'Ready for review',
      hint: 'Items prepared for approval, QA, or final sign-off.',
      tasks: filteredTasks.value.filter((task) => task.status === 'review')
    },
    {
      key: 'in_progress',
      title: 'In progress',
      hint: 'Active execution queue across departments.',
      tasks: filteredTasks.value.filter((task) => task.status === 'in_progress')
    },
    {
      key: 'pending',
      title: 'Ready to start',
      hint: 'Backlog items that can be picked up next.',
      tasks: filteredTasks.value.filter((task) => task.status === 'pending')
    },
    {
      key: 'done',
      title: 'Completed',
      hint: 'Recently completed deliverables and finished work.',
      tasks: filteredTasks.value.filter((task) => task.status === 'done')
    },
    {
      key: 'cancelled',
      title: 'Cancelled',
      hint: 'Stopped or deprioritized requests kept for audit history.',
      tasks: filteredTasks.value.filter((task) => task.status === 'cancelled')
    }
  ];

  return sections.filter((section) => section.tasks.length > 0 || filters.status === 'all' || filters.status === section.key);
});

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
      createdBy: draft.createdBy
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

useAutoReload(reload);
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>Tasks</h3>
        <p>Run one clear execution queue across projects, owners, and approval states.</p>
      </div>
      <div class="fc-inline-actions">
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
        <p class="fc-kpi-sub">Pending, active, review, and blocked items</p>
      </div>
      <div class="fc-kpi-card" data-highlight="warning">
        <p class="fc-kpi-label">In review</p>
        <p class="fc-kpi-value">{{ metrics.review }}</p>
        <p class="fc-kpi-sub">Waiting for QA or founder approval</p>
      </div>
      <div class="fc-kpi-card" :data-highlight="metrics.blocked > 0 ? 'error' : 'success'">
        <p class="fc-kpi-label">Blocked</p>
        <p class="fc-kpi-value">{{ metrics.blocked }}</p>
        <p class="fc-kpi-sub">Escalate these first to restore flow</p>
      </div>
      <div class="fc-kpi-card" data-highlight="success">
        <p class="fc-kpi-label">Completion rate</p>
        <p class="fc-kpi-value">{{ metrics.completionRate }}%</p>
        <p class="fc-kpi-sub">{{ metrics.done }} of {{ Math.max(metrics.total, 1) }} tasks finished</p>
      </div>
    </div>

    <Transition name="fc-page">
      <FcCard v-if="showCreateForm" style="margin-bottom: 16px;">
        <div class="fc-section-header">
          <div>
            <h4>Create task</h4>
            <p class="fc-card-desc">Capture the next deliverable, assign an owner, and keep approvals visible.</p>
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
          <p class="fc-card-desc">Focus by project, owner, or status without losing the full task picture.</p>
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
      <p>Try a wider search or switch back to all projects and assignees.</p>
      <FcButton variant="secondary" @click="filters.query = ''; filters.status = 'all'; filters.projectId = 'all'; filters.assigneeAgentId = 'all';">
        Reset filters
      </FcButton>
    </div>

    <div v-else class="task-layout">
      <div class="task-groups">
        <FcCard v-for="group in taskGroups" :key="group.key">
          <div class="fc-section-header">
            <div>
              <h4>{{ group.title }}</h4>
              <p class="fc-card-desc">{{ group.hint }}</p>
            </div>
            <FcBadge :status="group.key">{{ group.tasks.length }}</FcBadge>
          </div>

          <div class="task-list-wrap">
            <article v-for="task in group.tasks" :key="task.id" class="task-item">
              <div class="task-item-top">
                <div>
                  <strong class="task-title">{{ task.title }}</strong>
                  <p class="fc-list-meta" style="margin: 4px 0 0;">
                    {{ task.description }}
                  </p>
                </div>
                <FcBadge :status="task.status">{{ formatStatus(task.status) }}</FcBadge>
              </div>

              <div class="task-meta-grid">
                <span><Workflow :size="13" /> {{ getProjectName(task.projectId) }}</span>
                <span><UserRound :size="13" /> {{ getAgentName(task.assigneeAgentId) }}</span>
                <span><Clock3 :size="13" /> Updated {{ formatRelative(task.updatedAt) }}</span>
              </div>

              <div class="task-actions">
                <FcButton
                  v-for="nextStatus in ALLOWED_TRANSITIONS[task.status]"
                  :key="`${task.id}-${nextStatus}`"
                  variant="secondary"
                  size="sm"
                  :disabled="busyMap[task.id]"
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

      <div class="task-side-panel">
        <FcCard>
          <div class="fc-section-header">
            <div>
              <h4>Queue guidance</h4>
              <p class="fc-card-desc">A simple playbook to keep work moving.</p>
            </div>
          </div>

          <ul class="guidance-list">
            <li>
              <strong>Unblock first</strong>
              <span>Resolve anything in <code>blocked</code> before starting new work.</span>
            </li>
            <li>
              <strong>Review daily</strong>
              <span>Items in <code>review</code> are the fastest path to visible progress.</span>
            </li>
            <li>
              <strong>Keep briefs specific</strong>
              <span>Every task should describe the outcome, constraints, and approval trigger.</span>
            </li>
          </ul>
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

.task-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(260px, 0.65fr);
  gap: 12px;
  align-items: start;
}

.task-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-side-panel {
  position: sticky;
  top: 88px;
}

.task-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-item {
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-control-radius);
  padding: 12px;
  background: color-mix(in srgb, var(--fc-surface-muted) 40%, var(--fc-surface));
}

.task-item-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.task-title {
  display: block;
  font-size: 0.92rem;
  font-weight: 600;
}

.task-meta-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
  margin-top: 10px;
  color: var(--fc-text-muted);
  font-size: 0.76rem;
}

.task-meta-grid span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.task-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.guidance-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.guidance-list li {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.guidance-list strong {
  font-size: 0.85rem;
}

.guidance-list span {
  font-size: 0.8rem;
  color: var(--fc-text-muted);
  line-height: 1.5;
}

@media (max-width: 1100px) {
  .task-layout {
    grid-template-columns: 1fr;
  }

  .task-side-panel {
    position: static;
  }
}
</style>
