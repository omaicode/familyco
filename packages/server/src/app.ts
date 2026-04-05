import Fastify, { type FastifyInstance } from 'fastify';
import { AgentService, TaskService } from '@familyco/core';

import { registerAgentController } from './modules/agent/index.js';
import { registerTaskController } from './modules/task/index.js';
import { InMemoryAgentRepository, InMemoryTaskRepository } from './repositories/index.js';

export interface CreateAppOptions {
  logger?: boolean;
}

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true });
  const agentRepository = new InMemoryAgentRepository();
  const taskRepository = new InMemoryTaskRepository();
  const agentService = new AgentService(agentRepository);
  const taskService = new TaskService(taskRepository);

  app.get('/health', async () => {
    return {
      status: 'ok'
    };
  });

  app.register(async (api) => {
    registerAgentController(api, { agentService });
    registerTaskController(api, { taskService });
  }, { prefix: '/api/v1' });

  app.setErrorHandler((error, _request, reply) => {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const [code] = message.split(':');

    reply.code(400).send({
      statusCode: 400,
      code,
      message
    });
  });

  return app;
}
