import type { ToolExecuteJobPayload, ToolExecutor } from '@familyco/core';
import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

export interface ToolCallWorkerOptions {
  queueName: string;
  redisUrl: string;
  toolExecutor: ToolExecutor;
}

export function createToolCallWorker(options: ToolCallWorkerOptions): Worker {
  const connection = new IORedis(options.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null
  });

  return new Worker(
    options.queueName,
    async (job: Job<ToolExecuteJobPayload>) => {
      if (job.name !== 'tool.execute') {
        return;
      }

      await options.toolExecutor.execute(job.data.input);
    },
    {
      connection
    }
  );
}
