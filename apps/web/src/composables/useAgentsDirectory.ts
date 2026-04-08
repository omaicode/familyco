import type { AgentListItem } from '@familyco/ui';
import { computed, type ComputedRef, type Ref } from 'vue';

import {
  AUTONOMY_GUIDE,
  ATTENTION_AGENT_STATUSES,
  HEARTBEAT_READY_STATUSES,
  HEALTHY_AGENT_STATUSES,
  normalizeText,
  sortAgents,
  type AgentLevel,
  type LevelFilter,
  type StatusFilter
} from './agents-page.config';

interface AgentFilters {
  searchQuery: string;
  level: LevelFilter;
  status: StatusFilter;
  department: string;
}

interface AgentDraft {
  level: AgentLevel;
  parentAgentId: string;
}

export function useAgentsDirectory(
  agents: ComputedRef<AgentListItem[]>,
  filters: AgentFilters,
  draft: AgentDraft,
  selectedAgentId: Ref<string | null>
) {
  const agentMap = computed(() => new Map(agents.value.map((agent) => [agent.id, agent])));

  const departmentOptions = computed(() =>
    Array.from(new Set(agents.value.map((agent) => agent.department.trim()).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right)
    )
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

        return level === 'L1' ? agent.level === 'L0' : agent.level === 'L0' || agent.level === 'L1';
      })
    );
  };

  const draftManagerOptions = computed(() => getManagerOptionsFor(draft.level));

  const filteredAgents = computed(() => {
    const query = normalizeText(filters.searchQuery);

    return sortAgents(
      agents.value.filter((agent) => {
        if (filters.level !== 'all' && agent.level !== filters.level) {
          return false;
        }

        if (filters.status !== 'all' && agent.status !== filters.status) {
          return false;
        }

        if (filters.department !== 'all' && agent.department !== filters.department) {
          return false;
        }

        if (!query) {
          return true;
        }

        return normalizeText([agent.name, agent.role, agent.department].join(' ')).includes(query);
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

  const getDirectReportCount = (agentId: string): number => directReportsByAgent.value.get(agentId)?.length ?? 0;

  const selectedAgent = computed(() => {
    if (!agents.value.length) {
      return null;
    }

    return (
      filteredAgents.value.find((agent) => agent.id === selectedAgentId.value)
      ?? agents.value.find((agent) => agent.id === selectedAgentId.value)
      ?? filteredAgents.value[0]
      ?? agents.value[0]
    );
  });

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
    const heartbeatReady = agents.value.filter((agent) => HEARTBEAT_READY_STATUSES.includes(agent.status)).length;
    const running = agents.value.filter((agent) => agent.status === 'running').length;
    const attention = agents.value.filter((agent) => ATTENTION_AGENT_STATUSES.includes(agent.status)).length;
    const leads = agents.value.filter((agent) => agent.level !== 'L2').length;
    const mapped = agents.value.filter((agent) => agent.level === 'L0' || Boolean(agent.parentAgentId)).length;

    return {
      total,
      heartbeatReady,
      running,
      attention,
      leads,
      readiness: total === 0 ? 0 : Math.round((mapped / total) * 100)
    };
  });

  const attentionSummary = computed(() => ({
    paused: agents.value.filter((agent) => agent.status === 'paused').length,
    error: agents.value.filter((agent) => agent.status === 'error').length,
    terminated: agents.value.filter((agent) => agent.status === 'terminated').length,
    missingManager: agents.value.filter((agent) => agent.level !== 'L0' && !agent.parentAgentId).length
  }));

  const deploymentChecklist = computed(() => {
    if (!selectedAgent.value) {
      return [];
    }

    const agent = selectedAgent.value;
    return [
      {
        title: 'Ownership is clear',
        text:
          agent.level === 'L0'
            ? 'Executive agents should stay at the root of the org chart.'
            : agent.parentAgentId
              ? 'This agent already reports into the right leadership lane.'
              : 'Assign a manager so this agent can receive work in the correct chain.',
        done: agent.level === 'L0' || Boolean(agent.parentAgentId)
      },
      {
        title: 'Heartbeat state is healthy',
        text:
          agent.status === 'paused'
            ? 'Paused agents stay asleep until you re-enable their heartbeat.'
            : agent.status === 'error'
              ? 'The last heartbeat failed. Review the run details before retrying work.'
              : agent.status === 'terminated'
                ? 'Terminated agents stay in the roster for traceability but no longer receive work.'
                : agent.status === 'running'
                  ? 'A heartbeat is in progress now and FamilyCo will capture the run record when it finishes.'
                  : agent.status === 'idle'
                    ? 'This agent is sleeping between heartbeats and can resume with saved session context.'
                    : 'This agent is ready for the next heartbeat and can receive new work.',
        done: HEALTHY_AGENT_STATUSES.includes(agent.status)
      },
      {
        title: 'Session continuity is protected',
        text:
          agent.status === 'terminated'
            ? 'Session history stays available for audit review even after permanent deactivation.'
            : 'Session persistence lets the next heartbeat continue without re-reading the whole thread.',
        done: true
      },
      {
        title: 'Scope matches hierarchy',
        text: AUTONOMY_GUIDE[agent.level].note,
        done: true
      }
    ];
  });

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

  return {
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
  };
}
