import type { ApprovalMode, ApprovalGuard } from '../approval/index.js';
import type { ToolExecutor } from './tool-executor.js';

export interface AgentRunRequest {
  agentId: string;
  approvalMode: ApprovalMode;
  action: string;
  toolName: string;
  toolArguments: Record<string, unknown>;
  targetId?: string;
  input: string;
}

export class AgentRunner {
  constructor(
    private readonly approvalGuard: ApprovalGuard,
    private readonly toolExecutor: ToolExecutor
  ) {}

  async run(request: AgentRunRequest): Promise<unknown> {
    const decision = this.approvalGuard.check(request.approvalMode, {
      actorId: request.agentId,
      action: request.action,
      targetId: request.targetId,
      payload: {
        input: request.input,
        ...request.toolArguments
      }
    });

    if (!decision.allowed) {
      throw new Error(`APPROVAL_REQUIRED:${decision.reason ?? request.action}`);
    }

    return this.toolExecutor.execute({
      toolName: request.toolName,
      arguments: request.toolArguments
    });
  }
}
