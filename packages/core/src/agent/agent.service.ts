import type { AgentProfile, CreateAgentInput } from './agent.entity.js';
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

  updateParent(id: string, parentAgentId: string | null): Promise<AgentProfile> {
    return this.repository.updateParent(id, parentAgentId);
  }
}
