import type {
  AgentActionApprovalResponse,
  AgentListItem,
  CreateAgentPayload,
  CreateAgentResult,
  FamilyCoApiContracts,
  PauseAgentPayload,
  PauseAgentResult,
  UpdateAgentPayload,
  UpdateAgentParentPayload
} from '../api/contracts.js';
import { createAsyncState, type AsyncState } from './async-state.js';

export interface AgentStoreState {
  agents: AsyncState<AgentListItem[]>;
}

const isApprovalResponse = (
  result: AgentListItem | AgentActionApprovalResponse
): result is AgentActionApprovalResponse => 'approvalRequired' in result;

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

  async createAgent(payload: CreateAgentPayload): Promise<CreateAgentResult> {
    const createdAgent = await this.api.createAgent(payload);

    if (!isApprovalResponse(createdAgent)) {
      this.state.agents.data = [createdAgent, ...this.state.agents.data];
      this.state.agents.isEmpty = false;
    }

    return createdAgent;
  }

  async pauseAgent(payload: PauseAgentPayload): Promise<PauseAgentResult> {
    const pausedAgent = await this.api.pauseAgent(payload);

    if (!isApprovalResponse(pausedAgent)) {
      this.state.agents.data = this.state.agents.data.map((agent) =>
        agent.id === pausedAgent.id ? pausedAgent : agent
      );
    }

    return pausedAgent;
  }

  async updateAgent(payload: UpdateAgentPayload): Promise<AgentListItem> {
    const updatedAgent = await this.api.updateAgent(payload);
    this.state.agents.data = this.state.agents.data.map((agent) =>
      agent.id === updatedAgent.id ? updatedAgent : agent
    );

    return updatedAgent;
  }

  async updateAgentParent(payload: UpdateAgentParentPayload): Promise<AgentListItem> {
    const updatedAgent = await this.api.updateAgentParent(payload);
    this.state.agents.data = this.state.agents.data.map((agent) =>
      agent.id === updatedAgent.id ? updatedAgent : agent
    );

    return updatedAgent;
  }
}

export const createAgentStore = (api: FamilyCoApiContracts): AgentStore => new AgentStore(api);
