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

export class InMemoryQueueService implements QueueService {
  private readonly jobs: Array<InMemoryQueueJob> = [];
  private handlers: InMemoryQueueHandlers = {};
  private processing = Promise.resolve();

  setHandlers(handlers: InMemoryQueueHandlers): void {
    this.handlers = handlers;
  }

  async enqueue(job: QueueJobEnvelope['type'] extends never ? never : Parameters<QueueService['enqueue']>[0]): Promise<void> {
    const envelope: InMemoryQueueJob = {
      id: randomUUID(),
      createdAt: new Date(),
      type: job.type,
      payload: job.payload,
      status: 'queued'
    };

    this.jobs.push(envelope);
    this.processing = this.processing.then(async () => {
      await this.process(envelope);
    });
    await Promise.resolve();
  }

  async listPendingJobs(): Promise<InMemoryQueueJob[]> {
    return this.jobs;
  }

  async close(): Promise<void> {
    await this.processing.catch(() => undefined);
    this.jobs.length = 0;
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
