import type { AgentListItem } from '@familyco/ui';
import { computed, reactive, ref, watch } from 'vue';

import { uiRuntime } from '../runtime';
import {
  AUTONOMY_GUIDE,
  PAUSABLE_AGENT_STATUSES,
  TEMPLATE_PRESETS,
  isApprovalResponse,
  templateCards,
  type AgentActionResult,
  type AgentLevel,
  type CreateTemplateId,
  type LevelFilter,
  type StatusFilter
} from './agents-page.config';
import { useAgentsDirectory } from './useAgentsDirectory';
import { useAutoReload } from './useAutoReload';

export function useAgentsPage() {
  const showCreateForm = ref(false);
  const isCreating = ref(false);
  const isLoading = ref(false);
  const isRefreshing = ref(false);
  const isSavingParent = ref(false);
  const selectedAgentId = ref<string | null>(null);
  const managerDraft = ref('');
  const busy = ref<Record<string, boolean>>({});
  const feedback = ref<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const filters = reactive({
    searchQuery: '',
    level: 'all' as LevelFilter,
    status: 'all' as StatusFilter,
    department: 'all'
  });

  const draft = reactive({
    name: '',
    role: '',
    level: 'L1' as AgentLevel,
    department: '',
    parentAgentId: ''
  });

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

  const {
    attentionSummary,
    departmentOptions,
    deploymentChecklist,
    draftManagerOptions,
    filteredAgents,
    getAgentInitials,
    getAgentName,
    getDirectReportCount,
    getManagerOptionsFor,
    selectedAgent,
    selectedAutonomy,
    selectedDirectReports,
    selectedManager,
    selectedManagerOptions,
    selectedPath,
    summaryMetrics
  } = useAgentsDirectory(agents, filters, draft, selectedAgentId);

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
        setFeedback('success', `${result.name} is now on your heartbeat roster.`);
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
    if (!PAUSABLE_AGENT_STATUSES.includes(agent.status)) {
      return;
    }

    busy.value = { ...busy.value, [agent.id]: true };
    try {
      const result = await uiRuntime.stores.agents.pauseAgent({ agentId: agent.id }) as AgentActionResult;

      if (isApprovalResponse(result)) {
        setFeedback(
          'info',
          result.reason ? `Pause request queued: ${result.reason}` : `Pause request queued for ${agent.name}.`
        );
      } else {
        setFeedback('success', `${result.name} has been paused for the next heartbeat.`);
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

  return {
    AUTONOMY_GUIDE,
    agentState,
    agents,
    applyTemplate,
    attentionSummary,
    busy,
    createAgent,
    deploymentChecklist,
    departmentOptions,
    draft,
    draftManagerOptions,
    feedback,
    filteredAgents,
    filters,
    getAgentInitials,
    getAgentName,
    getDirectReportCount,
    isCreating,
    isLoading,
    isRefreshing,
    isSavingParent,
    managerDraft,
    pauseAgent,
    reload,
    saveReportingLine,
    selectedAgent,
    selectedAgentId,
    selectedAutonomy,
    selectedDirectReports,
    selectedManager,
    selectedManagerOptions,
    selectedPath,
    showCreateForm,
    summaryMetrics,
    templateCards
  };
}
