export type QueueJobType = 'agent.run' | 'tool.execute';

export interface QueueJob<TPayload = Record<string, unknown>> {
  type: QueueJobType;
  payload: TPayload;
}
