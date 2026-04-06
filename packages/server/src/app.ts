import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import {
  AgentRunner,
  AgentService,
  ApprovalGuard,
  ApprovalService,
  AuditService,
  EventBus,
  InboxService,
  ProjectService,
  SettingsService,
  TaskService,
  type AgentRepository,
  type ApprovalRepository,
  type AuditRepository,
  type InboxRepository,
  type ProjectRepository,
  type SettingsRepository,
  type TaskRepository
} from '@familyco/core';

import { prismaClient } from './db/prisma-client.js';
import { registerAgentController } from './modules/agent/index.js';
import { registerApprovalController } from './modules/approval/index.js';
import { registerAuthController } from './modules/auth/index.js';
import { registerAuditController } from './modules/audit/index.js';
import { registerDashboardController } from './modules/dashboard/index.js';
import { registerEngineController } from './modules/engine/index.js';
import { registerInboxController } from './modules/inbox/index.js';
import { registerProjectController } from './modules/project/index.js';
import { registerSettingsController } from './modules/settings/index.js';
import { registerSetupController } from './modules/setup/index.js';
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
  InMemoryInboxRepository,
  InMemoryProjectRepository,
  InMemorySettingsRepository,
  InMemoryTaskRepository,
  PrismaAgentRepository,
  PrismaApiKeyRepository,
  PrismaApprovalRepository,
  PrismaAuditRepository,
  PrismaInboxRepository,
  PrismaProjectRepository,
  PrismaSettingsRepository,
  PrismaTaskRepository
} from './repositories/index.js';
import {
  BullMqQueueService,
  createAgentRunWorker,
  InMemoryQueueService,
  createToolCallWorker
} from './queue/index.js';
import { DefaultToolExecutor } from './tools/index.js';
import { registerEventGateway } from './ws/ws-gateway.js';
import { DailyQuotaGuard } from './modules/shared/daily-quota.guard.js';

export type RepositoryDriver = 'memory' | 'prisma';
export type QueueDriver = 'memory' | 'bullmq';

export interface CreateAppOptions {
  logger?: boolean;
  repositoryDriver?: RepositoryDriver;
  queueDriver?: QueueDriver;
  authApiKey?: string;
  authApiKeySalt?: string;
  dailyQuotaLimit?: number;
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
  app.register(websocket);

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
  const dailyQuotaLimit = options.dailyQuotaLimit ?? Number(process.env.DAILY_QUOTA_LIMIT ?? 50);

  const {
    agentRepository,
    apiKeyRepository,
    approvalRepository,
    auditRepository,
    inboxRepository,
    projectRepository,
    settingsRepository,
    taskRepository
  } = createRepositories(repositoryDriver);

  const eventBus = new EventBus();
  const agentService = new AgentService(agentRepository, eventBus);
  const apiKeyService = new ApiKeyService(apiKeyRepository, authApiKeySalt);
  const approvalService = new ApprovalService(approvalRepository, eventBus);
  const auditService = new AuditService(auditRepository);
  const inboxService = new InboxService(inboxRepository);
  const projectService = new ProjectService(projectRepository);
  const settingsService = new SettingsService(settingsRepository);
  const taskService = new TaskService(taskRepository, eventBus);
  const approvalGuard = new ApprovalGuard();
  const dailyQuotaGuard = new DailyQuotaGuard({ maxPerDay: dailyQuotaLimit });
  const toolExecutor = new DefaultToolExecutor({
    agentService,
    projectService,
    settingsService,
    taskService
  });
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
          agentRunner,
          onCompleted: async (job, result) => {
            await auditService.write({
              actorId: job.data.request.agentId,
              action: 'engine.agent.run.completed',
              targetId: job.data.request.agentId,
              payload: {
                status: result?.status,
                toolName: job.data.request.toolName
              }
            });

            await inboxService.createMessage({
              recipientId: 'founder',
              senderId: job.data.request.agentId,
              type: 'report',
              title: `Agent run ${result?.status ?? 'completed'}`,
              body: `Action ${job.data.request.action} processed by ${job.data.request.toolName}`,
              payload: {
                result
              }
            });
          },
          onFailed: async (job, error) => {
            await auditService.write({
              actorId: job.data.request.agentId,
              action: 'engine.agent.run.failed',
              targetId: job.data.request.agentId,
              payload: {
                toolName: job.data.request.toolName,
                message: error.message
              }
            });

            await inboxService.createMessage({
              recipientId: 'founder',
              senderId: job.data.request.agentId,
              type: 'alert',
              title: 'Agent run failed',
              body: error.message,
              payload: {
                action: job.data.request.action,
                toolName: job.data.request.toolName
              }
            });
          }
        }),
        createToolCallWorker({
          queueName,
          redisUrl,
          toolExecutor,
          onCompleted: async (job, result) => {
            await auditService.write({
              actorId: 'system',
              action: 'engine.tool.run.completed',
              payload: {
                toolName: job.data.input.toolName,
                result
              }
            });
          },
          onFailed: async (job, error) => {
            await auditService.write({
              actorId: 'system',
              action: 'engine.tool.run.failed',
              payload: {
                toolName: job.data.input.toolName,
                message: error.message
              }
            });
          }
        })
      );
    }
  });

  app.addHook('onClose', async () => {
    await Promise.all(workers.map(async (worker) => worker.close()));
    await queueService.close();
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(
    async (api) => {
      registerAuthController(api, {
        apiKeyService,
        agentService,
        auditService,
        signToken: (payload) => api.jwt.sign(payload)
      });

      api.addHook('preHandler', async (request, reply) => {
        await authenticateApiRequest(request, reply, apiKeyService);
      });

      registerAgentController(api, {
        agentService,
        inboxService,
        approvalService,
        auditService,
        approvalGuard,
        agentRunner
      });
      registerApprovalController(api, {
        approvalService,
        agentService,
        projectService,
        settingsService,
        taskService,
        auditService,
        inboxService
      });
      registerAuditController(api, { auditService });
      registerDashboardController(api, {
        agentService,
        approvalService,
        auditService,
        projectService,
        taskService
      });
      registerEngineController(api, {
        queueService,
        auditService,
        approvalService,
        approvalGuard,
        dailyQuotaGuard
      });
      registerInboxController(api, { inboxService, auditService });
      registerProjectController(api, {
        projectService,
        taskService,
        approvalService,
        auditService,
        approvalGuard
      });
      registerSettingsController(api, {
        settingsService,
        auditService
      });
      registerSetupController(api, {
        agentService,
        projectService,
        settingsService,
        auditService
      });
      registerTaskController(api, {
        taskService,
        agentService,
        projectService,
        settingsService,
        approvalService,
        auditService,
        approvalGuard
      });
      registerEventGateway(api, { eventBus });
    },
    { prefix: '/api/v1' }
  );

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

function createCorsOriginMatcher(): (
  origin: string | undefined,
  callback: (error: Error | null, allow: boolean) => void
) => void {
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
  inboxRepository: InboxRepository;
  projectRepository: ProjectRepository;
  settingsRepository: SettingsRepository;
  taskRepository: TaskRepository;
} {
  if (repositoryDriver === 'prisma') {
    const client = prismaClient;
    return {
      agentRepository: new PrismaAgentRepository(client),
      apiKeyRepository: new PrismaApiKeyRepository(client),
      approvalRepository: new PrismaApprovalRepository(client),
      auditRepository: new PrismaAuditRepository(client),
      inboxRepository: new PrismaInboxRepository(client),
      projectRepository: new PrismaProjectRepository(client),
      settingsRepository: new PrismaSettingsRepository(client),
      taskRepository: new PrismaTaskRepository(client)
    };
  }

  return {
    agentRepository: new InMemoryAgentRepository(),
    apiKeyRepository: new InMemoryApiKeyRepository(),
    approvalRepository: new InMemoryApprovalRepository(),
    auditRepository: new InMemoryAuditRepository(),
    inboxRepository: new InMemoryInboxRepository(),
    projectRepository: new InMemoryProjectRepository(),
    settingsRepository: new InMemorySettingsRepository(),
    taskRepository: new InMemoryTaskRepository()
  };
}
