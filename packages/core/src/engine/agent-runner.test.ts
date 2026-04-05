import assert from 'node:assert/strict';
import test from 'node:test';

import { ApprovalGuard } from '../approval/approval-guard.js';
import { AgentRunner, type AgentRunRequest } from './agent-runner.js';
import type { ToolExecutionInput, ToolExecutionResult, ToolExecutor } from './tool-executor.js';

test('AgentRunner returns blocked result when approval is required', async () => {
  const toolExecutor = new ToolExecutorStub();
  const runner = new AgentRunner(new ApprovalGuard(), toolExecutor);

  const result = await runner.run({
    agentId: 'agent-1',
    approvalMode: 'suggest_only',
    action: 'task.publish',
    toolName: 'echo',
    toolArguments: {
      message: 'hello'
    },
    input: 'publish task'
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.agentId, 'agent-1');
  assert.equal(result.toolName, 'echo');
  assert.equal((result.memorySnapshot ?? []).length > 0, true);
  assert.equal(toolExecutor.invocations.length, 0);
});

test('AgentRunner executes tool and returns completed result in auto mode', async () => {
  const toolExecutor = new ToolExecutorStub();
  const runner = new AgentRunner(new ApprovalGuard(), toolExecutor);

  const request: AgentRunRequest = {
    agentId: 'agent-2',
    approvalMode: 'auto',
    action: 'task.log',
    toolName: 'task.log',
    toolArguments: {
      message: 'run task'
    },
    input: 'run task now'
  };

  const result = await runner.run(request);

  assert.equal(result.status, 'completed');
  assert.equal(result.agentId, 'agent-2');
  assert.equal(result.toolName, 'task.log');
  assert.equal((result.memorySnapshot ?? []).length >= 2, true);
  assert.equal(toolExecutor.invocations.length, 1);
  assert.deepEqual(toolExecutor.invocations[0], {
    toolName: 'task.log',
    arguments: {
      message: 'run task'
    }
  });
  assert.deepEqual(result.output, {
    ok: true,
    toolName: 'task.log',
    output: {
      accepted: true
    }
  });
});

class ToolExecutorStub implements ToolExecutor {
  readonly invocations: ToolExecutionInput[] = [];

  async execute(input: ToolExecutionInput): Promise<ToolExecutionResult> {
    this.invocations.push(input);
    return {
      ok: true,
      toolName: input.toolName,
      output: {
        accepted: true
      }
    };
  }
}
