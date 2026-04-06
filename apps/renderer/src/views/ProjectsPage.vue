<script setup lang="ts">
import type { AgentListItem, ProjectListItem, TaskListItem } from '@familyco/ui';
import { computed, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  FolderKanban,
  GitBranch,
  Inbox,
  Plus,
  RefreshCw,
  Target,
  TriangleAlert,
  Users,
  Workflow
} from 'lucide-vue-next';

import { uiRuntime } from '../runtime';
import SkeletonList from '../components/SkeletonList.vue';
import { useAutoReload } from '../composables/useAutoReload';
import FcBanner from '../components/FcBanner.vue';
import FcButton from '../components/FcButton.vue';
import FcCard from '../components/FcCard.vue';
import FcInput from '../components/FcInput.vue';
import FcSelect from '../components/FcSelect.vue';

type PortfolioFilter = 'all' | 'attention' | 'healthy' | 'roots';
type RiskLevel = 'healthy' | 'watch' | 'critical';

interface ProjectCard extends ProjectListItem {
  owner: AgentListItem | null;
  tasks: TaskListItem[];
  childCount: number;
  counts: {
    pending: number;
    inProgress: number;
    review: number;
    done: number;
    blocked: number;
    cancelled: number;
    total: number;
  };
  openTasks: number;
  risk: RiskLevel;
  healthText: string;
  preview: string;
}

const showCreateForm = ref(false);
const isCreating = ref(false);
const isRefreshing = ref(false);
const selectedProjectId = ref<string | null>(null);
const filterMode = ref<PortfolioFilter>('all');
const searchQuery = ref('');
const feedback = ref<{ type: 'success' | 'error'; text: string } | null>(null);

const draft = reactive({
  name: '',
  description: '',
  ownerAgentId: '',
  parentProjectId: ''
});

const projectState = computed(() => uiRuntime.stores.projects.state);

const setFeedback = (type: 'success' | 'error', text: string): void => {
  feedback.value = { type, text };
  setTimeout(() => {
    if (feedback.value?.text === text) {
      feedback.value = null;
    }
  }, 4000);
};

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const getPreview = (description: string): string => {
  const normalized = normalizeText(description);
  if (!normalized) {
    return 'Add a short operational brief so agents understand the objective and boundaries.';
  }

  return normalized.length <= 130 ? normalized : `${normalized.slice(0, 127)}…`;
};

const getBriefLines = (description: string): string[] => {
  const parts = description
    .split(/\n+|(?<=[.!?])\s+/)
    .map((item) => normalizeText(item))
    .filter(Boolean);

  return (parts.length
    ? parts
    : ['Define the objective, success criteria, scope, and constraints for the assigned agents.'])
    .slice(0, 4);
};

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Recently updated';
  }

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

const formatRelative = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'just now';
  }

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const ownerOptions = computed(() =>
  projectState.value.data.agents.filter((agent) => agent.status !== 'archived' && agent.level !== 'L2')
);

const getAgentLabel = (agentId: string | null | undefined): string => {
  if (!agentId) {
    return 'Unassigned';
  }

  return projectState.value.data.agents.find((agent) => agent.id === agentId)?.name ?? agentId;
};

const buildProjectCard = (project: ProjectListItem): ProjectCard => {
  const tasks = projectState.value.data.taskMap[project.id] ?? [];
  const owner = projectState.value.data.agents.find((agent) => agent.id === project.ownerAgentId) ?? null;
  const childCount = projectState.value.data.projects.filter((item) => item.parentProjectId === project.id).length;

  const counts = {
    pending: tasks.filter((task) => task.status === 'pending').length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
    review: tasks.filter((task) => task.status === 'review').length,
    done: tasks.filter((task) => task.status === 'done').length,
    blocked: tasks.filter((task) => task.status === 'blocked').length,
    cancelled: tasks.filter((task) => task.status === 'cancelled').length,
    total: tasks.length
  };

  const openTasks = counts.pending + counts.inProgress + counts.review + counts.blocked;
  const risk: RiskLevel = counts.blocked > 0 ? 'critical' : counts.review > 0 ? 'watch' : 'healthy';

  let healthText = 'Brief ready for agents';
  if (counts.blocked > 0) {
    healthText = `${counts.blocked} blocked item${counts.blocked === 1 ? '' : 's'} need attention`;
  } else if (counts.review > 0) {
    healthText = `${counts.review} item${counts.review === 1 ? '' : 's'} awaiting review`;
  } else if (openTasks > 0) {
    healthText = `${openTasks} task${openTasks === 1 ? '' : 's'} moving through delivery`;
  } else if (counts.done > 0) {
    healthText = `${counts.done} completed deliverable${counts.done === 1 ? '' : 's'}`;
  }

  return {
    ...project,
    owner,
    tasks,
    childCount,
    counts,
    openTasks,
    risk,
    healthText,
    preview: getPreview(project.description)
  };
};

const projects = computed(() => {
  const riskOrder: Record<RiskLevel, number> = {
    critical: 0,
    watch: 1,
    healthy: 2
  };

  return projectState.value.data.projects
    .map(buildProjectCard)
    .sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk] || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
});

const filteredProjects = computed(() => {
  const keyword = normalizeText(searchQuery.value).toLowerCase();

  return projects.value.filter((project) => {
    const matchesKeyword = !keyword || [
      project.name,
      project.description,
      project.owner?.name ?? '',
      project.owner?.role ?? ''
    ].some((field) => field.toLowerCase().includes(keyword));

    if (!matchesKeyword) {
      return false;
    }

    if (filterMode.value === 'attention') {
      return project.risk !== 'healthy';
    }

    if (filterMode.value === 'healthy') {
      return project.risk === 'healthy';
    }

    if (filterMode.value === 'roots') {
      return !project.parentProjectId;
    }

    return true;
  });
});

const selectedProject = computed(() => {
  if (filteredProjects.value.length === 0) {
    return null;
  }

  return filteredProjects.value.find((project) => project.id === selectedProjectId.value) ?? filteredProjects.value[0];
});

const selectedTasks = computed(() => {
  if (!selectedProject.value) {
    return [] as TaskListItem[];
  }

  const order: Record<TaskListItem['status'], number> = {
    blocked: 0,
    review: 1,
    in_progress: 2,
    pending: 3,
    done: 4,
    cancelled: 5
  };

  return [...selectedProject.value.tasks].sort((a, b) => order[a.status] - order[b.status]);
});

const portfolioMetrics = computed(() => {
  const attentionCount = projects.value.filter((project) => project.risk !== 'healthy').length;
  const ownersInvolved = new Set(projects.value.map((project) => project.ownerAgentId)).size;
  const openTasks = projects.value.reduce((total, project) => total + project.openTasks, 0);
  const blockedTasks = projects.value.reduce((total, project) => total + project.counts.blocked, 0);

  return {
    totalProjects: projects.value.length,
    attentionCount,
    ownersInvolved,
    openTasks,
    blockedTasks
  };
});

const riskTone = (risk: RiskLevel): 'low' | 'medium' | 'high' => {
  if (risk === 'critical') return 'high';
  if (risk === 'watch') return 'medium';
  return 'low';
};

const riskLabel = (risk: RiskLevel): string => {
  if (risk === 'critical') return 'Needs action';
  if (risk === 'watch') return 'Watch';
  return 'Healthy';
};

const resetDraft = (): void => {
  draft.name = '';
  draft.description = '';
  draft.parentProjectId = '';
  draft.ownerAgentId = ownerOptions.value[0]?.id ?? '';
};

const reload = async (): Promise<void> => {
  feedback.value = null;
  isRefreshing.value = true;

  try {
    await uiRuntime.stores.projects.loadProjects();

    if (!draft.ownerAgentId && ownerOptions.value.length > 0) {
      draft.ownerAgentId = ownerOptions.value[0].id;
    }

    const availableIds = filteredProjects.value.map((project) => project.id);
    if (!selectedProjectId.value || !availableIds.includes(selectedProjectId.value)) {
      selectedProjectId.value = availableIds[0] ?? null;
    }
  } finally {
    isRefreshing.value = false;
  }
};

const createProject = async (): Promise<void> => {
  if (!draft.name || !draft.description || !draft.ownerAgentId) {
    return;
  }

  isCreating.value = true;

  try {
    const result = await uiRuntime.stores.projects.createProject({
      name: normalizeText(draft.name),
      description: draft.description.trim(),
      ownerAgentId: draft.ownerAgentId,
      parentProjectId: draft.parentProjectId || null
    });

    showCreateForm.value = false;

    if ('approvalRequired' in result) {
      setFeedback('success', result.reason || 'Project request sent for approval.');
    } else {
      selectedProjectId.value = result.id;
      setFeedback('success', 'Project created successfully');
    }

    resetDraft();
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to create project');
  } finally {
    isCreating.value = false;
  }
};

useAutoReload(reload);
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>Projects</h3>
        <p>Give every agent a clear brief: what this project is, why it matters, and how delivery should run.</p>
      </div>
      <div class="fc-inline-actions">
        <button class="fc-btn-secondary" :disabled="isRefreshing" @click="reload">
          <RefreshCw :size="14" :class="{ 'fc-spin': isRefreshing }" />
          {{ isRefreshing ? 'Refreshing…' : 'Refresh' }}
        </button>
        <button class="fc-btn-primary" @click="showCreateForm = !showCreateForm">
          <Plus :size="14" />
          {{ showCreateForm ? 'Close form' : 'New project' }}
        </button>
      </div>
    </div>

    <Transition name="fc-banner">
      <FcBanner
        v-if="feedback"
        :type="feedback.type"
        closable
        style="margin-bottom:14px;"
        @close="feedback = null"
      >
        {{ feedback.text }}
      </FcBanner>
    </Transition>

    <Transition name="fc-page">
      <FcCard v-if="showCreateForm" style="margin-bottom:16px;">
        <div class="fc-section-header" style="margin-bottom:14px;align-items:flex-start;">
          <div>
            <h4 style="margin:0;">Create project brief</h4>
            <p class="fc-list-meta" style="margin:4px 0 0;">Projects work best when an L0 or L1 owner is clearly accountable for scope and handoffs.</p>
          </div>
          <span class="fc-risk-tag" data-risk="low">Agent-ready</span>
        </div>

        <div class="fc-form-grid" style="margin-bottom:12px;">
          <div class="fc-form-group">
            <label class="fc-label">Project name</label>
            <FcInput v-model="draft.name" placeholder="e.g. Q2 Growth Engine" />
          </div>

          <div class="fc-form-group">
            <label class="fc-label">Owner agent</label>
            <FcSelect v-model="draft.ownerAgentId">
              <option value="" disabled>Select an L0 or L1 owner</option>
              <option v-for="agent in ownerOptions" :key="agent.id" :value="agent.id">
                {{ agent.name }} — {{ agent.role }}
              </option>
            </FcSelect>
          </div>

          <div class="fc-form-group" style="grid-column:1 / -1;">
            <label class="fc-label">Operational brief</label>
            <textarea
              v-model="draft.description"
              class="fc-textarea"
              placeholder="Describe the goal, success criteria, scope, constraints, and how agents should execute this project."
            ></textarea>
          </div>

          <div class="fc-form-group">
            <label class="fc-label">Parent project (optional)</label>
            <FcSelect v-model="draft.parentProjectId">
              <option value="">No parent project</option>
              <option v-for="project in projects" :key="project.id" :value="project.id">
                {{ project.name }}
              </option>
            </FcSelect>
          </div>
        </div>

        <p class="fc-list-meta" style="margin:0 0 12px;">
          Tip: write the brief as if a new agent needs to understand the project in under one minute.
        </p>

        <div class="fc-toolbar">
          <FcButton
            variant="primary"
            :disabled="isCreating || !draft.name || !draft.description || !draft.ownerAgentId"
            @click="createProject"
          >
            <Plus :size="14" />
            {{ isCreating ? 'Creating…' : 'Create project' }}
          </FcButton>
          <FcButton variant="ghost" @click="showCreateForm = false">Cancel</FcButton>
        </div>
      </FcCard>
    </Transition>

    <div v-if="projectState.isLoading" class="fc-loading">
      <p style="margin:0 0 12px;font-size:0.875rem;color:var(--fc-text-muted);">Loading project portfolio…</p>
      <SkeletonList />
    </div>

    <div v-else-if="projectState.errorMessage" class="fc-error">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <AlertTriangle :size="16" />
        <p style="margin:0;">{{ projectState.errorMessage }}</p>
      </div>
      <FcButton variant="secondary" size="sm" @click="reload">
        <RefreshCw :size="13" /> Retry
      </FcButton>
    </div>

    <div v-else-if="projectState.isEmpty" class="fc-empty">
      <FolderKanban :size="36" class="fc-empty-icon" />
      <h4>No projects yet</h4>
      <p>Create your first project so agents know the objective, owner, and execution boundaries.</p>
      <FcButton variant="primary" :disabled="ownerOptions.length === 0" @click="showCreateForm = true">
        <Plus :size="14" /> Create first project
      </FcButton>
      <p v-if="ownerOptions.length === 0" class="fc-list-meta" style="margin-top:10px;">
        Create at least one L0 or L1 agent first so the project has an accountable owner.
      </p>
    </div>

    <template v-else>
      <div class="fc-grid-kpi" style="grid-template-columns:repeat(4,minmax(0,1fr));">
        <article class="fc-kpi-card" data-highlight="primary">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
            <p class="fc-kpi-label" style="margin:0;">Projects</p>
            <FolderKanban :size="16" style="color:var(--fc-primary);opacity:0.7;" />
          </div>
          <p class="fc-kpi-value">{{ portfolioMetrics.totalProjects }}</p>
          <p class="fc-kpi-sub">active briefs in portfolio</p>
        </article>

        <article class="fc-kpi-card" :data-highlight="portfolioMetrics.attentionCount > 0 ? 'warning' : 'success'">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
            <p class="fc-kpi-label" style="margin:0;">Needs attention</p>
            <TriangleAlert :size="16" :style="{ color: portfolioMetrics.attentionCount > 0 ? 'var(--fc-warning)' : 'var(--fc-success)', opacity: '0.7' }" />
          </div>
          <p class="fc-kpi-value">{{ portfolioMetrics.attentionCount }}</p>
          <p class="fc-kpi-sub">projects with blockers or review load</p>
        </article>

        <article class="fc-kpi-card" :data-highlight="portfolioMetrics.blockedTasks > 0 ? 'error' : 'info'">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
            <p class="fc-kpi-label" style="margin:0;">Open tasks</p>
            <Workflow :size="16" :style="{ color: portfolioMetrics.blockedTasks > 0 ? 'var(--fc-error)' : 'var(--fc-info)', opacity: '0.7' }" />
          </div>
          <p class="fc-kpi-value">{{ portfolioMetrics.openTasks }}</p>
          <p class="fc-kpi-sub">{{ portfolioMetrics.blockedTasks }} currently blocked</p>
        </article>

        <article class="fc-kpi-card" data-highlight="info">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">
            <p class="fc-kpi-label" style="margin:0;">Owners involved</p>
            <Users :size="16" style="color:var(--fc-info);opacity:0.7;" />
          </div>
          <p class="fc-kpi-value">{{ portfolioMetrics.ownersInvolved }}</p>
          <p class="fc-kpi-sub">L0/L1 owners accountable</p>
        </article>
      </div>

      <FcCard style="margin-bottom:12px;">
        <div class="fc-toolbar" style="align-items:flex-end;">
          <div class="fc-form-group" style="min-width:220px;flex:1 1 240px;">
            <label class="fc-label">Search</label>
            <FcInput v-model="searchQuery" placeholder="Search by project, owner, or brief" />
          </div>
          <div class="fc-form-group" style="min-width:190px;">
            <label class="fc-label">Filter</label>
            <FcSelect v-model="filterMode">
              <option value="all">All projects</option>
              <option value="attention">Needs attention</option>
              <option value="healthy">Healthy delivery</option>
              <option value="roots">Root projects only</option>
            </FcSelect>
          </div>
        </div>
      </FcCard>

      <div class="fc-project-layout">
        <div class="fc-stack">
          <FcCard>
            <div class="fc-section-header" style="align-items:flex-start;">
              <div>
                <h4 style="margin:0;">Project portfolio</h4>
                <p class="fc-list-meta" style="margin:4px 0 0;">Choose a project to inspect its context, owner, and operating rhythm.</p>
              </div>
              <span class="fc-badge">{{ filteredProjects.length }} visible</span>
            </div>

            <div v-if="filteredProjects.length === 0" class="fc-empty" style="padding:24px;border:none;">
              <p style="margin:0;">No projects match the current filter.</p>
            </div>

            <div v-else class="fc-stack">
              <button
                v-for="project in filteredProjects"
                :key="project.id"
                type="button"
                class="fc-project-card"
                :class="{ 'is-selected': selectedProject?.id === project.id }"
                @click="selectedProjectId = project.id"
              >
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
                  <div style="flex:1;min-width:0;text-align:left;">
                    <strong style="font-size:0.9375rem;display:block;">{{ project.name }}</strong>
                    <p class="fc-list-meta" style="margin:4px 0 0;">
                      {{ project.owner?.name || 'Unassigned owner' }} · updated {{ formatRelative(project.updatedAt) }}
                    </p>
                  </div>
                  <span class="fc-risk-tag" :data-risk="riskTone(project.risk)">
                    {{ riskLabel(project.risk) }}
                  </span>
                </div>

                <p class="fc-project-preview">{{ project.preview }}</p>

                <div class="fc-project-chip-row">
                  <span class="fc-badge">{{ project.openTasks }} open</span>
                  <span v-if="project.counts.blocked > 0" class="fc-badge" data-status="blocked">
                    {{ project.counts.blocked }} blocked
                  </span>
                  <span v-if="project.counts.done > 0" class="fc-badge" data-status="done">
                    {{ project.counts.done }} done
                  </span>
                  <span v-if="project.childCount > 0" class="fc-badge">
                    {{ project.childCount }} subproject{{ project.childCount === 1 ? '' : 's' }}
                  </span>
                </div>

                <p class="fc-list-meta" style="margin:8px 0 0;color:var(--fc-text-main);">
                  {{ project.healthText }}
                </p>
              </button>
            </div>
          </FcCard>
        </div>

        <div class="fc-stack">
          <FcCard v-if="selectedProject">
            <div class="fc-section-header" style="align-items:flex-start;">
              <div>
                <h4 style="margin:0;">{{ selectedProject.name }}</h4>
                <p class="fc-list-meta" style="margin:4px 0 0;">{{ selectedProject.owner?.role || 'Assign an accountable owner' }}</p>
              </div>
              <div class="fc-inline-actions">
                <span class="fc-risk-tag" :data-risk="riskTone(selectedProject.risk)">
                  {{ riskLabel(selectedProject.risk) }}
                </span>
                <RouterLink class="fc-btn-secondary fc-btn-sm" to="/tasks">
                  <Workflow :size="12" /> View tasks
                </RouterLink>
                <RouterLink
                  v-if="selectedProject.counts.blocked > 0"
                  class="fc-btn-primary fc-btn-sm"
                  to="/inbox"
                >
                  <Inbox :size="12" /> Resolve blockers
                </RouterLink>
              </div>
            </div>

            <div class="fc-project-meta-grid">
              <div class="fc-project-mini-card">
                <span>Owner</span>
                <strong>{{ selectedProject.owner?.name || 'Unassigned' }}</strong>
                <p>{{ selectedProject.owner?.department || 'Choose an L0 or L1 owner' }}</p>
              </div>
              <div class="fc-project-mini-card">
                <span>Structure</span>
                <strong>{{ selectedProject.parentProjectId ? 'Sub-project' : 'Root project' }}</strong>
                <p>{{ selectedProject.childCount }} child project{{ selectedProject.childCount === 1 ? '' : 's' }}</p>
              </div>
              <div class="fc-project-mini-card">
                <span>Delivery state</span>
                <strong>{{ selectedProject.healthText }}</strong>
                <p>{{ selectedProject.counts.total }} total task{{ selectedProject.counts.total === 1 ? '' : 's' }}</p>
              </div>
              <div class="fc-project-mini-card">
                <span>Updated</span>
                <strong>{{ formatRelative(selectedProject.updatedAt) }}</strong>
                <p>{{ formatDate(selectedProject.updatedAt) }}</p>
              </div>
            </div>

            <hr class="fc-divider" />

            <div class="fc-section-header" style="margin-bottom:10px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <FileText :size="14" style="color:var(--fc-text-muted);" />
                <h4 style="margin:0;">Project brief for agents</h4>
              </div>
            </div>

            <div class="fc-project-brief-box">
              <ul class="fc-project-brief-list">
                <li v-for="line in getBriefLines(selectedProject.description)" :key="line">
                  {{ line }}
                </li>
              </ul>
            </div>
          </FcCard>

          <FcCard v-if="selectedProject">
            <div class="fc-section-header" style="align-items:flex-start;">
              <div>
                <h4 style="margin:0;">Current execution lane</h4>
                <p class="fc-list-meta" style="margin:4px 0 0;">What agents are actively doing inside this project right now.</p>
              </div>
              <span class="fc-badge">{{ selectedTasks.length }} tasks</span>
            </div>

            <ul v-if="selectedTasks.length > 0" class="fc-list">
              <li v-for="task in selectedTasks.slice(0, 6)" :key="task.id" class="fc-list-item">
                <div class="fc-list-item-content">
                  <strong>{{ task.title }}</strong>
                  <p class="fc-list-meta">{{ getAgentLabel(task.assigneeAgentId) }} · created by {{ getAgentLabel(task.createdBy) }}</p>
                </div>
                <span class="fc-badge" :data-status="task.status">{{ task.status }}</span>
              </li>
            </ul>

            <div v-else class="fc-empty" style="padding:24px;border:none;">
              <p style="margin:0;">No tasks yet. Once the owner decomposes the project, delivery work will appear here.</p>
            </div>
          </FcCard>

          <FcCard v-if="selectedProject">
            <div class="fc-section-header" style="align-items:flex-start;">
              <div>
                <h4 style="margin:0;">How delivery runs</h4>
                <p class="fc-list-meta" style="margin:4px 0 0;">A quick operational guide so every agent follows the same rhythm.</p>
              </div>
            </div>

            <ul class="fc-list">
              <li class="fc-list-item">
                <div class="fc-list-item-content">
                  <strong style="display:flex;align-items:center;gap:8px;">
                    <Target :size="14" style="color:var(--fc-primary);" />
                    Outcome & scope
                  </strong>
                  <p class="fc-list-meta">Use this brief as the single source of truth for goals, constraints, and expected handoffs.</p>
                </div>
              </li>
              <li class="fc-list-item">
                <div class="fc-list-item-content">
                  <strong style="display:flex;align-items:center;gap:8px;">
                    <Users :size="14" style="color:var(--fc-info);" />
                    Owner accountability
                  </strong>
                  <p class="fc-list-meta">{{ selectedProject.owner?.name || 'An owner' }} should keep the plan current, assign work, and surface decisions when scope changes.</p>
                </div>
              </li>
              <li class="fc-list-item">
                <div class="fc-list-item-content">
                  <strong style="display:flex;align-items:center;gap:8px;">
                    <Workflow :size="14" style="color:var(--fc-success);" />
                    Execution flow
                  </strong>
                  <p class="fc-list-meta">Move work through <code>pending → in_progress → review → done</code> so the whole hierarchy can read progress at a glance.</p>
                </div>
              </li>
              <li class="fc-list-item">
                <div class="fc-list-item-content">
                  <strong style="display:flex;align-items:center;gap:8px;">
                    <GitBranch :size="14" style="color:var(--fc-warning);" />
                    Escalation & approvals
                  </strong>
                  <p class="fc-list-meta">
                    <template v-if="selectedProject.counts.blocked > 0">
                      {{ selectedProject.counts.blocked }} blocked item{{ selectedProject.counts.blocked === 1 ? '' : 's' }} should be escalated through Inbox before anyone changes scope or executes side effects.
                    </template>
                    <template v-else>
                      No current blockers — approvals should still route through Inbox whenever the work needs founder review.
                    </template>
                  </p>
                </div>
              </li>
              <li class="fc-list-item">
                <div class="fc-list-item-content">
                  <strong style="display:flex;align-items:center;gap:8px;">
                    <Clock3 :size="14" style="color:var(--fc-text-muted);" />
                    Cadence
                  </strong>
                  <p class="fc-list-meta">Review this project whenever the owner updates the brief, a task becomes blocked, or a new sub-project is created.</p>
                </div>
              </li>
            </ul>
          </FcCard>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
@keyframes spin { to { transform: rotate(360deg); } }
.fc-spin { animation: spin 1s linear infinite; }

.fc-project-layout {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 12px;
  align-items: start;
}

.fc-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fc-project-card {
  width: 100%;
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-card-radius);
  background: var(--fc-surface);
  padding: 14px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.12s;
}

.fc-project-card:hover {
  border-color: color-mix(in srgb, var(--fc-primary) 28%, var(--fc-border-subtle));
  box-shadow: 0 4px 12px rgba(16, 24, 40, 0.08);
}

.fc-project-card:active {
  transform: scale(0.99);
}

.fc-project-card.is-selected {
  border-color: color-mix(in srgb, var(--fc-primary) 38%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-primary) 6%, var(--fc-surface));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--fc-primary) 16%, transparent);
}

.fc-project-preview {
  margin: 10px 0 0;
  color: var(--fc-text-muted);
  font-size: 0.8125rem;
  line-height: 1.55;
}

.fc-project-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.fc-project-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.fc-project-mini-card {
  border: 1px solid var(--fc-border-subtle);
  border-radius: 10px;
  padding: 12px;
  background: color-mix(in srgb, var(--fc-surface-muted) 50%, var(--fc-surface));
}

.fc-project-mini-card span {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--fc-text-faint);
}

.fc-project-mini-card strong {
  display: block;
  margin-top: 6px;
  font-size: 0.9rem;
  color: var(--fc-text-main);
}

.fc-project-mini-card p {
  margin: 4px 0 0;
  font-size: 0.75rem;
  color: var(--fc-text-muted);
}

.fc-project-brief-box {
  border: 1px dashed var(--fc-border-subtle);
  border-radius: 10px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--fc-surface-muted) 35%, var(--fc-surface));
}

.fc-project-brief-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--fc-text-main);
  font-size: 0.875rem;
  line-height: 1.55;
}

@media (max-width: 1080px) {
  .fc-project-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .fc-project-meta-grid {
    grid-template-columns: 1fr;
  }
}
</style>
