import type { AgentProfile, CreateAgentInput } from './agent.entity.js';

export interface AgentRepository {
  create(input: CreateAgentInput): Promise<AgentProfile>;
  findById(id: string): Promise<AgentProfile | null>;
  list(): Promise<AgentProfile[]>;
  pause(id: string): Promise<AgentProfile>;
}
