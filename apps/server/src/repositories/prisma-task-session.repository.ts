import type { PrismaClient } from '@familyco/db';

import { isValidTaskSessionStatus, type TaskSessionCheckpoint, type TaskSessionRepository, type TaskSessionToolResult } from '../runtime/task-session.store.js';

export class PrismaTaskSessionRepository implements TaskSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async load(taskId: string): Promise<TaskSessionCheckpoint | null> {
    const row = await this.prisma.taskSessionCheckpoint.findUnique({ where: { taskId } });
    if (!row) {
      return null;
    }

    return toCheckpoint(row);
  }

  async save(checkpoint: TaskSessionCheckpoint): Promise<void> {
    const data = {
      agentId: checkpoint.agentId,
      sessionId: checkpoint.sessionId,
      checkpointIndex: checkpoint.checkpointIndex,
      status: checkpoint.status,
      summary: checkpoint.summary,
      lastToolNames: JSON.stringify(checkpoint.lastToolNames),
      toolResults: JSON.stringify(checkpoint.toolResults),
      startedAt: new Date(checkpoint.startedAt),
      updatedAt: new Date(checkpoint.updatedAt)
    };

    await this.prisma.taskSessionCheckpoint.upsert({
      where: { taskId: checkpoint.taskId },
      create: { taskId: checkpoint.taskId, ...data },
      update: data
    });
  }

  async clear(taskId: string): Promise<void> {
    await this.prisma.taskSessionCheckpoint.deleteMany({ where: { taskId } }).catch(() => undefined);
  }
}

type PrismaCheckpointRow = {
  taskId: string;
  agentId: string;
  sessionId: string;
  checkpointIndex: number;
  status: string;
  summary: string;
  lastToolNames: string;
  toolResults: string;
  startedAt: Date;
  updatedAt: Date;
};

function toCheckpoint(row: PrismaCheckpointRow): TaskSessionCheckpoint {
  return {
    taskId: row.taskId,
    agentId: row.agentId,
    sessionId: row.sessionId,
    checkpointIndex: row.checkpointIndex,
    status: isValidTaskSessionStatus(row.status) ? row.status : 'active',
    summary: row.summary,
    lastToolNames: parseStringArray(row.lastToolNames),
    toolResults: parseToolResults(row.toolResults),
    startedAt: row.startedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function parseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === 'string');
    }
  } catch {
    // malformed — treat as empty
  }
  return [];
}

function parseToolResults(raw: string): TaskSessionToolResult[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isToolResultShape);
  } catch {
    return [];
  }
}

function isToolResultShape(value: unknown): value is TaskSessionToolResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).toolName === 'string' &&
    typeof (value as Record<string, unknown>).ok === 'boolean'
  );
}
