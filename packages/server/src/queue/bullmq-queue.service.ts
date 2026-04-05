import type { QueueJob, QueueService } from '@familyco/core';

// Placeholder queue implementation until BullMQ wiring is added.
export class BullMqQueueService implements QueueService {
  private readonly jobs: QueueJob[] = [];

  async enqueue(job: QueueJob): Promise<void> {
    this.jobs.push(job);
  }

  async listPendingJobs(): Promise<QueueJob[]> {
    return this.jobs;
  }
}
