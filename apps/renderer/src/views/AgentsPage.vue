<script setup lang="ts">
import type { AgentListItem } from '@familyco/ui';
import { computed, reactive, ref, watch } from 'vue';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  GitBranchPlus,
  Pause,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow
} from 'lucide-vue-next';

import { uiRuntime } from '../runtime';
import SkeletonList from '../components/SkeletonList.vue';
import { useAutoReload } from '../composables/useAutoReload';
import FcBanner from '../components/FcBanner.vue';
import FcBadge from '../components/FcBadge.vue';
import FcButton from '../components/FcButton.vue';
import FcCard from '../components/FcCard.vue';
import FcInput from '../components/FcInput.vue';
import FcSelect from '../components/FcSelect.vue';

type AgentLevel = AgentListItem['level'];
type AgentStatus = AgentListItem['status'];
type LevelFilter = 'all' | AgentLevel;
type StatusFilter = 'all' | AgentStatus;
type CreateTemplateId = 'executive' | 'lead' | 'specialist';
type AgentApprovalResponse = {
  approvalRequired: true;
  approvalRequestId: string;
  reason?: string;
};
type AgentActionResult = AgentListItem | AgentApprovalResponse;

const LEVEL_ORDER: Record<AgentLevel, number> = { L0: 0, L1: 1, L2: 2 };
const STATUS_ORDER: Record<AgentStatus, number> = { active: 0, idle: 1, paused: 2, archived: 3 };
const STATUS_LABELS: Record<AgentStatus, string> = {
  active: 'Active',
  idle: 'Idle',
  paused: 'Paused',
  archived: 'Archived'
};

const TEMPLATE_PRESETS: Record<
  CreateTemplateId,
  {
    title: string;
    description: string;
    draft: {
      name: string;
      role: string;
      level: AgentLevel;
      department: string;
    };
  }
> = {
  executive: {
    title: 'Executive',
    description: 'Set up the L0 command layer for approvals and cross-team delegation.',
    draft: {
      name: 'Chief of Staff',
      role: 'Executive Agent',
      level: 'L0',
      department: 'Executive'
    }
  },
  lead: {
    title: 'Department lead',
    description: 'Create an L1 owner for planning, review, and team coordination.',
    draft: {
      name: 'Operations Lead',
      role: 'Department Lead',
      level: 'L1',
      department: 'Operations'
    }
  },
  specialist: {
    title: 'Specialist',
    description: 'Add a focused L2 operator for repeatable delivery work.',
    draft: {
      name: 'Research Specialist',
      role: 'Specialist Agent',
      level: 'L2',
      department: 'Research'
    }
  }
};

const templateCards = (Object.entries(TEMPLATE_PRESETS) as Array<[
  CreateTemplateId,
  (typeof TEMPLATE_PRESETS)[CreateTemplateId]
]>).map(([id, template]) => ({ id, ...template }));

const AUTONOMY_GUIDE: Record<
  AgentLevel,
  {
    label: string;
    description: string;
    note: string;
  }
> = {
  L0: {
    label: 'Executive governance',
    description: 'Best for company-wide planning, hiring proposals, and decisions that need Founder approval.',
    note: 'Default pattern: suggest-only with the Founder, auto-delegate to department leads.'
  },
  L1: {
    label: 'Department control',
    description: 'Good for planning and coordinating work across one function without losing oversight.',
    note: 'Default pattern: suggest-only for strategic changes, auto for internal coordination.'
  },
  L2: {
    label: 'Execution lane',
    description: 'Optimized for fast delivery on scoped tasks with clear ownership and guardrails.',
    note: 'Default pattern: auto for internal work, require review for external side effects.'
  }
};

const showCreateForm = ref(false);
const isCreating = ref(false);
const isLoading = ref(false);
const isRefreshing = ref(false);
const isSavingParent = ref(false);
const selectedAgentId = ref<string | null>(null);
const searchQuery = ref('');
const levelFilter = ref<LevelFilter>('all');
const statusFilter = ref<StatusFilter>('all');
const departmentFilter = ref('all');
const managerDraft = ref('');
const busy = ref<Record<string, boolean>>({});
const feedback = ref<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

const draft = reactive({
  name: '',
  role: '',
  level: 'L1' as AgentLevel,
  department: '',
  parentAgentId: ''
});

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim().toLowerCase();

const sortAgents = (items: AgentListItem[]): AgentListItem[] =>
  [...items].sort((left, right) => {
    const levelOrder = LEVEL_ORDER[left.level] - LEVEL_ORDER[right.level];
    if (levelOrder !== 0) {
      return levelOrder;
    }

    const statusOrder = STATUS_ORDER[left.status] - STATUS_ORDER[right.status];
    if (statusOrder !== 0) {
      return statusOrder;
    }

    return left.name.localeCompare(right.name);
  });

const isApprovalResponse = (result: AgentActionResult): result is AgentApprovalResponse =>
  'approvalRequired' in result;

const resetDraft = (): void => {
  draft.name = '';
  draft.role = '';
  draft.level = 'L1';
  draft.department = '';
  draft.parentAgentId = '';
};

const setFeedback = (type: 'success' | 'error' | 'info', text: string): void => {
  feedback.value = { type, text };
  setTimeout(() => {
    if (feedback.value?.text === text) {
      feedback.value = null;
    }
  }, 4000);
};

const agentState = computed(() => uiRuntime.stores.agents.state.agents);
const agents = computed(() => agentState.value.data);
const agentMap = computed(() => new Map(agents.value.map((agent) => [agent.id, agent])));

const departmentOptions = computed(() =>
  Array.from(
    new Set(
      agents.value
        .map((agent) => agent.department.trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right))
);

const getManagerOptionsFor = (level: AgentLevel, currentAgentId?: string | null): AgentListItem[] => {
  if (level === 'L0') {
    return [];
  }

  return sortAgents(
    agents.value.filter((agent) => {
      if (agent.id === currentAgentId) {
        return false;
      }

      if (level === 'L1') {
        return agent.level === 'L0';
      }

      return agent.level === 'L0' || agent.level === 'L1';
    })
  );
};

const draftManagerOptions = computed(() => getManagerOptionsFor(draft.level));
const filteredAgents = computed(() => {
  const query = normalizeText(searchQuery.value);

  return sortAgents(
    agents.value.filter((agent) => {
      if (levelFilter.value !== 'all' && agent.level !== levelFilter.value) {
        return false;
      }

      if (statusFilter.value !== 'all' && agent.status !== statusFilter.value) {
        return false;
      }

      if (departmentFilter.value !== 'all' && agent.department !== departmentFilter.value) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = normalizeText([agent.name, agent.role, agent.department].join(' '));
      return haystack.includes(query);
    })
  );
});

const directReportsByAgent = computed(() => {
  const map = new Map<string, AgentListItem[]>();

  for (const agent of agents.value) {
    if (!agent.parentAgentId) {
      continue;
    }

    const existing = map.get(agent.parentAgentId) ?? [];
    existing.push(agent);
    map.set(agent.parentAgentId, sortAgents(existing));
  }

  return map;
});

const selectedAgent = computed(() =>
  filteredAgents.value.find((agent) => agent.id === selectedAgentId.value)
  ?? agents.value.find((agent) => agent.id === selectedAgentId.value)
  ?? filteredAgents.value[0]
  ?? agents.value[0]
  ?? null
);

const selectedManagerOptions = computed(() =>
  selectedAgent.value ? getManagerOptionsFor(selectedAgent.value.level, selectedAgent.value.id) : []
);

const selectedDirectReports = computed(() =>
  selectedAgent.value ? directReportsByAgent.value.get(selectedAgent.value.id) ?? [] : []
);

const selectedManager = computed(() =>
  selectedAgent.value?.parentAgentId ? agentMap.value.get(selectedAgent.value.parentAgentId) ?? null : null
);

const selectedAutonomy = computed(() =>
  selectedAgent.value ? AUTONOMY_GUIDE[selectedAgent.value.level] : AUTONOMY_GUIDE.L1
);

const selectedPath = computed(() => {
  if (!selectedAgent.value) {
    return [] as AgentListItem[];
  }

  const path: AgentListItem[] = [];
  const visited = new Set<string>();
  let current: AgentListItem | null = selectedAgent.value;

  while (current && !visited.has(current.id)) {
    path.unshift(current);
    visited.add(current.id);
    current = current.parentAgentId ? agentMap.value.get(current.parentAgentId) ?? null : null;
  }

  return path;
});

const summaryMetrics = computed(() => {
  const total = agents.value.length;
  const active = agents.value.filter((agent) => agent.status === 'active').length;
  const paused = agents.value.filter((agent) => agent.status === 'paused').length;
  const leads = agents.value.filter((agent) => agent.level !== 'L2').length;
  const ready = agents.value.filter((agent) => agent.level === 'L0' || Boolean(agent.parentAgentId)).length;

  return {
    total,
    active,
    paused,
    leads,
    readiness: total === 0 ? 0 : Math.round((ready / total) * 100)
  };
});

const attentionSummary = computed(() => {
  const paused = agents.value.filter((agent) => agent.status === 'paused').length;
  const missingManager = agents.value.filter((agent) => agent.level !== 'L0' && !agent.parentAgentId).length;
  return { paused, missingManager };
});

const deploymentChecklist = computed(() => {
  if (!selectedAgent.value) {
    return [];
  }

  const agent = selectedAgent.value;
  return [
    {
      title: 'Ownership is clear',
      text: agent.level === 'L0'
        ? 'Executive agents should stay at the root of the org chart.'
        : agent.parentAgentId
          ? 'This agent already reports into the right leadership lane.'
          : 'Assign a manager so this agent can receive work in the correct chain.',
      done: agent.level === 'L0' || Boolean(agent.parentAgentId)
    },
    {
      title: 'Status is deployment-ready',
      text: agent.status === 'paused'
        ? 'Paused agents will not pick up new work until you reactivate them.'
        : 'This agent is visible and ready for routing in the current control plane.',
      done: agent.status === 'active' || agent.status === 'idle'
    },
    {
      title: 'Scope matches hierarchy',
      text: AUTONOMY_GUIDE[agent.level].note,
      done: true
    }
  ];
});

const orgRows = computed(() => {
  const rows: Array<{ agent: AgentListItem; depth: number; reportCount: number }> = [];
  const visited = new Set<string>();

  const visit = (agent: AgentListItem, depth: number): void => {
    if (visited.has(agent.id)) {
      return;
    }

    visited.add(agent.id);
    rows.push({
      agent,
      depth,
      reportCount: directReportsByAgent.value.get(agent.id)?.length ?? 0
    });

    for (const child of directReportsByAgent.value.get(agent.id) ?? []) {
      visit(child, depth + 1);
    }
  };

  const roots = sortAgents(
    agents.value.filter((agent) => !agent.parentAgentId || !agentMap.value.has(agent.parentAgentId))
  );

  for (const root of roots) {
    visit(root, 0);
  }

  for (const agent of sortAgents(agents.value)) {
    if (!visited.has(agent.id)) {
      visit(agent, 0);
    }
  }

  return rows;
});

watch(
  agents,
  (nextAgents) => {
    if (!nextAgents.length) {
      selectedAgentId.value = null;
      return;
    }

    if (!selectedAgentId.value || !nextAgents.some((agent) => agent.id === selectedAgentId.value)) {
      selectedAgentId.value = nextAgents[0].id;
    }
  },
  { immediate: true }
);

watch(
  selectedAgent,
  (agent) => {
    managerDraft.value = agent?.parentAgentId ?? '';
  },
  { immediate: true }
);

watch(
  () => draft.level,
  (level) => {
    if (level === 'L0') {
      draft.parentAgentId = '';
      return;
    }

    if (draft.parentAgentId && !draftManagerOptions.value.some((agent) => agent.id === draft.parentAgentId)) {
      draft.parentAgentId = '';
    }
  }
);

const getAgentName = (agentId: string | null): string => {
  if (!agentId) {
    return 'Unassigned';
  }

  return agentMap.value.get(agentId)?.name ?? 'Unknown';
};

const getAgentInitials = (name: string): string =>
  name
    .split(' ')
    .map((part) => part.slice(0, 1))
    .join('')
    .slice(0, 2)
    .toUpperCase();

const applyTemplate = (templateId: CreateTemplateId): void => {
  const template = TEMPLATE_PRESETS[templateId];
  draft.name = template.draft.name;
  draft.role = template.draft.role;
  draft.level = template.draft.level;
  draft.department = template.draft.department;
  draft.parentAgentId = getManagerOptionsFor(template.draft.level)[0]?.id ?? '';
  showCreateForm.value = true;
};

const reload = async (): Promise<void> => {
  feedback.value = null;
  isLoading.value = true;
  isRefreshing.value = true;

  try {
    await uiRuntime.stores.agents.loadAgents();
  } finally {
    isLoading.value = false;
    isRefreshing.value = false;
  }
};

const createAgent = async (): Promise<void> => {
  if (!draft.name.trim() || !draft.role.trim() || !draft.department.trim()) {
    return;
  }

  isCreating.value = true;
  try {
    const result = await uiRuntime.stores.agents.createAgent({
      name: draft.name.trim(),
      role: draft.role.trim(),
      level: draft.level,
      department: draft.department.trim(),
      parentAgentId: draft.level === 'L0' ? null : draft.parentAgentId || null
    }) as AgentActionResult;

    if (isApprovalResponse(result)) {
      setFeedback(
        'info',
        result.reason
          ? `Approval queued: ${result.reason}`
          : 'Approval request created. The agent will appear once it is approved.'
      );
    } else {
      setFeedback('success', `${result.name} is now part of your AI team.`);
      selectedAgentId.value = result.id;
    }

    resetDraft();
    showCreateForm.value = false;
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to create agent');
  } finally {
    isCreating.value = false;
  }
};

const pauseAgent = async (agent: AgentListItem): Promise<void> => {
  if (agent.status !== 'active') {
    return;
  }

  busy.value = { ...busy.value, [agent.id]: true };
  try {
    const result = await uiRuntime.stores.agents.pauseAgent({ agentId: agent.id }) as AgentActionResult;

    if (isApprovalResponse(result)) {
      setFeedback(
        'info',
        result.reason
          ? `Pause request queued: ${result.reason}`
          : `Pause request queued for ${agent.name}.`
      );
    } else {
      setFeedback('success', `${result.name} has been paused.`);
    }
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to pause agent');
  } finally {
    busy.value = { ...busy.value, [agent.id]: false };
  }
};

const saveReportingLine = async (): Promise<void> => {
  if (!selectedAgent.value || selectedAgent.value.level === 'L0') {
    return;
  }

  isSavingParent.value = true;
  try {
    const updatedAgent = await uiRuntime.stores.agents.updateAgentParent({
      agentId: selectedAgent.value.id,
      parentAgentId: managerDraft.value || null
    });

    setFeedback(
      'success',
      updatedAgent.parentAgentId
        ? `${updatedAgent.name} now reports to ${getAgentName(updatedAgent.parentAgentId)}.`
        : `${updatedAgent.name} has been moved to the root for now.`
    );
  } catch (error) {
    setFeedback('error', error instanceof Error ? error.message : 'Failed to update reporting line');
  } finally {
    isSavingParent.value = false;
  }
};

useAutoReload(reload);
</script>

<template>
  <section>
    <div class="fc-page-header">
      <div>
        <h3>Agents</h3>
        <p>Build a clear, deployable AI org — easy to scan, easy to configure, easy to govern.</p>
      </div>
      <div class="fc-inline-actions">
        <FcButton variant="secondary" :disabled="isRefreshing" @click="reload">
          <RefreshCw :size="14" />
          {{ isRefreshing ? 'Refreshing…' : 'Refresh' }}
        </FcButton>
        <FcButton variant="primary" @click="showCreateForm = !showCreateForm">
          <Plus :size="14" />
          {{ showCreateForm ? 'Close setup' : 'New agent' }}
        </FcButton>
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

    <div class="fc-grid-kpi">
      <div class="fc-kpi-card" data-highlight="primary">
        <p class="fc-kpi-label">Headcount</p>
        <p class="fc-kpi-value">{{ summaryMetrics.total }}</p>
        <p class="fc-kpi-sub">Total agents in the control plane</p>
      </div>
      <div class="fc-kpi-card" data-highlight="success">
        <p class="fc-kpi-label">Active now</p>
        <p class="fc-kpi-value">{{ summaryMetrics.active }}</p>
        <p class="fc-kpi-sub">{{ summaryMetrics.paused }} paused and awaiting attention</p>
      </div>
      <div class="fc-kpi-card" data-highlight="info">
        <p class="fc-kpi-label">Leads in place</p>
        <p class="fc-kpi-value">{{ summaryMetrics.leads }}</p>
        <p class="fc-kpi-sub">L0 and L1 coverage across the org</p>
      </div>
      <div
        class="fc-kpi-card"
        :data-highlight="attentionSummary.paused || attentionSummary.missingManager ? 'warning' : 'success'"
      >
        <p class="fc-kpi-label">Deploy-ready</p>
        <p class="fc-kpi-value">{{ summaryMetrics.readiness }}%</p>
        <p class="fc-kpi-sub">Agents with a clear reporting line</p>
      </div>
    </div>

    <div class="ag-hero-grid">
      <FcCard class="ag-hero-card">
        <div class="ag-kicker">
          <Workflow :size="14" />
          Agent control plane
        </div>
        <div>
          <h4 class="ag-hero-title">Run your AI org like a calm operations center.</h4>
          <p class="ag-hero-copy">
            Hire from templates, wire clear reporting lines, and keep autonomy visible without making setup heavy.
          </p>
        </div>
        <ul class="ag-bullet-list">
          <li>See hierarchy, status, and deployment readiness at a glance.</li>
          <li>Use level-based defaults so each agent starts with the right guardrails.</li>
          <li>Keep configuration simple: name, role, department, manager, then launch.</li>
        </ul>
      </FcCard>

      <FcCard class="ag-template-card">
        <div class="ag-section-head">
          <div>
            <h4>Quick starts</h4>
            <p>Launch the most common roles in one click.</p>
          </div>
          <Sparkles :size="16" class="ag-muted-icon" />
        </div>
        <div class="ag-template-list">
          <button
            v-for="template in templateCards"
            :key="template.id"
            class="ag-template-button"
            type="button"
            @click="applyTemplate(template.id)"
          >
            <div>
              <strong>{{ template.title }}</strong>
              <p>{{ template.description }}</p>
            </div>
            <Plus :size="14" />
          </button>
        </div>
      </FcCard>
    </div>

    <Transition name="fc-banner">
      <FcCard v-if="showCreateForm" class="ag-create-card">
        <div class="ag-section-head">
          <div>
            <h4>Create agent</h4>
            <p>Keep setup short: define role, assign the right level, then place the agent in the org chart.</p>
          </div>
        </div>

        <div class="ag-template-strip">
          <button class="ag-template-chip" type="button" @click="applyTemplate('executive')">L0 executive</button>
          <button class="ag-template-chip" type="button" @click="applyTemplate('lead')">L1 department lead</button>
          <button class="ag-template-chip" type="button" @click="applyTemplate('specialist')">L2 specialist</button>
        </div>

        <div class="fc-form-grid">
          <div class="fc-form-group">
            <label class="fc-label">Name</label>
            <FcInput v-model="draft.name" placeholder="e.g. Nora — Ops Lead" />
          </div>
          <div class="fc-form-group">
            <label class="fc-label">Role</label>
            <FcInput v-model="draft.role" placeholder="e.g. Operations Lead" />
          </div>
          <div class="fc-form-group">
            <label class="fc-label">Department</label>
            <FcInput v-model="draft.department" placeholder="e.g. Operations" />
          </div>
          <div class="fc-form-group">
            <label class="fc-label">Level</label>
            <FcSelect v-model="draft.level">
              <option value="L0">L0 — Executive layer</option>
              <option value="L1">L1 — Department lead</option>
              <option value="L2">L2 — Specialist</option>
            </FcSelect>
          </div>
          <div class="fc-form-group ag-span-2">
            <label class="fc-label">Reports to</label>
            <FcSelect v-model="draft.parentAgentId" :disabled="draft.level === 'L0' || draftManagerOptions.length === 0">
              <option value="">
                {{ draft.level === 'L0' ? 'Executive agents stay at the root' : 'No manager assigned yet' }}
              </option>
              <option
                v-for="manager in draftManagerOptions"
                :key="manager.id"
                :value="manager.id"
              >
                {{ manager.name }} — {{ manager.role }}
              </option>
            </FcSelect>
          </div>
        </div>

        <div class="ag-note-box">
          <div class="ag-note-head">
            <ShieldCheck :size="15" />
            <strong>{{ AUTONOMY_GUIDE[draft.level].label }}</strong>
          </div>
          <p>{{ AUTONOMY_GUIDE[draft.level].description }}</p>
          <small>{{ AUTONOMY_GUIDE[draft.level].note }}</small>
        </div>

        <div class="fc-toolbar">
          <FcButton
            variant="primary"
            :disabled="isCreating || !draft.name.trim() || !draft.role.trim() || !draft.department.trim()"
            @click="createAgent"
          >
            <Plus :size="14" />
            {{ isCreating ? 'Creating…' : 'Create agent' }}
          </FcButton>
          <FcButton variant="ghost" @click="showCreateForm = false">Cancel</FcButton>
        </div>
      </FcCard>
    </Transition>

    <div v-if="isLoading" class="fc-loading">
      <p style="margin:0 0 12px;font-size:0.875rem;color:var(--fc-text-muted);">Loading agent control plane…</p>
      <SkeletonList />
    </div>

    <div v-else-if="agentState.errorMessage" class="fc-error">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <AlertTriangle :size="16" />
        <p style="margin:0;">{{ agentState.errorMessage }}</p>
      </div>
      <FcButton variant="secondary" size="sm" @click="reload">
        <RefreshCw :size="13" />
        Retry
      </FcButton>
    </div>

    <div v-else-if="agentState.isEmpty" class="fc-empty">
      <Bot :size="36" class="fc-empty-icon" />
      <h4>No agents yet</h4>
      <p>Start with an executive agent, then add department leads and specialists as the team grows.</p>
      <FcButton variant="primary" @click="applyTemplate('executive')">
        <Plus :size="14" />
        Create first agent
      </FcButton>
    </div>

    <div v-else class="ag-main-grid">
      <FcCard class="ag-list-card">
        <div class="ag-section-head">
          <div>
            <h4>Roster</h4>
            <p>Search, filter, and act on your AI team without leaving the page.</p>
          </div>
          <Users :size="16" class="ag-muted-icon" />
        </div>

        <div class="ag-filters">
          <FcInput v-model="searchQuery" placeholder="Search by name, role, or department" />
          <FcSelect v-model="levelFilter">
            <option value="all">All levels</option>
            <option value="L0">L0</option>
            <option value="L1">L1</option>
            <option value="L2">L2</option>
          </FcSelect>
          <FcSelect v-model="statusFilter">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="idle">Idle</option>
            <option value="paused">Paused</option>
            <option value="archived">Archived</option>
          </FcSelect>
          <FcSelect v-model="departmentFilter">
            <option value="all">All departments</option>
            <option
              v-for="department in departmentOptions"
              :key="department"
              :value="department"
            >
              {{ department }}
            </option>
          </FcSelect>
        </div>

        <p class="ag-results-copy">
          Showing <strong>{{ filteredAgents.length }}</strong> of <strong>{{ agents.length }}</strong> agents.
          <template v-if="attentionSummary.paused || attentionSummary.missingManager">
            {{ attentionSummary.paused }} paused · {{ attentionSummary.missingManager }} missing manager.
          </template>
        </p>

        <div v-if="filteredAgents.length === 0" class="fc-empty ag-compact-empty">
          <h4>No agents match these filters</h4>
          <p>Try broadening the level, status, or department scope.</p>
        </div>

        <div v-else class="ag-roster-list">
          <div
            v-for="agent in filteredAgents"
            :key="agent.id"
            class="ag-agent-row"
            :class="{ 'is-selected': agent.id === selectedAgent?.id }"
            @click="selectedAgentId = agent.id"
          >
            <div class="ag-agent-main">
              <div class="ag-avatar" :data-level="agent.level">
                {{ getAgentInitials(agent.name) }}
              </div>
              <div class="ag-agent-copy">
                <div class="ag-agent-title">
                  <strong>{{ agent.name }}</strong>
                  <FcBadge :level="agent.level">{{ agent.level }}</FcBadge>
                </div>
                <p class="fc-list-meta">{{ agent.role }} · {{ agent.department }}</p>
                <p class="ag-agent-subcopy">
                  {{ agent.level === 'L0' ? 'Company root' : `Reports to ${getAgentName(agent.parentAgentId)}` }}
                  <span v-if="(directReportsByAgent.get(agent.id) ?? []).length > 0">
                    · {{ (directReportsByAgent.get(agent.id) ?? []).length }} direct reports
                  </span>
                </p>
              </div>
            </div>

            <div class="ag-row-actions">
              <span
                v-if="agent.level !== 'L0' && !agent.parentAgentId"
                class="fc-risk-tag"
                data-risk="medium"
              >
                Manager needed
              </span>
              <FcBadge :status="agent.status">{{ STATUS_LABELS[agent.status] }}</FcBadge>
              <FcButton
                v-if="agent.status === 'active'"
                variant="secondary"
                size="sm"
                :disabled="busy[agent.id]"
                @click.stop="pauseAgent(agent)"
              >
                <Pause :size="12" />
                {{ busy[agent.id] ? 'Pausing…' : 'Pause' }}
              </FcButton>
            </div>
          </div>
        </div>
      </FcCard>

      <div class="ag-side-column">
        <FcCard class="ag-org-card">
          <div class="ag-section-head">
            <div>
              <h4>Org chart</h4>
              <p>Review the reporting chain before you deploy more specialists.</p>
            </div>
            <GitBranchPlus :size="16" class="ag-muted-icon" />
          </div>

          <div class="ag-tree-list">
            <div
              v-for="row in orgRows"
              :key="row.agent.id"
              class="ag-tree-row"
              :class="{ 'is-selected': row.agent.id === selectedAgent?.id }"
              :style="{ paddingLeft: `${12 + row.depth * 18}px` }"
              @click="selectedAgentId = row.agent.id"
            >
              <div class="ag-tree-main">
                <span class="ag-tree-dot" :data-level="row.agent.level"></span>
                <strong>{{ row.agent.name }}</strong>
                <FcBadge :level="row.agent.level">{{ row.agent.level }}</FcBadge>
              </div>
              <span class="ag-tree-meta">
                {{ row.reportCount }} report{{ row.reportCount === 1 ? '' : 's' }}
              </span>
            </div>
          </div>
        </FcCard>

        <FcCard v-if="selectedAgent" class="ag-detail-card">
          <div class="ag-section-head">
            <div>
              <h4>Selected agent</h4>
              <p>Use this panel to validate hierarchy, governance, and readiness.</p>
            </div>
            <ShieldCheck :size="16" class="ag-muted-icon" />
          </div>

          <div class="ag-detail-header">
            <div class="ag-avatar ag-avatar-large" :data-level="selectedAgent.level">
              {{ getAgentInitials(selectedAgent.name) }}
            </div>
            <div class="ag-detail-copy">
              <div class="ag-agent-title">
                <strong>{{ selectedAgent.name }}</strong>
                <FcBadge :level="selectedAgent.level">{{ selectedAgent.level }}</FcBadge>
                <FcBadge :status="selectedAgent.status">{{ STATUS_LABELS[selectedAgent.status] }}</FcBadge>
              </div>
              <p class="fc-list-meta">{{ selectedAgent.role }} · {{ selectedAgent.department }}</p>
            </div>
          </div>

          <div
            v-if="selectedAgent.status === 'paused' || (selectedAgent.level !== 'L0' && !selectedAgent.parentAgentId)"
            class="fc-warning"
          >
            <p>
              {{
                selectedAgent.status === 'paused'
                  ? 'This agent is paused and will not receive new work.'
                  : 'This agent needs a manager assignment before rollout feels complete.'
              }}
            </p>
          </div>

          <div class="ag-mini-grid">
            <div class="ag-mini-stat">
              <span>Reports to</span>
              <strong>{{ selectedManager?.name ?? 'Root / unassigned' }}</strong>
            </div>
            <div class="ag-mini-stat">
              <span>Direct reports</span>
              <strong>{{ selectedDirectReports.length }}</strong>
            </div>
            <div class="ag-mini-stat">
              <span>Default lane</span>
              <strong>{{ selectedAutonomy.label }}</strong>
            </div>
          </div>

          <div class="ag-path">
            <span
              v-for="(agent, index) in selectedPath"
              :key="agent.id"
              class="ag-path-chip"
            >
              {{ agent.name }}
              <span v-if="index < selectedPath.length - 1">→</span>
            </span>
          </div>

          <div class="ag-note-box">
            <div class="ag-note-head">
              <ShieldCheck :size="15" />
              <strong>{{ selectedAutonomy.label }}</strong>
            </div>
            <p>{{ selectedAutonomy.description }}</p>
            <small>{{ selectedAutonomy.note }}</small>
          </div>

          <div v-if="selectedAgent.level !== 'L0'" class="fc-form-group">
            <label class="fc-label">Reports to</label>
            <FcSelect v-model="managerDraft">
              <option value="">No manager assigned yet</option>
              <option
                v-for="manager in selectedManagerOptions"
                :key="manager.id"
                :value="manager.id"
              >
                {{ manager.name }} — {{ manager.role }}
              </option>
            </FcSelect>
            <div class="fc-toolbar">
              <FcButton
                variant="secondary"
                size="sm"
                :disabled="isSavingParent || managerDraft === (selectedAgent.parentAgentId ?? '')"
                @click="saveReportingLine"
              >
                <GitBranchPlus :size="12" />
                {{ isSavingParent ? 'Saving…' : 'Save reporting line' }}
              </FcButton>
            </div>
          </div>

          <div class="ag-checklist">
            <div
              v-for="item in deploymentChecklist"
              :key="item.title"
              class="ag-checklist-item"
            >
              <CheckCircle2 :size="16" :class="item.done ? 'ag-check-ok' : 'ag-check-todo'" />
              <div>
                <strong>{{ item.title }}</strong>
                <p>{{ item.text }}</p>
              </div>
            </div>
          </div>
        </FcCard>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ag-hero-grid,
.ag-main-grid {
  display: grid;
  gap: 12px;
}

.ag-hero-grid {
  grid-template-columns: 1.2fr 0.95fr;
  margin-bottom: 16px;
}

.ag-main-grid {
  grid-template-columns: 1.18fr 0.92fr;
  align-items: start;
}

.ag-side-column,
.ag-list-card,
.ag-org-card,
.ag-detail-card,
.ag-template-card,
.ag-hero-card,
.ag-create-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ag-kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 4px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--fc-primary) 10%, var(--fc-surface));
  color: var(--fc-primary);
  font-size: 0.75rem;
  font-weight: 700;
}

.ag-hero-title {
  margin: 0 0 6px;
  font-size: 1.05rem;
  font-weight: 700;
}

.ag-hero-copy {
  margin: 0;
  color: var(--fc-text-muted);
  font-size: 0.875rem;
  line-height: 1.5;
}

.ag-bullet-list {
  margin: 0;
  padding-left: 18px;
  color: var(--fc-text-muted);
  display: grid;
  gap: 6px;
  font-size: 0.8125rem;
}

.ag-section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.ag-section-head h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.ag-section-head p {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  color: var(--fc-text-muted);
  line-height: 1.45;
}

.ag-muted-icon {
  color: var(--fc-text-faint);
  flex-shrink: 0;
}

.ag-template-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ag-template-button,
.ag-template-chip {
  border: 1px solid var(--fc-border-subtle);
  background: var(--fc-surface);
  border-radius: var(--fc-control-radius);
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
}

.ag-template-button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  text-align: left;
  padding: 10px 12px;
  cursor: pointer;
}

.ag-template-button:hover,
.ag-template-chip:hover {
  border-color: color-mix(in srgb, var(--fc-primary) 35%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-primary) 6%, var(--fc-surface));
}

.ag-template-button:active,
.ag-template-chip:active {
  transform: scale(0.99);
}

.ag-template-button strong {
  display: block;
  font-size: 0.875rem;
}

.ag-template-button p {
  margin: 4px 0 0;
  font-size: 0.75rem;
  color: var(--fc-text-muted);
  line-height: 1.45;
}

.ag-template-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ag-template-chip {
  padding: 6px 10px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--fc-text-main);
}

.ag-create-card {
  margin: 0 0 16px;
}

.ag-span-2 {
  grid-column: span 2;
}

.ag-filters {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) repeat(3, minmax(0, 0.8fr));
  gap: 8px;
}

.ag-results-copy {
  margin: 0;
  font-size: 0.78rem;
  color: var(--fc-text-muted);
}

.ag-roster-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ag-agent-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-control-radius);
  background: var(--fc-surface);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
}

.ag-agent-row:hover {
  border-color: color-mix(in srgb, var(--fc-primary) 24%, var(--fc-border-subtle));
  box-shadow: 0 4px 10px rgba(16, 24, 40, 0.05);
}

.ag-agent-row.is-selected {
  border-color: color-mix(in srgb, var(--fc-primary) 40%, var(--fc-border-subtle));
  background: color-mix(in srgb, var(--fc-primary) 5%, var(--fc-surface));
}

.ag-agent-main {
  display: flex;
  gap: 12px;
  min-width: 0;
}

.ag-avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.82rem;
  font-weight: 700;
  border: 1px solid var(--fc-border-subtle);
}

.ag-avatar[data-level='L0'] {
  background: color-mix(in srgb, #7B61FF 12%, var(--fc-surface));
  color: #7B61FF;
}

.ag-avatar[data-level='L1'] {
  background: color-mix(in srgb, var(--fc-info) 12%, var(--fc-surface));
  color: var(--fc-info);
}

.ag-avatar[data-level='L2'] {
  background: color-mix(in srgb, var(--fc-success) 12%, var(--fc-surface));
  color: var(--fc-success);
}

.ag-avatar-large {
  width: 48px;
  height: 48px;
  border-radius: 14px;
}

.ag-agent-copy {
  min-width: 0;
}

.ag-agent-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ag-agent-title strong {
  font-size: 0.9rem;
}

.ag-agent-subcopy {
  margin: 4px 0 0;
  font-size: 0.75rem;
  color: var(--fc-text-muted);
}

.ag-row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ag-tree-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ag-tree-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--fc-control-radius);
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  transition: background 0.15s, border-color 0.15s;
}

.ag-tree-row:hover,
.ag-tree-row.is-selected {
  background: color-mix(in srgb, var(--fc-primary) 6%, var(--fc-surface));
  border-color: color-mix(in srgb, var(--fc-primary) 24%, var(--fc-border-subtle));
}

.ag-tree-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ag-tree-main strong {
  font-size: 0.82rem;
}

.ag-tree-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
  background: var(--fc-text-faint);
}

.ag-tree-dot[data-level='L0'] {
  background: #7B61FF;
}

.ag-tree-dot[data-level='L1'] {
  background: var(--fc-info);
}

.ag-tree-dot[data-level='L2'] {
  background: var(--fc-success);
}

.ag-tree-meta {
  font-size: 0.72rem;
  color: var(--fc-text-muted);
  white-space: nowrap;
}

.ag-detail-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.ag-detail-copy {
  min-width: 0;
}

.ag-mini-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.ag-mini-stat {
  padding: 10px 12px;
  border: 1px solid var(--fc-border-subtle);
  border-radius: var(--fc-control-radius);
  background: var(--fc-surface-muted);
}

.ag-mini-stat span {
  display: block;
  font-size: 0.72rem;
  color: var(--fc-text-muted);
  margin-bottom: 4px;
}

.ag-mini-stat strong {
  font-size: 0.82rem;
  line-height: 1.35;
}

.ag-path {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ag-path-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--fc-surface-muted);
  color: var(--fc-text-main);
  font-size: 0.74rem;
}

.ag-note-box {
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--fc-info) 26%, var(--fc-border-subtle));
  border-radius: var(--fc-card-radius);
  background: color-mix(in srgb, var(--fc-info) 6%, var(--fc-surface));
}

.ag-note-head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 6px;
  color: var(--fc-text-main);
}

.ag-note-box p {
  margin: 0 0 6px;
  font-size: 0.82rem;
  color: var(--fc-text-muted);
  line-height: 1.5;
}

.ag-note-box small {
  display: block;
  color: var(--fc-text-muted);
  font-size: 0.74rem;
}

.ag-checklist {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ag-checklist-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.ag-checklist-item strong {
  display: block;
  font-size: 0.82rem;
  margin-bottom: 3px;
}

.ag-checklist-item p {
  margin: 0;
  font-size: 0.76rem;
  color: var(--fc-text-muted);
  line-height: 1.45;
}

.ag-check-ok {
  color: var(--fc-success);
  flex-shrink: 0;
  margin-top: 2px;
}

.ag-check-todo {
  color: var(--fc-warning);
  flex-shrink: 0;
  margin-top: 2px;
}

.ag-compact-empty {
  padding: 24px 18px;
}

@media (max-width: 1100px) {
  .ag-hero-grid,
  .ag-main-grid {
    grid-template-columns: 1fr;
  }

  .ag-filters {
    grid-template-columns: 1fr 1fr;
  }

  .ag-mini-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .ag-filters,
  .fc-form-grid {
    grid-template-columns: 1fr;
  }

  .ag-span-2 {
    grid-column: span 1;
  }

  .ag-agent-row,
  .ag-detail-header {
    flex-direction: column;
  }

  .ag-row-actions {
    justify-content: flex-start;
  }
}
</style>
