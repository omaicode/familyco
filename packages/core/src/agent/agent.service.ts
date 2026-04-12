import type {
  AgentDeleteResult,
  AgentProfile,
  AgentStatus,
  CreateAgentInput,
  UpdateAgentInput
} from './agent.entity.js';
import type { AgentRepository } from './agent.repository.js';
import type { EventBus } from '../events/event-bus.js';
import type { TaskRepository } from '../task/task.repository.js';
import type { ProjectRepository } from '../project/project.repository.js';
import type { ApprovalRepository } from '../approval/approval.repository.js';

export class AgentService {
  constructor(
    private readonly repository: AgentRepository,
    private readonly eventBus?: EventBus,
    private readonly taskRepository?: TaskRepository,
    private readonly projectRepository?: ProjectRepository,
    private readonly approvalRepository?: ApprovalRepository
  ) {}

  async createAgent(input: CreateAgentInput): Promise<AgentProfile> {
    const agent = await this.repository.create(input);
    this.eventBus?.emit('agent.created', { agentId: agent.id });
    return agent;
  }

  createFromApproval(input: CreateAgentInput): Promise<AgentProfile> {
    return this.createAgent(input);
  }

  listAgents(): Promise<AgentProfile[]> {
    return this.repository.list();
  }

  async findExecutiveAgent(): Promise<AgentProfile | null> {
    const agents = await this.repository.list();
    return agents.find((agent) =>
      agent.level === 'L0' &&
      agent.status !== 'terminated' &&
      agent.status !== 'archived'
    ) ?? null;
  }

  async getAgentById(id: string): Promise<AgentProfile> {
    const agent = await this.repository.findById(id);
    if (!agent) {
      throw new Error(`AGENT_NOT_FOUND:${id}`);
    }

    return agent;
  }

  async pauseAgent(id: string): Promise<AgentProfile> {
    const agent = await this.repository.pause(id);
    this.eventBus?.emit('agent.paused', { agentId: agent.id });
    return agent;
  }

  setAgentStatus(id: string, status: AgentStatus): Promise<AgentProfile> {
    return this.repository.setStatus(id, status);
  }

  async updateAgent(id: string, input: UpdateAgentInput): Promise<AgentProfile> {
    const agent = await this.repository.update(id, input);
    this.eventBus?.emit('agent.updated', { agentId: agent.id });
    return agent;
  }

  getChildren(id: string): Promise<AgentProfile[]> {
    return this.repository.findChildren(id);
  }

  async getPath(id: string): Promise<AgentProfile[]> {
    const path: AgentProfile[] = [];
    let current = await this.getAgentById(id);
    path.unshift(current);

    while (current.parentAgentId) {
      const parent = await this.repository.findById(current.parentAgentId);
      if (!parent) {
        break;
      }

      path.unshift(parent);
      current = parent;
    }

    return path;
  }

  async updateParent(id: string, parentAgentId: string | null): Promise<AgentProfile> {
    const agent = await this.repository.updateParent(id, parentAgentId);
    this.eventBus?.emit('agent.updated', { agentId: agent.id });
    return agent;
  }

  async deleteAgent(id: string): Promise<AgentDeleteResult> {
    const target = await this.getAgentById(id);
    const agents = await this.repository.list();
    const defaultExecutive = resolveDefaultExecutiveAgent(agents);

    if (defaultExecutive?.id === target.id) {
      throw new Error('AGENT_DELETE_DEFAULT_EXECUTIVE');
    }

    const fallbackAgent = resolveFallbackExecutive(agents, target);

    if (!fallbackAgent) {
      throw new Error(target.level === 'L0' ? 'AGENT_DELETE_LAST_EXECUTIVE' : 'AGENT_DELETE_FALLBACK_NOT_FOUND');
    }

    const reassignedChildren = await this.repository.reassignChildren(id, fallbackAgent.id);
    const reassignedProjects = await this.projectRepository?.reassignOwner(id, fallbackAgent.id) ?? [];
    const reassignedTasks = await this.taskRepository?.reassignAgent(id, fallbackAgent.id) ?? [];
    await this.approvalRepository?.reassignActor(id, fallbackAgent.id);
    const deletedAgent = await this.repository.delete(id);

    for (const child of reassignedChildren) {
      this.eventBus?.emit('agent.updated', { agentId: child.id });
    }

    for (const task of reassignedTasks) {
      this.eventBus?.emit('task.updated', {
        taskId: task.id,
        projectId: task.projectId
      });
    }

    this.eventBus?.emit('agent.deleted', { agentId: id });
    return {
      deletedAgentIds: [deletedAgent.id],
      deletedProjectIds: [],
      deletedTaskIds: [],
      deletedApprovalIds: [],
      fallbackAgentId: fallbackAgent.id,
      reassignedTaskCount: reassignedTasks.length,
      reassignedProjectCount: reassignedProjects.length,
      reassignedChildAgentCount: reassignedChildren.length
    };
  }
}

function resolveFallbackExecutive(agents: AgentProfile[], target: AgentProfile): AgentProfile | null {
  const activeExecutives = agents.filter((agent) =>
    agent.level === 'L0' &&
    agent.status !== 'terminated' &&
    agent.status !== 'archived'
  );
  if (target.level === 'L0' && target.status !== 'terminated') {
    return activeExecutives.find((agent) => agent.id !== target.id) ?? null;
  }

  return activeExecutives[0] ?? null;
}

function resolveDefaultExecutiveAgent(agents: AgentProfile[]): AgentProfile | null {
  return agents
    .filter((agent) =>
      agent.level === 'L0' &&
      agent.status !== 'terminated' &&
      agent.status !== 'archived'
    )
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0] ?? null;
}
