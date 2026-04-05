import type { AnyQueueJob, QueueService } from '@familyco/core';

export class InMemoryQueueService implements QueueService {
  private readonly jobs: AnyQueueJob[] = [];

  async enqueue(job: AnyQueueJob): Promise<void> {
    this.jobs.push(job);
  }

  async listPendingJobs(): Promise<AnyQueueJob[]> {
    return this.jobs;
  }

  async close(): Promise<void> {
    this.jobs.length = 0;
  }
}
