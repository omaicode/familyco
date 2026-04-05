import type { ToolExecuteJobPayload, ToolExecutor } from '@familyco/core';
import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

export interface ToolCallWorkerOptions {
  queueName: string;
  redisUrl: string;
  toolExecutor: ToolExecutor;
  onCompleted?: (job: Job<ToolExecuteJobPayload>, result: unknown) => Promise<void>;
  onFailed?: (job: Job<ToolExecuteJobPayload>, error: Error) => Promise<void>;
}

export function createToolCallWorker(options: ToolCallWorkerOptions): Worker {
  const connection = new IORedis(options.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null
  });

  const worker = new Worker(
    options.queueName,
    async (job: Job<ToolExecuteJobPayload>) => {
      if (job.name !== 'tool.execute') {
        return;
      }

      return options.toolExecutor.execute(job.data.input);
    },
    {
      connection
    }
  );

  worker.on('completed', (job, result) => {
    if (!job) {
      return;
    }

    if (!options.onCompleted) {
      return;
    }

    void options.onCompleted(job as Job<ToolExecuteJobPayload>, result);
  });

  worker.on('failed', (job, error) => {
    if (!job || !error) {
      return;
    }

    if (!options.onFailed) {
      return;
    }

    void options.onFailed(job as Job<ToolExecuteJobPayload>, error);
  });

  return worker;
}
