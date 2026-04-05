import Fastify, { type FastifyInstance } from 'fastify';
import {
  AgentService,
  ApprovalService,
  ProjectService,
  TaskService,
  type AgentRepository,
  type ApprovalRepository,
  type ProjectRepository,
  type TaskRepository
} from '@familyco/core';

import { prismaClient } from './db/prisma-client.js';
import { registerAgentController } from './modules/agent/index.js';
import { registerApprovalController } from './modules/approval/index.js';
import { registerProjectController } from './modules/project/index.js';
import { registerTaskController } from './modules/task/index.js';
import {
  InMemoryAgentRepository,
  InMemoryApprovalRepository,
  InMemoryProjectRepository,
  InMemoryTaskRepository,
  PrismaAgentRepository,
  PrismaApprovalRepository,
  PrismaProjectRepository,
  PrismaTaskRepository
} from './repositories/index.js';

export type RepositoryDriver = 'memory' | 'prisma';

export interface CreateAppOptions {
  logger?: boolean;
  repositoryDriver?: RepositoryDriver;
}

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true });
  const repositoryDriver =
    options.repositoryDriver ??
    (process.env.FAMILYCO_REPOSITORY_DRIVER as RepositoryDriver | undefined) ??
    'memory';

  const { agentRepository, approvalRepository, projectRepository, taskRepository } =
    createRepositories(repositoryDriver);
  const agentService = new AgentService(agentRepository);
  const approvalService = new ApprovalService(approvalRepository);
  const projectService = new ProjectService(projectRepository);
  const taskService = new TaskService(taskRepository);

  app.get('/health', async () => {
    return {
      status: 'ok'
    };
  });

  app.register(async (api) => {
    registerAgentController(api, { agentService });
    registerApprovalController(api, { approvalService });
    registerProjectController(api, { projectService });
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

function createRepositories(
  repositoryDriver: RepositoryDriver
): {
  agentRepository: AgentRepository;
  approvalRepository: ApprovalRepository;
  projectRepository: ProjectRepository;
  taskRepository: TaskRepository;
} {
  if (repositoryDriver === 'prisma') {
    return {
      agentRepository: new PrismaAgentRepository(prismaClient),
      approvalRepository: new PrismaApprovalRepository(prismaClient),
      projectRepository: new PrismaProjectRepository(prismaClient),
      taskRepository: new PrismaTaskRepository(prismaClient)
    };
  }

  return {
    agentRepository: new InMemoryAgentRepository(),
    approvalRepository: new InMemoryApprovalRepository(),
    projectRepository: new InMemoryProjectRepository(),
    taskRepository: new InMemoryTaskRepository()
  };
}
