import type { PrismaClient } from '@familyco/db';

import { isValidTaskSessionStatus, type TaskSessionCheckpoint, type TaskSessionRepository } from '../runtime/task-session.store.js';

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
  startedAt: Date;
  updatedAt: Date;
};

function toCheckpoint(row: PrismaCheckpointRow): TaskSessionCheckpoint {
  let toolNames: string[] = [];
  try {
    const parsed = JSON.parse(row.lastToolNames);
    if (Array.isArray(parsed)) {
      toolNames = parsed.filter((v): v is string => typeof v === 'string');
    }
  } catch {
    // malformed JSON — treat as empty
  }

  return {
    taskId: row.taskId,
    agentId: row.agentId,
    sessionId: row.sessionId,
    checkpointIndex: row.checkpointIndex,
    status: isValidTaskSessionStatus(row.status) ? row.status : 'active',
    summary: row.summary,
    lastToolNames: toolNames,
    startedAt: row.startedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}
