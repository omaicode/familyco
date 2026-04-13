import type { AgentRunRequest } from '../engine/agent-runner.js';
import type { ToolExecutionInput } from '../engine/tool-executor.js';

export type QueueJobType = 'agent.run' | 'tool.execute' | 'task.execute';

export interface AgentRunJobPayload {
  request: AgentRunRequest;
}

export interface ToolExecuteJobPayload {
  input: ToolExecutionInput;
}

export interface TaskExecuteJobPayload {
  agentId: string;
  /** When set, run this specific task instead of selecting the next one. */
  taskId?: string;
}

export interface QueueJobPayloadMap {
  'agent.run': AgentRunJobPayload;
  'tool.execute': ToolExecuteJobPayload;
  'task.execute': TaskExecuteJobPayload;
}

export interface QueueJob<TType extends QueueJobType = QueueJobType> {
  type: TType;
  payload: QueueJobPayloadMap[TType];
}

export type AnyQueueJob =
  | QueueJob<'agent.run'>
  | QueueJob<'tool.execute'>
  | QueueJob<'task.execute'>;

export interface QueueJobEnvelope<TType extends QueueJobType = QueueJobType> {
  id: string;
  createdAt: Date;
  type: TType;
  payload: QueueJobPayloadMap[TType];
}
