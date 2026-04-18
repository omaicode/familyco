import type { AgentListItem, TranslationParams } from '@familyco/ui';
import type { ComputedRef, Ref } from 'vue';

import { uiRuntime } from '../runtime';
import {
  ARCHIVABLE_AGENT_STATUSES,
  PAUSABLE_AGENT_STATUSES,
  RESUMABLE_AGENT_STATUSES,
  isApprovalResponse,
  type AgentActionResult,
  type AgentDeleteActionResult
} from './agents-page.config';
import { parseApiError } from '../utils/api-error';

type FeedbackType = 'success' | 'error' | 'info';

interface AgentDraftState {
  name: string;
  role: string;
  level: AgentListItem['level'];
  department: string;
  parentAgentId: string;
}

interface UseAgentPageActionsOptions {
  t: (key: string, params?: TranslationParams) => string;
  draft: AgentDraftState;
  showCreateForm: Ref<boolean>;
  isCreating: Ref<boolean>;
  isSavingParent: Ref<boolean>;
  busy: Ref<Record<string, boolean>>;
  managerDraft: Ref<string>;
  selectedAgentId: Ref<string | null>;
  selectedAgent: ComputedRef<AgentListItem | null>;
  selectedTaskId: Ref<string | null>;
  getAgentName: (agentId: string | null) => string;
  resetDraft: () => void;
  setFeedback: (type: FeedbackType, text: string) => void;
  persistAgentDetails: () => Promise<AgentListItem>;
}

export function useAgentPageActions(options: UseAgentPageActionsOptions) {
  const resolveCreateAgentErrorMessage = (error: unknown): string => {
    const parsed = parseApiError(error);
    if (parsed.code === 'AGENT_L0_ALREADY_EXISTS') {
      return options.t('Only one active L0 executive is allowed.');
    }

    return parsed.message || options.t('Failed to create agent');
  };

  const createAgent = async (): Promise<void> => {
    if (!options.draft.name.trim() || !options.draft.role.trim() || !options.draft.department.trim()) {
      return;
    }

    options.isCreating.value = true;
    try {
      const result = await uiRuntime.stores.agents.createAgent({
        name: options.draft.name.trim(),
        role: options.draft.role.trim(),
        level: options.draft.level,
        department: options.draft.department.trim(),
        parentAgentId: options.draft.parentAgentId || null
      }) as AgentActionResult;

      if (isApprovalResponse(result)) {
        options.setFeedback(
          'info',
          result.reason
            ? `Approval queued: ${result.reason}`
            : 'Approval request created. The agent will appear once it is approved.'
        );
      } else {
        options.setFeedback('success', `${result.name} is now on your heartbeat roster.`);
        options.selectedAgentId.value = result.id;
      }

      options.resetDraft();
      options.showCreateForm.value = false;
    } catch (error) {
      options.setFeedback('error', resolveCreateAgentErrorMessage(error));
    } finally {
      options.isCreating.value = false;
    }
  };

  const pauseAgent = async (agent: AgentListItem): Promise<void> => {
    if (!PAUSABLE_AGENT_STATUSES.includes(agent.status)) {
      return;
    }

    options.busy.value = { ...options.busy.value, [agent.id]: true };
    try {
      const result = await uiRuntime.stores.agents.pauseAgent({ agentId: agent.id }) as AgentActionResult;

      if (isApprovalResponse(result)) {
        options.setFeedback(
          'info',
          result.reason ? `Pause request queued: ${result.reason}` : `Pause request queued for ${agent.name}.`
        );
      } else {
        options.setFeedback('success', `${result.name} has been paused for the next heartbeat.`);
      }
    } catch (error) {
      options.setFeedback('error', error instanceof Error ? error.message : 'Failed to pause agent');
    } finally {
      options.busy.value = { ...options.busy.value, [agent.id]: false };
    }
  };

  const deleteAgent = async (agent: AgentListItem): Promise<void> => {
    if (!window.confirm(options.t('Delete agent confirm prompt', { name: agent.name }))) {
      return;
    }

    options.busy.value = { ...options.busy.value, [agent.id]: true };
    try {
      const result = await uiRuntime.stores.agents.deleteAgent({
        agentId: agent.id
      }) as AgentDeleteActionResult;

      if (isApprovalResponse(result)) {
        options.setFeedback(
          'info',
          result.reason
            ? options.t('Delete agent approval queued with reason', { reason: result.reason })
            : options.t('Delete agent approval queued')
        );
        return;
      }

      await Promise.all([
        uiRuntime.stores.projects.loadProjects(),
        uiRuntime.stores.tasks.refresh()
      ]);
      options.selectedTaskId.value = null;

      options.setFeedback(
        'success',
        options.t('Delete agent success summary', {
          name: agent.name,
          tasks: result.reassignedTaskCount,
          projects: result.reassignedProjectCount,
          reports: result.reassignedChildAgentCount
        })
      );
    } catch (error) {
      options.setFeedback('error', error instanceof Error ? error.message : options.t('Failed to delete agent'));
    } finally {
      options.busy.value = { ...options.busy.value, [agent.id]: false };
    }
  };

  const resumeAgent = async (agent: AgentListItem): Promise<void> => {
    if (!RESUMABLE_AGENT_STATUSES.includes(agent.status)) {
      return;
    }

    options.busy.value = { ...options.busy.value, [agent.id]: true };
    try {
      const result = await uiRuntime.stores.agents.resumeAgent({ agentId: agent.id }) as AgentActionResult;

      if (isApprovalResponse(result)) {
        options.setFeedback(
          'info',
          result.reason ? `Resume request queued: ${result.reason}` : `Resume request queued for ${agent.name}.`
        );
      } else {
        options.setFeedback('success', `${result.name} resumed and can receive new work.`);
      }
    } catch (error) {
      options.setFeedback('error', error instanceof Error ? error.message : 'Failed to resume agent');
    } finally {
      options.busy.value = { ...options.busy.value, [agent.id]: false };
    }
  };

  const archiveAgent = async (agent: AgentListItem): Promise<void> => {
    if (!ARCHIVABLE_AGENT_STATUSES.includes(agent.status)) {
      return;
    }

    options.busy.value = { ...options.busy.value, [agent.id]: true };
    try {
      const result = await uiRuntime.stores.agents.archiveAgent({ agentId: agent.id }) as AgentActionResult;

      if (isApprovalResponse(result)) {
        options.setFeedback(
          'info',
          result.reason ? `Archive request queued: ${result.reason}` : `Archive request queued for ${agent.name}.`
        );
      } else {
        options.setFeedback('success', `${result.name} has been archived.`);
      }
    } catch (error) {
      options.setFeedback('error', error instanceof Error ? error.message : 'Failed to archive agent');
    } finally {
      options.busy.value = { ...options.busy.value, [agent.id]: false };
    }
  };

  const saveReportingLine = async (): Promise<void> => {
    if (!options.selectedAgent.value || options.selectedAgent.value.level === 'L0') {
      return;
    }

    options.isSavingParent.value = true;
    try {
      const updatedAgent = await uiRuntime.stores.agents.updateAgentParent({
        agentId: options.selectedAgent.value.id,
        parentAgentId: options.managerDraft.value || null
      });

      options.setFeedback(
        'success',
        updatedAgent.parentAgentId
          ? `${updatedAgent.name} now reports to ${options.getAgentName(updatedAgent.parentAgentId)}.`
          : `${updatedAgent.name} has been moved to the root for now.`
      );
    } catch (error) {
      options.setFeedback('error', error instanceof Error ? error.message : 'Failed to update reporting line');
    } finally {
      options.isSavingParent.value = false;
    }
  };

  const saveAgentDetails = async (): Promise<void> => {
    try {
      const updatedAgent = await options.persistAgentDetails();
      options.setFeedback('success', options.t('Agent profile saved', { name: updatedAgent.name }));
    } catch (error) {
      options.setFeedback('error', error instanceof Error ? error.message : options.t('Failed to update agent'));
    }
  };

  return {
    archiveAgent,
    createAgent,
    deleteAgent,
    pauseAgent,
    resumeAgent,
    saveAgentDetails,
    saveReportingLine
  };
}
