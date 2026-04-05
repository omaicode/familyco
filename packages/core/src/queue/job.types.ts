import type { AgentRunRequest } from '../engine/agent-runner.js';
import type { ToolExecutionInput } from '../engine/tool-executor.js';

export type QueueJobType = 'agent.run' | 'tool.execute';

export interface AgentRunJobPayload {
  request: AgentRunRequest;
}

export interface ToolExecuteJobPayload {
  input: ToolExecutionInput;
}

export interface QueueJobPayloadMap {
  'agent.run': AgentRunJobPayload;
  'tool.execute': ToolExecuteJobPayload;
}

export interface QueueJob<TType extends QueueJobType = QueueJobType> {
  type: TType;
  payload: QueueJobPayloadMap[TType];
}

export type AnyQueueJob =
  | QueueJob<'agent.run'>
  | QueueJob<'tool.execute'>;

export interface QueueJobEnvelope<TType extends QueueJobType = QueueJobType> {
  id: string;
  createdAt: Date;
  type: TType;
  payload: QueueJobPayloadMap[TType];
}
