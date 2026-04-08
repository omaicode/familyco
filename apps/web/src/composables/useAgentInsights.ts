import type { AgentListItem, AuditListItem, ProjectListItem, TaskListItem } from '@familyco/ui';
import { computed, reactive, ref, watch, type ComputedRef } from 'vue';

import { uiRuntime } from '../runtime';
import { useI18n } from './useI18n';

const OPEN_TASK_STATUSES = new Set<TaskListItem['status']>(['pending', 'in_progress', 'review', 'blocked']);

const sortByNewest = <T extends { updatedAt?: string; createdAt?: string }>(items: T[]): T[] =>
  [...items].sort((left, right) => {
    const leftTime = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
    const rightTime = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime();
    return rightTime - leftTime;
  });

export function useAgentInsights(selectedAgent: ComputedRef<AgentListItem | null>) {
  const { locale, t } = useI18n();

  const isLoadingDetails = ref(false);
  const isSavingDetails = ref(false);
  const detailError = ref<string | null>(null);
  const tasks = ref<TaskListItem[]>([]);
  const history = ref<AuditListItem[]>([]);
  const projects = ref<ProjectListItem[]>([]);
  const selectedTaskId = ref<string | null>(null);

  const detailDraft = reactive<{
    name: string;
    role: string;
    department: string;
    status: AgentListItem['status'];
  }>({
    name: '',
    role: '',
    department: '',
    status: 'active'
  });

  const syncDraft = (agent: AgentListItem | null): void => {
    detailDraft.name = agent?.name ?? '';
    detailDraft.role = agent?.role ?? '';
    detailDraft.department = agent?.department ?? '';
    detailDraft.status = agent?.status ?? 'active';
  };

  const loadDetails = async (agentId?: string | null): Promise<void> => {
    if (!agentId) {
      tasks.value = [];
      history.value = [];
      detailError.value = null;
      selectedTaskId.value = null;
      isLoadingDetails.value = false;
      return;
    }

    isLoadingDetails.value = true;
    detailError.value = null;

    try {
      const [taskItems, actorHistoryItems, targetHistoryItems, projectItems] = await Promise.all([
        uiRuntime.api.listTasks({ assigneeAgentId: agentId }),
        uiRuntime.api.listAudit({ actorId: agentId, limit: 20 }),
        uiRuntime.api.listAudit({ targetId: agentId, limit: 20 }),
        projects.value.length > 0 ? Promise.resolve(projects.value) : uiRuntime.api.listProjects()
      ]);

      const historyItems = Array.from(
        new Map([...actorHistoryItems, ...targetHistoryItems].map((item) => [item.id, item])).values()
      );

      if (selectedAgent.value?.id !== agentId) {
        return;
      }

      tasks.value = sortByNewest(taskItems);
      history.value = sortByNewest(historyItems);
      projects.value = projectItems;

      const preferredTask = tasks.value.find((task) => OPEN_TASK_STATUSES.has(task.status));
      selectedTaskId.value = preferredTask?.id ?? tasks.value[0]?.id ?? null;
    } catch (error) {
      if (selectedAgent.value?.id !== agentId) {
        return;
      }

      tasks.value = [];
      history.value = [];
      selectedTaskId.value = null;
      detailError.value = error instanceof Error ? error.message : t('Failed to load agent insights');
    } finally {
      if (selectedAgent.value?.id === agentId) {
        isLoadingDetails.value = false;
      }
    }
  };

  const saveAgentDetails = async (): Promise<AgentListItem> => {
    const agent = selectedAgent.value;
    if (!agent) {
      throw new Error('AGENT_NOT_SELECTED');
    }

    isSavingDetails.value = true;
    try {
      const updatedAgent = await uiRuntime.stores.agents.updateAgent({
        agentId: agent.id,
        name: detailDraft.name.trim(),
        role: detailDraft.role.trim(),
        department: detailDraft.department.trim(),
        status: detailDraft.status
      });

      syncDraft(updatedAgent);
      await loadDetails(updatedAgent.id);
      return updatedAgent;
    } finally {
      isSavingDetails.value = false;
    }
  };

  watch(
    selectedAgent,
    (agent) => {
      syncDraft(agent);
      void loadDetails(agent?.id ?? null);
    },
    { immediate: true }
  );

  const currentTasks = computed(() => {
    const openTasks = tasks.value.filter((task) => OPEN_TASK_STATUSES.has(task.status));
    return openTasks.length > 0 ? openTasks : tasks.value.slice(0, 5);
  });

  const selectedTask = computed(() =>
    currentTasks.value.find((task) => task.id === selectedTaskId.value) ?? currentTasks.value[0] ?? null
  );

  const formatRelative = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(diff)) {
      return t('Unknown time');
    }

    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return t('just now');
    if (minutes < 60) return t('{{count}}m ago', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('{{count}}h ago', { count: hours });
    return t('{{count}}d ago', { count: Math.floor(hours / 24) });
  };

  const formatTimestamp = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return t('Unknown time');
    }

    return new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };

  const selectTask = (taskId: string): void => {
    selectedTaskId.value = taskId;
  };

  const getProjectName = (projectId: string): string =>
    projects.value.find((project) => project.id === projectId)?.name ?? projectId;

  return {
    currentTasks,
    detailDraft,
    detailError,
    formatRelative,
    formatTimestamp,
    getProjectName,
    history,
    isLoadingDetails,
    isSavingDetails,
    saveAgentDetails,
    selectedTask,
    selectedTaskId,
    selectTask
  };
}
