import os from 'node:os';

import type { AgentRunResult } from '@familyco/core';

export function normalizePositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

export function resolveDefaultQueueConcurrency(): {
  agentRunConcurrency: number;
  toolExecuteConcurrency: number;
} {
  const cores = os.availableParallelism();
  return {
    agentRunConcurrency: Math.max(2, Math.floor(cores / 2)),
    toolExecuteConcurrency: Math.max(4, cores)
  };
}

export function summarizeQueueJobs(jobs: unknown[]): {
  totalJobs: number;
  queuedJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  byType: {
    agentRun: { queued: number; running: number; completed: number; failed: number };
    toolExecute: { queued: number; running: number; completed: number; failed: number };
  };
} {
  const byType = {
    agentRun: { queued: 0, running: 0, completed: 0, failed: 0 },
    toolExecute: { queued: 0, running: 0, completed: 0, failed: 0 }
  };

  let queuedJobs = 0;
  let runningJobs = 0;
  let completedJobs = 0;
  let failedJobs = 0;

  for (const job of jobs) {
    if (!isQueueJobRecord(job)) {
      continue;
    }

    const lane = job.type === 'agent.run' ? byType.agentRun : byType.toolExecute;

    if (job.status === 'queued') {
      queuedJobs += 1;
      lane.queued += 1;
      continue;
    }

    if (job.status === 'running') {
      runningJobs += 1;
      lane.running += 1;
      continue;
    }

    if (job.status === 'completed') {
      completedJobs += 1;
      lane.completed += 1;
      continue;
    }

    failedJobs += 1;
    lane.failed += 1;
  }

  return {
    totalJobs: jobs.length,
    queuedJobs,
    runningJobs,
    completedJobs,
    failedJobs,
    byType
  };
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function summarizeToolResult(result: { ok: boolean; output?: unknown; error?: { code: string; message: string } }): string {
  if (!result.ok) {
    return result.error?.message ?? 'Tool failed';
  }

  if (typeof result.output === 'string' && result.output.trim().length > 0) {
    return result.output.trim().slice(0, 200);
  }

  if (result.output !== undefined && result.output !== null) {
    try {
      return JSON.stringify(result.output).slice(0, 200);
    } catch {
      return 'Tool completed';
    }
  }

  return 'Tool completed';
}

export function extractHeartbeatTrace(result: AgentRunResult | undefined): unknown {
  if (!result?.output?.ok) {
    return null;
  }

  const output = result.output.output;
  if (typeof output !== 'object' || output === null) {
    return null;
  }

  const record = output as Record<string, unknown>;
  if (!Array.isArray(record.toolCalls)) {
    return null;
  }

  return {
    totalTurns: typeof record.totalTurns === 'number' ? record.totalTurns : null,
    finalReply: typeof record.finalReply === 'string' ? record.finalReply : null,
    toolCalls: record.toolCalls
  };
}

export function createCorsOriginMatcher(): (
  origin: string | undefined,
  callback: (error: Error | null, allow: boolean) => void
) => void {
  const configuredOrigins =
    process.env.CORS_ORIGINS?.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0) ?? [];

  const defaultOrigins = ['http://127.0.0.1:5173', 'http://localhost:5173'];
  const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, allowedOrigins.has(origin));
  };
}

function isQueueJobRecord(
  value: unknown
): value is { type: 'agent.run' | 'tool.execute'; status: 'queued' | 'running' | 'completed' | 'failed' } {
  if (!isRecord(value)) {
    return false;
  }

  if (value.type !== 'agent.run' && value.type !== 'tool.execute') {
    return false;
  }

  return (
    value.status === 'queued' ||
    value.status === 'running' ||
    value.status === 'completed' ||
    value.status === 'failed'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
