import type { FastifyInstance } from 'fastify';

import { summarizeQueueJobs } from './helpers.js';
import type { AppLifecycleState } from './lifecycle.js';
import type { InMemoryQueueService } from '../queue/index.js';

export interface RegisterHttpDeps {
  app: FastifyInstance;
  queueService: InMemoryQueueService;
  queueDriver: 'memory';
  agentRunConcurrency: number;
  toolExecuteConcurrency: number;
  state: AppLifecycleState;
}

export function registerHttpInfrastructure(deps: RegisterHttpDeps): void {
  deps.app.get('/health', async () => {
    const jobs = await deps.queueService.listPendingJobs();
    const queueStats = summarizeQueueJobs(jobs);

    return {
      status: deps.state.readOnlyMode ? 'degraded' : 'ok',
      mode: deps.state.readOnlyMode ? 'read_only' : 'normal',
      queueDriver: deps.queueDriver,
      queue: {
        agentRunConcurrency: deps.agentRunConcurrency,
        toolExecuteConcurrency: deps.toolExecuteConcurrency,
        ...queueStats
      },
      migration: deps.state.migrationState
        ? {
            status: deps.state.migrationState.status,
            pendingCount: deps.state.migrationState.pendingCount,
            appliedCount: deps.state.migrationState.appliedCount,
            errorMessage: deps.state.migrationState.errorMessage
          }
        : null
    };
  });

  deps.app.setErrorHandler((error, _request, reply) => {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const [code] = message.split(':');
    const statusCode =
      typeof (error as { statusCode?: number }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : 400;

    reply.code(statusCode).send({
      statusCode,
      code,
      message
    });
  });
}
