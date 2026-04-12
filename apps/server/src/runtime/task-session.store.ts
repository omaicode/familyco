import type { SettingsService } from '@familyco/core';

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

export class TaskSessionStore {
  constructor(private readonly settingsService: SettingsService) {}

  async load(taskId: string): Promise<TaskSessionCheckpoint | null> {
    const setting = await this.settingsService.get(this.toKey(taskId));
    if (!setting?.value || !isRecord(setting.value)) {
      return null;
    }

    return parseCheckpoint(setting.value);
  }

  async save(checkpoint: TaskSessionCheckpoint): Promise<void> {
    await this.settingsService.upsert({
      key: this.toKey(checkpoint.taskId),
      value: checkpoint
    });
  }

  async clear(taskId: string): Promise<void> {
    await this.settingsService.upsert({
      key: this.toKey(taskId),
      value: null
    });
  }

  private toKey(taskId: string): string {
    return `task.session.${taskId}`;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCheckpoint(value: Record<string, unknown>): TaskSessionCheckpoint | null {
  const taskId = typeof value.taskId === 'string' ? value.taskId : null;
  const agentId = typeof value.agentId === 'string' ? value.agentId : null;
  const sessionId = typeof value.sessionId === 'string' ? value.sessionId : null;

  if (!taskId || !agentId || !sessionId) {
    return null;
  }

  return {
    taskId,
    agentId,
    sessionId,
    checkpointIndex: typeof value.checkpointIndex === 'number' ? value.checkpointIndex : 0,
    status: isValidStatus(value.status) ? value.status : 'active',
    summary: typeof value.summary === 'string' ? value.summary : '',
    lastToolNames: Array.isArray(value.lastToolNames)
      ? value.lastToolNames.filter((v): v is string => typeof v === 'string')
      : [],
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString()
  };
}

function isValidStatus(value: unknown): value is TaskSessionStatus {
  return (
    value === 'active' ||
    value === 'waiting_for_approval' ||
    value === 'waiting_for_input' ||
    value === 'completed' ||
    value === 'blocked'
  );
}
