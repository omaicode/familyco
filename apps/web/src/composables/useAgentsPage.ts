import type { AgentListItem } from '@familyco/ui';
import { computed, reactive, ref, watch } from 'vue';

import { uiRuntime } from '../runtime';
import {
  AUTONOMY_GUIDE,
  TEMPLATE_PRESETS,
  templateCards,
  type AgentLevel,
  type CreateTemplateId,
  type LevelFilter,
  type StatusFilter
} from './agents-page.config';
import { useAgentPageActions } from './useAgentPageActions';
import { useAgentInsights } from './useAgentInsights';
import { useAgentsDirectory } from './useAgentsDirectory';
import { useAutoReload } from './useAutoReload';
import { useI18n } from './useI18n';

export function useAgentsPage() {
  const { t } = useI18n();
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
  const defaultExecutiveAgentId = computed(() => {
    const executives = agents.value
      .filter((agent) => agent.level === 'L0')
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

    return executives[0]?.id ?? null;
  });

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

  const {
    currentTasks,
    detailDraft,
    detailError,
    formatRelative,
    formatTimestamp,
    getProjectName,
    history,
    isLoadingDetails,
    isSavingDetails,
    saveAgentDetails: persistAgentDetails,
    selectedTask,
    selectedTaskId,
    selectTask
  } = useAgentInsights(selectedAgent);

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

  const {
    archiveAgent,
    createAgent,
    deleteAgent,
    pauseAgent,
    resumeAgent,
    saveAgentDetails,
    saveReportingLine
  } = useAgentPageActions({
    t,
    draft,
    showCreateForm,
    isCreating,
    isSavingParent,
    busy,
    managerDraft,
    selectedAgentId,
    selectedAgent,
    selectedTaskId,
    getAgentName,
    resetDraft,
    setFeedback,
    persistAgentDetails
  });
  const canDeleteAgent = (agent: AgentListItem): boolean => agent.id !== defaultExecutiveAgentId.value;

  useAutoReload(reload);

  return {
    AUTONOMY_GUIDE,
    archiveAgent,
    agentState,
    agents,
    applyTemplate,
    attentionSummary,
    busy,
    canDeleteAgent,
    createAgent,
    currentTasks,
    deploymentChecklist,
    departmentOptions,
    detailDraft,
    detailError,
    draft,
    draftManagerOptions,
    feedback,
    filteredAgents,
    filters,
    formatRelative,
    formatTimestamp,
    getAgentInitials,
    getAgentName,
    getDirectReportCount,
    getProjectName,
    history,
    isCreating,
    isLoading,
    isLoadingDetails,
    isRefreshing,
    isSavingDetails,
    isSavingParent,
    managerDraft,
    deleteAgent,
    pauseAgent,
    resumeAgent,
    reload,
    saveAgentDetails,
    saveReportingLine,
    selectTask,
    selectedAgent,
    selectedAgentId,
    selectedAutonomy,
    selectedDirectReports,
    selectedManager,
    selectedManagerOptions,
    selectedPath,
    selectedTask,
    selectedTaskId,
    setFeedback,
    showCreateForm,
    summaryMetrics,
    templateCards
  };
}
