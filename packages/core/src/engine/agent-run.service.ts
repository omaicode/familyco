import type { AgentRun, CreateAgentRunInput, UpdateAgentRunStateInput } from './agent-run.entity.js';

export interface AgentRunListQuery {
  rootAgentId?: string;
  state?: AgentRun['state'];
  triggerType?: AgentRun['triggerType'];
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface AgentRunRepository {
  create(input: CreateAgentRunInput): Promise<AgentRun>;
  updateState(id: string, input: UpdateAgentRunStateInput): Promise<AgentRun>;
  getById(id: string): Promise<AgentRun | null>;
  list(query?: AgentRunListQuery): Promise<AgentRun[]>;
}

export class AgentRunService {
  constructor(private readonly repository: AgentRunRepository) {}

  createRun(input: CreateAgentRunInput): Promise<AgentRun> {
    return this.repository.create({
      ...input,
      state: input.state ?? 'queued'
    });
  }

  updateState(id: string, input: UpdateAgentRunStateInput): Promise<AgentRun> {
    return this.repository.updateState(id, input);
  }

  getById(id: string): Promise<AgentRun | null> {
    return this.repository.getById(id);
  }

  list(query?: AgentRunListQuery): Promise<AgentRun[]> {
    return this.repository.list(query);
  }
}
