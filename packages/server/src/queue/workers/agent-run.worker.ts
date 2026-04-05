import type { AgentRunner, AgentRunJobPayload } from '@familyco/core';
import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

export interface AgentRunWorkerOptions {
  queueName: string;
  redisUrl: string;
  agentRunner: AgentRunner;
}

export function createAgentRunWorker(options: AgentRunWorkerOptions): Worker {
  const connection = new IORedis(options.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null
  });

  return new Worker(
    options.queueName,
    async (job: Job<AgentRunJobPayload>) => {
      if (job.name !== 'agent.run') {
        return;
      }

      await options.agentRunner.run(job.data.request);
    },
    {
      connection
    }
  );
}
