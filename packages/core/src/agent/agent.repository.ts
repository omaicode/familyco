import type {
  AgentDeleteResult,
  AgentProfile,
  AgentStatus,
  CreateAgentInput,
  UpdateAgentInput
} from './agent.entity.js';

export interface AgentRepository {
  create(input: CreateAgentInput): Promise<AgentProfile>;
  findById(id: string): Promise<AgentProfile | null>;
  findChildren(parentAgentId: string): Promise<AgentProfile[]>;
  list(): Promise<AgentProfile[]>;
  pause(id: string): Promise<AgentProfile>;
  setStatus(id: string, status: AgentStatus): Promise<AgentProfile>;
  update(id: string, input: UpdateAgentInput): Promise<AgentProfile>;
  updateParent(id: string, parentAgentId: string | null): Promise<AgentProfile>;
  deleteCascade(id: string): Promise<AgentDeleteResult>;
}
