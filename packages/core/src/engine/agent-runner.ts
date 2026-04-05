import type { ApprovalGuard } from '../approval/index.js';
import type { ToolExecutor } from './tool-executor.js';

export interface AgentRunRequest {
  agentId: string;
  input: string;
}

export class AgentRunner {
  constructor(
    private readonly approvalGuard: ApprovalGuard,
    private readonly toolExecutor: ToolExecutor
  ) {}

  async run(_request: AgentRunRequest): Promise<void> {
    void this.approvalGuard;
    void this.toolExecutor;
  }
}
