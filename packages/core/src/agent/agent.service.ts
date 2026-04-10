import type {
  AgentDeleteResult,
  AgentProfile,
  AgentStatus,
  CreateAgentInput,
  UpdateAgentInput
} from './agent.entity.js';
import type { AgentRepository } from './agent.repository.js';
import type { EventBus } from '../events/event-bus.js';

export class AgentService {
  constructor(
    private readonly repository: AgentRepository,
    private readonly eventBus?: EventBus
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
    return agents.find((agent) => agent.level === 'L0' && agent.status !== 'terminated') ?? null;
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

    if (target.level === 'L0' && target.status !== 'terminated') {
      const l0Agents = await this.repository.list();
      const remainingActiveExecutives = l0Agents.filter(
        (agent) => agent.id !== id && agent.level === 'L0' && agent.status !== 'terminated'
      );

      if (remainingActiveExecutives.length === 0) {
        throw new Error('AGENT_DELETE_LAST_EXECUTIVE');
      }
    }

    const deleted = await this.repository.deleteCascade(id);
    this.eventBus?.emit('agent.deleted', { agentId: id });
    return deleted;
  }
}
