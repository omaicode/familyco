import type {
  AgentListItem,
  CreateAgentPayload,
  FamilyCoApiContracts,
  PauseAgentPayload
} from '../api/contracts.js';
import { createAsyncState, type AsyncState } from './async-state.js';

export interface AgentStoreState {
  agents: AsyncState<AgentListItem[]>;
}

export class AgentStore {
  state: AgentStoreState;

  constructor(private readonly api: FamilyCoApiContracts) {
    this.state = {
      agents: createAsyncState<AgentListItem[]>([])
    };
  }

  async loadAgents(): Promise<void> {
    this.state.agents.isLoading = true;
    this.state.agents.errorMessage = null;

    try {
      const agents = await this.api.listAgents();
      this.state.agents.data = agents;
      this.state.agents.isEmpty = agents.length === 0;
    } catch (error) {
      this.state.agents.errorMessage =
        error instanceof Error ? error.message : 'Failed to load agents';
    } finally {
      this.state.agents.isLoading = false;
    }
  }

  async createAgent(payload: CreateAgentPayload): Promise<AgentListItem> {
    const createdAgent = await this.api.createAgent(payload);
    this.state.agents.data = [createdAgent, ...this.state.agents.data];
    this.state.agents.isEmpty = false;
    return createdAgent;
  }

  async pauseAgent(payload: PauseAgentPayload): Promise<AgentListItem> {
    const pausedAgent = await this.api.pauseAgent(payload);
    this.state.agents.data = this.state.agents.data.map((agent) =>
      agent.id === pausedAgent.id ? pausedAgent : agent
    );

    return pausedAgent;
  }
}

export const createAgentStore = (api: FamilyCoApiContracts): AgentStore => new AgentStore(api);
