import { randomUUID } from 'node:crypto';

import type { QueueJobEnvelope, QueueJobType, QueueService } from '@familyco/core';

type KnownJobType = QueueJobType;

interface InMemoryQueueHandlers {
  onAgentRun?: (job: InMemoryQueueJob<'agent.run'>) => Promise<unknown>;
  onToolExecute?: (job: InMemoryQueueJob<'tool.execute'>) => Promise<unknown>;
  onTaskExecute?: (job: InMemoryQueueJob<'task.execute'>) => Promise<unknown>;
}

export interface InMemoryQueueJob<TType extends KnownJobType = KnownJobType>
  extends QueueJobEnvelope<TType> {
  status: 'queued' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  finishedAt?: Date;
  result?: unknown;
  error?: string;
}

export interface InMemoryQueueServiceOptions {
  agentRunConcurrency?: number;
  toolExecuteConcurrency?: number;
  taskExecuteConcurrency?: number;
}

export class InMemoryQueueService implements QueueService {
  private readonly jobs: Array<InMemoryQueueJob> = [];
  private readonly pendingByType: Record<KnownJobType, InMemoryQueueJob[]> = {
    'agent.run': [],
    'tool.execute': [],
    'task.execute': []
  };
  private readonly runningByType: Record<KnownJobType, number> = {
    'agent.run': 0,
    'tool.execute': 0,
    'task.execute': 0
  };
  private readonly maxConcurrencyByType: Record<KnownJobType, number>;
  private handlers: InMemoryQueueHandlers = {};
  private closed = false;
  private closePromise: Promise<void> | null = null;
  private resolveClosePromise: (() => void) | null = null;

  constructor(options: InMemoryQueueServiceOptions = {}) {
    this.maxConcurrencyByType = {
      'agent.run': normalizeConcurrency(options.agentRunConcurrency, 4),
      'tool.execute': normalizeConcurrency(options.toolExecuteConcurrency, 8),
      'task.execute': normalizeConcurrency(options.taskExecuteConcurrency, 2)
    };
  }

  setHandlers(handlers: InMemoryQueueHandlers): void {
    this.handlers = handlers;
  }

  async enqueue(job: Parameters<QueueService['enqueue']>[0]): Promise<void> {
    if (this.closed) {
      throw new Error('In-memory queue is closed and cannot accept new jobs');
    }

    const type = job.type as KnownJobType;

    // Deduplicate task.execute jobs: skip if an identical pending job already exists
    if (type === 'task.execute') {
      const agentId = (job.payload as { agentId?: string }).agentId;
      const alreadyPending = this.pendingByType['task.execute'].some(
        (j) => (j.payload as { agentId?: string }).agentId === agentId
      );
      if (alreadyPending) {
        await Promise.resolve();
        return;
      }
    }

    const envelope: InMemoryQueueJob = {
      id: randomUUID(),
      createdAt: new Date(),
      type,
      payload: job.payload,
      status: 'queued'
    };

    this.jobs.push(envelope);
    const pending = this.pendingByType[type];
    if (pending) {
      pending.push(envelope);
      this.pump(type);
    }

    await Promise.resolve();
  }

  async listPendingJobs(): Promise<InMemoryQueueJob[]> {
    return this.jobs;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.closePromise ??= new Promise<void>((resolve) => {
      this.resolveClosePromise = resolve;
    });

    this.checkIfDrained();
    await this.closePromise;
    this.jobs.length = 0;
    this.pendingByType['agent.run'].length = 0;
    this.pendingByType['tool.execute'].length = 0;
    this.pendingByType['task.execute'].length = 0;
  }

  private pump(type: KnownJobType): void {
    while (this.runningByType[type] < this.maxConcurrencyByType[type]) {
      const next = this.pendingByType[type]?.shift();
      if (!next) {
        return;
      }

      this.runningByType[type] += 1;
      void this.process(next)
        .catch(() => undefined)
        .finally(() => {
          this.runningByType[type] -= 1;
          this.pump(type);
          this.checkIfDrained();
        });
    }
  }

  private checkIfDrained(): void {
    if (!this.closed || !this.resolveClosePromise) {
      return;
    }

    const hasRunningJobs = Object.values(this.runningByType).some((count) => count > 0);
    const hasPendingJobs = Object.values(this.pendingByType).some((list) => list.length > 0);

    if (hasRunningJobs || hasPendingJobs) {
      return;
    }

    const resolve = this.resolveClosePromise;
    this.resolveClosePromise = null;
    resolve();
  }

  private async process(job: InMemoryQueueJob): Promise<void> {
    let handler: ((job: InMemoryQueueJob) => Promise<unknown>) | undefined;

    if (job.type === 'agent.run') {
      handler = this.handlers.onAgentRun as (job: InMemoryQueueJob) => Promise<unknown>;
    } else if (job.type === 'tool.execute') {
      handler = this.handlers.onToolExecute as (job: InMemoryQueueJob) => Promise<unknown>;
    } else if (job.type === 'task.execute') {
      handler = this.handlers.onTaskExecute as (job: InMemoryQueueJob) => Promise<unknown>;
    }

    if (!handler) {
      return;
    }

    job.status = 'running';
    job.startedAt = new Date();

    try {
      job.result = await handler(job);
      job.status = 'completed';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      job.status = 'failed';
      job.error = message;
    } finally {
      job.finishedAt = new Date();
    }
  }
}

function normalizeConcurrency(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || value === undefined) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}
