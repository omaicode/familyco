import type { AgentRunJobPayload, AgentRunResult, AgentRunner } from '@familyco/core';
import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

export interface AgentRunWorkerOptions {
  queueName: string;
  redisUrl: string;
  agentRunner: AgentRunner;
  onCompleted?: (job: Job<AgentRunJobPayload>, result: AgentRunResult | undefined) => Promise<void>;
  onFailed?: (job: Job<AgentRunJobPayload>, error: Error) => Promise<void>;
}

export function createAgentRunWorker(options: AgentRunWorkerOptions): Worker {
  const connection = new IORedis(options.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null
  });

  const worker = new Worker(
    options.queueName,
    async (job: Job<AgentRunJobPayload>) => {
      if (job.name !== 'agent.run') {
        return;
      }

      return options.agentRunner.run(job.data.request);
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

    void options.onCompleted(job as Job<AgentRunJobPayload>, result as AgentRunResult | undefined);
  });

  worker.on('failed', (job, error) => {
    if (!job || !error) {
      return;
    }

    if (!options.onFailed) {
      return;
    }

    void options.onFailed(job as Job<AgentRunJobPayload>, error);
  });

  return worker;
}
