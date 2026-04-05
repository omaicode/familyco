import type { AnyQueueJob, QueueService } from '@familyco/core';
import { Queue, type Job } from 'bullmq';
import IORedis from 'ioredis';

export interface BullMqQueueServiceOptions {
  queueName: string;
  redisUrl: string;
}

export class BullMqQueueService implements QueueService {
  private readonly queue: Queue;

  constructor(options: BullMqQueueServiceOptions) {
    const connection = new IORedis(options.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null
    });

    this.queue = new Queue(options.queueName, {
      connection
    });
  }

  async enqueue(job: AnyQueueJob): Promise<void> {
    await this.queue.add(job.type, job.payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1_000
      },
      removeOnComplete: 100,
      removeOnFail: 200
    });
  }

  async listPendingJobs(): Promise<Array<Job>> {
    return this.queue.getJobs(['waiting', 'delayed', 'active']);
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
