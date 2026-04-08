import { randomUUID } from 'node:crypto';

import type { QueueJobEnvelope, QueueService } from '@familyco/core';

interface InMemoryQueueHandlers {
  onAgentRun?: (job: InMemoryQueueJob<'agent.run'>) => Promise<unknown>;
  onToolExecute?: (job: InMemoryQueueJob<'tool.execute'>) => Promise<unknown>;
}

export interface InMemoryQueueJob<TType extends 'agent.run' | 'tool.execute' = 'agent.run' | 'tool.execute'>
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
}

export class InMemoryQueueService implements QueueService {
  private readonly jobs: Array<InMemoryQueueJob> = [];
  private readonly pendingByType: Record<'agent.run' | 'tool.execute', InMemoryQueueJob[]> = {
    'agent.run': [],
    'tool.execute': []
  };
  private readonly runningByType: Record<'agent.run' | 'tool.execute', number> = {
    'agent.run': 0,
    'tool.execute': 0
  };
  private readonly maxConcurrencyByType: Record<'agent.run' | 'tool.execute', number>;
  private handlers: InMemoryQueueHandlers = {};
  private closed = false;
  private closePromise: Promise<void> | null = null;
  private resolveClosePromise: (() => void) | null = null;

  constructor(options: InMemoryQueueServiceOptions = {}) {
    this.maxConcurrencyByType = {
      'agent.run': normalizeConcurrency(options.agentRunConcurrency, 4),
      'tool.execute': normalizeConcurrency(options.toolExecuteConcurrency, 8)
    };
  }

  setHandlers(handlers: InMemoryQueueHandlers): void {
    this.handlers = handlers;
  }

  async enqueue(job: Parameters<QueueService['enqueue']>[0]): Promise<void> {
    if (this.closed) {
      throw new Error('In-memory queue is closed and cannot accept new jobs');
    }

    const envelope: InMemoryQueueJob = {
      id: randomUUID(),
      createdAt: new Date(),
      type: job.type,
      payload: job.payload,
      status: 'queued'
    };

    this.jobs.push(envelope);
    this.pendingByType[envelope.type].push(envelope);
    this.pump(envelope.type);
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
  }

  private pump(type: 'agent.run' | 'tool.execute'): void {
    while (this.runningByType[type] < this.maxConcurrencyByType[type]) {
      const next = this.pendingByType[type].shift();
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

    const hasRunningJobs = this.runningByType['agent.run'] > 0 || this.runningByType['tool.execute'] > 0;
    const hasPendingJobs = this.pendingByType['agent.run'].length > 0 || this.pendingByType['tool.execute'].length > 0;

    if (hasRunningJobs || hasPendingJobs) {
      return;
    }

    const resolve = this.resolveClosePromise;
    this.resolveClosePromise = null;
    resolve();
  }

  private async process(job: InMemoryQueueJob): Promise<void> {
    const handler = job.type === 'agent.run' ? this.handlers.onAgentRun : this.handlers.onToolExecute;
    if (!handler) {
      return;
    }

    job.status = 'running';
    job.startedAt = new Date();

    try {
      job.result = await handler(job as never);
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
