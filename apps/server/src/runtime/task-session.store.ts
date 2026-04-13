export type TaskSessionStatus =
  | 'active'
  | 'waiting_for_approval'
  | 'waiting_for_input'
  | 'completed'
  | 'blocked';

export interface TaskSessionCheckpoint {
  taskId: string;
  agentId: string;
  sessionId: string;
  checkpointIndex: number;
  status: TaskSessionStatus;
  summary: string;
  lastToolNames: string[];
  startedAt: string;
  updatedAt: string;
}

export interface TaskSessionRepository {
  load(taskId: string): Promise<TaskSessionCheckpoint | null>;
  save(checkpoint: TaskSessionCheckpoint): Promise<void>;
  clear(taskId: string): Promise<void>;
}

export function isValidTaskSessionStatus(value: unknown): value is TaskSessionStatus {
  return (
    value === 'active' ||
    value === 'waiting_for_approval' ||
    value === 'waiting_for_input' ||
    value === 'completed' ||
    value === 'blocked'
  );
}
