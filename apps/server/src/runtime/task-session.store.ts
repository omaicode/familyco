export type TaskSessionStatus =
  | 'active'
  | 'waiting_for_approval'
  | 'waiting_for_input'
  | 'completed'
  | 'blocked';

export interface TaskSessionToolResult {
  toolName: string;
  ok: boolean;
  output?: string;
  error?: string;
}

export interface TaskSessionCheckpoint {
  taskId: string;
  agentId: string;
  sessionId: string;
  checkpointIndex: number;
  status: TaskSessionStatus;
  summary: string;
  lastToolNames: string[];
  toolResults: TaskSessionToolResult[];
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
