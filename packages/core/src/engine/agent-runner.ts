import type { ApprovalMode, ApprovalGuard } from '../approval/index.js';
import { InMemoryMemoryService, type MemoryEntry, type MemoryService } from '../memory/index.js';
import type { ToolExecutionResult, ToolExecutor } from './tool-executor.js';

export interface AgentRunRequest {
  runId?: string;
  agentId: string;
  approvalMode: ApprovalMode;
  action: string;
  toolName: string;
  toolArguments: Record<string, unknown>;
  targetId?: string;
  input: string;
}

export interface AgentRunResult {
  status: 'completed' | 'blocked';
  agentId: string;
  action: string;
  toolName: string;
  output?: ToolExecutionResult;
  reason?: string;
  memorySnapshot?: MemoryEntry[];
}

export class AgentRunner {
  constructor(
    private readonly approvalGuard: ApprovalGuard,
    private readonly toolExecutor: ToolExecutor,
    private readonly memoryService: MemoryService = new InMemoryMemoryService()
  ) {}

  async clearMemory(agentId: string): Promise<void> {
    await this.memoryService.clear(agentId);
  }

  async run(request: AgentRunRequest): Promise<AgentRunResult> {
    await this.memoryService.add({
      agentId: request.agentId,
      role: 'input',
      content: request.input,
      metadata: {
        action: request.action,
        toolName: request.toolName,
        toolArguments: request.toolArguments
      }
    });

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
      await this.memoryService.add({
        agentId: request.agentId,
        role: 'system',
        content: decision.reason ?? request.action,
        metadata: {
          status: 'blocked'
        }
      });

      return {
        status: 'blocked',
        agentId: request.agentId,
        action: request.action,
        toolName: request.toolName,
        reason: decision.reason ?? request.action,
        memorySnapshot: await this.memoryService.listRecent(request.agentId, 20)
      };
    }

    const output = await this.toolExecutor.execute({
      toolName: request.toolName,
      arguments: request.toolArguments
    });

    await this.memoryService.add({
      agentId: request.agentId,
      role: 'tool_output',
      content: output.ok ? 'Tool execution completed' : 'Tool execution failed',
      metadata: {
        toolName: output.toolName,
        ok: output.ok,
        error: output.error
      }
    });

    return {
      status: 'completed',
      agentId: request.agentId,
      action: request.action,
      toolName: request.toolName,
      output,
      memorySnapshot: await this.memoryService.listRecent(request.agentId, 20)
    };
  }
}
