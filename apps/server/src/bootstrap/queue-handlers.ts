import {
  runAgentLoop,
  type AgentRunRequest,
  type AgentRunResult,
  type AgentRunner,
  type AgentRunService,
  type AgentService,
  type AuditService
} from '@familyco/core';

import { type InMemoryQueueService } from '../queue/index.js';
import type { HeartbeatRuntimeService } from '../runtime/heartbeat-runtime.service.js';
import type { ChatEngineService } from '../modules/agent/chat-engine.service.js';
import type { DefaultToolExecutor } from '../modules/tools/index.js';
import type { TaskExecutionCoordinator } from '../runtime/task-execution.coordinator.js';
import { extractHeartbeatTrace, summarizeToolResult, toError } from './helpers.js';

export interface QueueHandlerDeps {
  queueService: InMemoryQueueService;
  agentService: AgentService;
  chatEngineService: ChatEngineService;
  toolExecutor: DefaultToolExecutor;
  agentRunner: AgentRunner;
  agentRunService: AgentRunService;
  taskCoordinator: TaskExecutionCoordinator;
  heartbeatRuntime: HeartbeatRuntimeService;
  auditService: AuditService;
}

export function registerQueueHandlers(deps: QueueHandlerDeps): void {
  deps.queueService.setHandlers({
    onAgentRun: async (job) => {
      try {
        const result = await executeAgentRun(deps, job.payload.request);
        await handleAgentRunCompleted(deps, job.payload.request, result);
        return result;
      } catch (error) {
        const normalizedError = toError(error);
        await handleAgentRunFailed(deps, job.payload.request, normalizedError);
        throw normalizedError;
      }
    },
    onToolExecute: async (job) => {
      try {
        const result = await deps.toolExecutor.execute(job.payload.input);
        await deps.auditService.write({
          actorId: 'system',
          action: 'engine.tool.run.completed',
          payload: {
            toolName: job.payload.input.toolName,
            result
          }
        });
        return result;
      } catch (error) {
        const normalizedError = toError(error);
        await deps.auditService.write({
          actorId: 'system',
          action: 'engine.tool.run.failed',
          payload: {
            toolName: job.payload.input.toolName,
            message: normalizedError.message
          }
        });
        throw normalizedError;
      }
    },
    onTaskExecute: async (job) => {
      const { agentId, taskId } = job.payload;
      const syntheticRequest = {
        agentId,
        approvalMode: 'auto' as const,
        action: 'task.execute',
        toolName: 'task.execute',
        toolArguments: {},
        input: taskId
          ? `Task execution for agent ${agentId}, task ${taskId}`
          : `Task execution for agent ${agentId}`
      };

      await deps.heartbeatRuntime.markStarted(syntheticRequest);

      try {
        const batchResult = taskId
          ? await deps.taskCoordinator.executeTask(agentId, taskId)
          : await deps.taskCoordinator.executeForAgent(agentId);

        const lastResult = batchResult.lastResult;

        const syntheticAgentResult = {
          status: (lastResult.status === 'waiting_for_approval' || lastResult.status === 'blocked')
            ? ('blocked' as const)
            : ('completed' as const),
          agentId,
          action: 'task.execute',
          toolName: 'task.execute'
        };

        await deps.heartbeatRuntime.markCompleted(syntheticRequest, syntheticAgentResult);

        await deps.auditService.write({
          actorId: agentId,
          action: 'engine.task.execute.completed',
          targetId: agentId,
          payload: {
            agentId,
            taskId: taskId ?? null,
            tasksRun: batchResult.tasksRun,
            results: batchResult.results.map((result) => ({
              taskId: result.taskId,
              status: result.status,
              summary: result.summary
            }))
          }
        });

        return batchResult;
      } catch (error) {
        const normalizedError = toError(error);
        await deps.heartbeatRuntime.markFailed(syntheticRequest, normalizedError);
        await deps.auditService.write({
          actorId: agentId,
          action: 'engine.task.execute.failed',
          payload: {
            agentId,
            taskId: taskId ?? null,
            error: normalizedError.message
          }
        });
        throw normalizedError;
      }
    }
  });
}

async function executeAgentRun(
  deps: QueueHandlerDeps,
  request: AgentRunRequest
): Promise<AgentRunResult> {
  if (request.runId) {
    await deps.agentRunService.updateState(request.runId, { state: 'planning' });
  }

  await deps.heartbeatRuntime.markStarted(request);

  if (request.runId) {
    await deps.agentRunService.updateState(request.runId, { state: 'executing' });
  }

  // Heartbeat runs use AI loop so we can inspect full tool trace (not only final dispatch result).
  if (request.action === 'heartbeat.tick') {
    const agent = await deps.agentService.getAgentById(request.agentId);
    const adapterConfig = await deps.chatEngineService.getAdapterConfig(agent.aiAdapterId, agent.aiModel);
    const heartbeatExecutor = deps.toolExecutor.forkForHeartbeat(deps.queueService, request.agentId);
    const toolCalls: Array<{
      toolName: string;
      ok: boolean;
      summary: string;
      arguments: Record<string, unknown>;
      output?: unknown;
      error?: { code: string; message: string };
    }> = [];

    let finalReply = '';
    let totalTurns = 0;

    if (adapterConfig) {
      const adapter = deps.chatEngineService.getAdapter(adapterConfig.adapterId);
      if (!adapter) {
        throw new Error(`HEARTBEAT_ADAPTER_NOT_FOUND:${adapterConfig.adapterId}`);
      }

      const availableTools = heartbeatExecutor.listToolDefinitions();
      const loopResult = await runAgentLoop({
        adapter,
        apiKey: adapterConfig.apiKey,
        model: adapterConfig.model,
        systemPrompt: request.input,
        userPrompt: 'Run the heartbeat procedure now.',
        availableTools,
        maxRounds: 8,
        executeTool: async (toolInput) => {
          const result = await heartbeatExecutor.execute({
            toolName: toolInput.toolName,
            arguments: toolInput.arguments
          });
          toolCalls.push({
            toolName: result.toolName,
            ok: result.ok,
            summary: summarizeToolResult(result),
            arguments: toolInput.arguments,
            ...(result.output !== undefined ? { output: result.output } : {}),
            ...(result.error ? { error: result.error } : {})
          });
          return { ok: result.ok, output: result.output, error: result.error };
        }
      });
      finalReply = loopResult.finalReply;
      totalTurns = loopResult.totalTurns;
    } else {
      finalReply = 'Heartbeat AI adapter is not configured. Falling back to deterministic dispatch.';
    }

    return {
      status: 'completed',
      agentId: request.agentId,
      action: request.action,
      toolName: request.toolName,
      output: {
        ok: true,
        toolName: 'heartbeat.tick',
        output: {
          finalReply,
          totalTurns,
          toolCalls
        }
      }
    };
  }

  return deps.agentRunner.run(request);
}

async function handleAgentRunCompleted(
  deps: QueueHandlerDeps,
  request: AgentRunRequest,
  result: AgentRunResult | undefined
): Promise<void> {
  if (result) {
    await deps.heartbeatRuntime.markCompleted(request, result);
  }

  if (request.runId) {
    await deps.agentRunService.updateState(request.runId, {
      state: result?.status === 'blocked' ? 'waiting_approval' : 'completed',
      outputSummary:
        result?.status === 'blocked'
          ? result.reason?.slice(0, 500) ?? null
          : result?.output
            ? JSON.stringify(result.output).slice(0, 500)
            : 'Execution completed'
    });
  }

  await deps.auditService.write({
    actorId: request.agentId,
    action: 'engine.agent.run.completed',
    targetId: request.agentId,
    payload: {
      status: result?.status,
      toolName: request.toolName,
      action: request.action,
      reason: result?.status === 'blocked' ? (result.reason ?? null) : null,
      output: result?.output ? JSON.stringify(result.output).slice(0, 5_000) : null,
      heartbeatTrace: extractHeartbeatTrace(result)
    }
  });
}

async function handleAgentRunFailed(
  deps: QueueHandlerDeps,
  request: AgentRunRequest,
  error: Error
): Promise<void> {
  await deps.heartbeatRuntime.markFailed(request, error);

  if (request.runId) {
    await deps.agentRunService.updateState(request.runId, {
      state: 'failed',
      outputSummary: error.message.slice(0, 500)
    });
  }

  await deps.auditService.write({
    actorId: request.agentId,
    action: 'engine.agent.run.failed',
    targetId: request.agentId,
    payload: {
      toolName: request.toolName,
      action: request.action,
      error: error.message
    }
  });
}
