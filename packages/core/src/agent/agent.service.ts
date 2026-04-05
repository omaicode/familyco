import type { AgentProfile, CreateAgentInput } from './agent.entity.js';
import type { AgentRepository } from './agent.repository.js';

export class AgentService {
  constructor(private readonly repository: AgentRepository) {}

  createAgent(input: CreateAgentInput): Promise<AgentProfile> {
    return this.repository.create(input);
  }

  listAgents(): Promise<AgentProfile[]> {
    return this.repository.list();
  }

  pauseAgent(id: string): Promise<AgentProfile> {
    return this.repository.pause(id);
  }
}
