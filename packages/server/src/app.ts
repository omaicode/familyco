import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import {
  AgentRunner,
  AgentService,
  ApprovalGuard,
  ApprovalService,
  AuditService,
  EventBus,
  ProjectService,
  TaskService,
  type AgentRepository,
  type ApprovalRepository,
  type AuditRepository,
  type ProjectRepository,
  type TaskRepository
} from '@familyco/core';

import { prismaClient } from './db/prisma-client.js';
import { registerAgentController } from './modules/agent/index.js';
import { registerApprovalController } from './modules/approval/index.js';
import { registerAuthController } from './modules/auth/index.js';
import { registerAuditController } from './modules/audit/index.js';
import { registerEngineController } from './modules/engine/index.js';
import { registerProjectController } from './modules/project/index.js';
import { registerTaskController } from './modules/task/index.js';
import { ApiKeyService } from './modules/auth/api-key.service.js';
import {
  authenticateApiRequest,
  getAuthApiKey,
  getAuthApiKeySalt,
  registerAuthPlugin
} from './plugins/auth.plugin.js';
import {
  InMemoryAgentRepository,
  InMemoryApiKeyRepository,
  InMemoryApprovalRepository,
  InMemoryAuditRepository,
  InMemoryProjectRepository,
  InMemoryTaskRepository,
  PrismaAgentRepository,
  PrismaApiKeyRepository,
  PrismaApprovalRepository,
  PrismaAuditRepository,
  PrismaProjectRepository,
  PrismaTaskRepository
} from './repositories/index.js';
import {
  BullMqQueueService,
  createAgentRunWorker,
  InMemoryQueueService,
  createToolCallWorker
} from './queue/index.js';
import { DefaultToolExecutor } from './tools/index.js';

export type RepositoryDriver = 'memory' | 'prisma';
export type QueueDriver = 'memory' | 'bullmq';

export interface CreateAppOptions {
  logger?: boolean;
  repositoryDriver?: RepositoryDriver;
  queueDriver?: QueueDriver;
  authApiKey?: string;
  authApiKeySalt?: string;
}

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true });

  app.register(cors, {
    origin: createCorsOriginMatcher(),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: false
  });

  registerAuthPlugin(app);

  const repositoryDriver =
    options.repositoryDriver ??
    (process.env.FAMILYCO_REPOSITORY_DRIVER as RepositoryDriver | undefined) ??
    'memory';
  const authApiKey = options.authApiKey ?? getAuthApiKey();
  const authApiKeySalt = options.authApiKeySalt ?? getAuthApiKeySalt();
  const queueDriver =
    options.queueDriver ??
    (process.env.FAMILYCO_QUEUE_DRIVER as QueueDriver | undefined) ??
    'memory';
  const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const queueName = process.env.FAMILYCO_QUEUE_NAME ?? 'familyco-jobs';
  const enableQueueWorkers = process.env.ENABLE_QUEUE_WORKERS === '1';

  const {
    agentRepository,
    apiKeyRepository,
    approvalRepository,
    auditRepository,
    projectRepository,
    taskRepository
  } =
    createRepositories(repositoryDriver);
  const eventBus = new EventBus();
  const agentService = new AgentService(agentRepository, eventBus);
  const apiKeyService = new ApiKeyService(apiKeyRepository, authApiKeySalt);
  const approvalService = new ApprovalService(approvalRepository, eventBus);
  const auditService = new AuditService(auditRepository);
  const projectService = new ProjectService(projectRepository);
  const taskService = new TaskService(taskRepository, eventBus);
  const approvalGuard = new ApprovalGuard();
  const toolExecutor = new DefaultToolExecutor();
  const agentRunner = new AgentRunner(approvalGuard, toolExecutor);
  const queueService =
    queueDriver === 'bullmq'
      ? new BullMqQueueService({
          queueName,
          redisUrl
        })
      : new InMemoryQueueService();
  const workers: Array<{ close: () => Promise<void> }> = [];

  app.addHook('onReady', async () => {
    const bootstrapApiKey = await apiKeyService.ensureBootstrapKey('bootstrap', authApiKey);
    await auditService.write({
      actorId: 'system',
      action: 'auth.api_key.bootstrap',
      targetId: bootstrapApiKey.id,
      payload: {
        name: bootstrapApiKey.name
      }
    });

    if (enableQueueWorkers && queueDriver === 'bullmq') {
      workers.push(
        createAgentRunWorker({
          queueName,
          redisUrl,
          agentRunner
        }),
        createToolCallWorker({
          queueName,
          redisUrl,
          toolExecutor
        })
      );
    }
  });

  app.addHook('onClose', async () => {
    await Promise.all(workers.map(async (worker) => worker.close()));
    await queueService.close();
  });

  app.get('/health', async () => {
    return {
      status: 'ok'
    };
  });

  app.register(async (api) => {
    registerAuthController(api, {
      apiKeyService,
      agentService,
      auditService,
      signToken: (payload) => api.jwt.sign(payload)
    });

    api.addHook('preHandler', async (request, reply) => {
      await authenticateApiRequest(request, reply, apiKeyService);
    });

    registerAgentController(api, { agentService, auditService });
    registerApprovalController(api, { approvalService, auditService });
    registerAuditController(api, { auditService });
    registerEngineController(api, { queueService, auditService });
    registerProjectController(api, { projectService, auditService });
    registerTaskController(api, { taskService, auditService });
  }, { prefix: '/api/v1' });

  app.setErrorHandler((error, _request, reply) => {
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

  return app;
}

function createCorsOriginMatcher(): (origin: string | undefined, callback: (error: Error | null, allow: boolean) => void) => void {
  const configuredOrigins =
    process.env.CORS_ORIGINS?.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0) ?? [];

  const defaultOrigins = ['http://127.0.0.1:5173', 'http://localhost:5173'];
  const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, allowedOrigins.has(origin));
  };
}

function createRepositories(
  repositoryDriver: RepositoryDriver
): {
  agentRepository: AgentRepository;
  apiKeyRepository: import('./modules/auth/api-key.service.js').ApiKeyRepository;
  approvalRepository: ApprovalRepository;
  auditRepository: AuditRepository;
  projectRepository: ProjectRepository;
  taskRepository: TaskRepository;
} {
  if (repositoryDriver === 'prisma') {
    return {
      agentRepository: new PrismaAgentRepository(prismaClient),
      apiKeyRepository: new PrismaApiKeyRepository(prismaClient),
      approvalRepository: new PrismaApprovalRepository(prismaClient),
      auditRepository: new PrismaAuditRepository(prismaClient),
      projectRepository: new PrismaProjectRepository(prismaClient),
      taskRepository: new PrismaTaskRepository(prismaClient)
    };
  }

  return {
    agentRepository: new InMemoryAgentRepository(),
    apiKeyRepository: new InMemoryApiKeyRepository(),
    approvalRepository: new InMemoryApprovalRepository(),
    auditRepository: new InMemoryAuditRepository(),
    projectRepository: new InMemoryProjectRepository(),
    taskRepository: new InMemoryTaskRepository()
  };
}
