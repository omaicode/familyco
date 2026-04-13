import Fastify, { type FastifyInstance } from 'fastify';
import os from 'node:os';
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
globalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url))

import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import {
  AgentRunner,
  AgentRunService,
  AgentService,
  ApprovalGuard,
  ApprovalService,
  AuditService,
  BudgetUsageService,
  EventBus,
  InboxService,
  ProjectService,
  SettingsService,
  TaskService,
  type AgentRunRequest,
  type AgentRunResult,
  type AgentRepository,
  type AgentRunRepository,
  type ApprovalRepository,
  type AuditRepository,
  type BudgetUsageRepository,
  type InboxRepository,
  type ProjectRepository,
  type SettingsRepository,
  type TaskRepository
} from '@familyco/core';

import { prismaClient } from '@familyco/db'
import { runMigrationsWithSafety, type MigrationRunResult } from '@familyco/db';
import { ChatAttachmentStore, ChatStreamRegistry, registerAgentController } from './modules/agent/index.js';
import { registerApprovalController } from './modules/approval/index.js';
import { registerAuthController } from './modules/auth/index.js';
import { registerAuditController } from './modules/audit/index.js';
import { registerBudgetController } from './modules/budget/index.js';
import { registerDashboardController } from './modules/dashboard/index.js';
import { registerEngineController } from './modules/engine/index.js';
import { registerInboxController } from './modules/inbox/index.js';
import { registerProjectController } from './modules/project/index.js';
import { registerProviderController } from './modules/provider/index.js';
import { registerSkillsController } from './modules/skills/index.js';
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
  InMemoryAgentRunRepository,
  InMemoryApiKeyRepository,
  InMemoryApprovalRepository,
  InMemoryAuditRepository,
  InMemoryBudgetUsageRepository,
  InMemoryInboxRepository,
  InMemoryProjectRepository,
  InMemorySettingsRepository,
  InMemoryTaskRepository,
  InMemoryTaskSessionRepository,
  PrismaAgentRepository,
  PrismaAgentRunRepository,
  PrismaApiKeyRepository,
  PrismaApprovalRepository,
  PrismaAuditRepository,
  PrismaBudgetUsageRepository,
  PrismaInboxRepository,
  PrismaProjectRepository,
  PrismaSettingsRepository,
  PrismaTaskRepository,
  PrismaTaskSessionRepository
} from './repositories/index.js';
import {
  InMemoryQueueService
} from './queue/index.js';
import { HeartbeatRuntimeService } from './runtime/heartbeat-runtime.service.js';
import { SettingsBackedMemoryService } from './runtime/settings-memory.service.js';
import { TaskExecutionCoordinator } from './runtime/task-execution.coordinator.js';
import { DefaultToolExecutor } from './tools/index.js';
import { createAdapterRegistry } from './adapters/index.js';
import { createSettingsEncryption } from './modules/settings/settings.encryption.js';
import { SkillsService } from './modules/skills/skills.service.js';
import { registerEventGateway } from './ws/ws-gateway.js';
import { DailyQuotaGuard } from './modules/shared/daily-quota.guard.js';
import { ChatEngineService } from './modules/agent/chat-engine.service.js';

export type RepositoryDriver = 'memory' | 'prisma';
export type QueueDriver = 'memory';

export interface CreateAppOptions {
  logger?: boolean;
  repositoryDriver?: RepositoryDriver;
  queueDriver?: QueueDriver;
  agentRunConcurrency?: number;
  toolExecuteConcurrency?: number;
  authApiKey?: string;
  authApiKeySalt?: string;
  dailyQuotaLimit?: number;
  enableHeartbeatScheduler?: boolean;
  heartbeatPollMs?: number;
  defaultHeartbeatMinutes?: number;
  skillsRootDir?: string;
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
  app.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024,
      files: 1
    }
  });
  app.register(websocket);

  const repositoryDriver =
    options.repositoryDriver ??
    (process.env.FAMILYCO_REPOSITORY_DRIVER as RepositoryDriver | undefined) ??
    'memory';
  const authApiKey = options.authApiKey ?? getAuthApiKey();
  const authApiKeySalt = options.authApiKeySalt ?? getAuthApiKeySalt();
  const queueDriver: QueueDriver = 'memory';
  const defaultConcurrency = resolveDefaultQueueConcurrency();
  const agentRunConcurrency = normalizePositiveInteger(
    options.agentRunConcurrency ??
      Number(process.env.FAMILYCO_QUEUE_AGENT_CONCURRENCY ?? defaultConcurrency.agentRunConcurrency),
    defaultConcurrency.agentRunConcurrency
  );
  const toolExecuteConcurrency = normalizePositiveInteger(
    options.toolExecuteConcurrency ??
      Number(process.env.FAMILYCO_QUEUE_TOOL_CONCURRENCY ?? defaultConcurrency.toolExecuteConcurrency),
    defaultConcurrency.toolExecuteConcurrency
  );
  const dailyQuotaLimit = options.dailyQuotaLimit ?? Number(process.env.DAILY_QUOTA_LIMIT ?? 50);
  const enableHeartbeatScheduler =
    options.enableHeartbeatScheduler ??
    (process.env.ENABLE_AGENT_HEARTBEATS
      ? process.env.ENABLE_AGENT_HEARTBEATS === '1'
      : repositoryDriver === 'prisma');

  const settingsEncryption = createSettingsEncryption();

  const {
    agentRepository,
    agentRunRepository,
    apiKeyRepository,
    approvalRepository,
    auditRepository,
    budgetUsageRepository,
    inboxRepository,
    projectRepository,
    settingsRepository,
    taskRepository,
    taskSessionRepository
  } = createRepositories(repositoryDriver, settingsEncryption);
  
  const eventBus = new EventBus();
  const agentService = new AgentService(
    agentRepository,
    eventBus,
    taskRepository,
    projectRepository,
    approvalRepository
  );
  const apiKeyService = new ApiKeyService(apiKeyRepository, authApiKeySalt);
  const approvalService = new ApprovalService(approvalRepository, eventBus);
  const auditService = new AuditService(auditRepository);
  const budgetUsageService = new BudgetUsageService(budgetUsageRepository);
  const inboxService = new InboxService(inboxRepository);
  const projectService = new ProjectService(projectRepository);
  const agentRunService = new AgentRunService(agentRunRepository);
  const settingsService = new SettingsService(settingsRepository);
  const skillsService = new SkillsService(
    settingsService,
    options.skillsRootDir ?? path.resolve(__dirname, '../../../', 'skills')
  );
  const taskService = new TaskService(taskRepository, eventBus);
  const approvalGuard = new ApprovalGuard();
  const dailyQuotaGuard = new DailyQuotaGuard({ maxPerDay: dailyQuotaLimit });
  const adapterRegistry = createAdapterRegistry({
    logger: app.log,
    auditService,
    budgetUsageService
  });
  const toolExecutor = new DefaultToolExecutor({
    agentService,
    projectService,
    settingsService,
    skillsService,
    taskService,
    adapterRegistry,
    auditService,
    inboxService,
    approvalService
  });
  const memoryService = new SettingsBackedMemoryService(settingsRepository);
  const agentRunner = new AgentRunner(approvalGuard, toolExecutor, memoryService);
  const chatEngineService = new ChatEngineService(settingsService, adapterRegistry, skillsService);
  const chatStreamRegistry = new ChatStreamRegistry();
  const chatAttachmentStore = new ChatAttachmentStore();

  const taskCoordinator = new TaskExecutionCoordinator({
    chatEngineService,
    toolExecutor,
    taskService,
    auditService,
    inboxService,
    agentService,
    skillsService,
    sessionStore: taskSessionRepository,
    eventBus
  });

  const queueService = new InMemoryQueueService({
    agentRunConcurrency,
    toolExecuteConcurrency
  });
  const heartbeatRuntime = new HeartbeatRuntimeService({
    queueService,
    agentService,
    settingsService,
    skillsService,
    taskService,
    pollMs: options.heartbeatPollMs,
    defaultHeartbeatMinutes: options.defaultHeartbeatMinutes
  });
  const canProcessAsyncJobs = true;
  let migrationState: MigrationRunResult | null = null;
  let readOnlyMode = false;

  const executeAgentRun = async (request: AgentRunRequest): Promise<AgentRunResult> => {
    if (request.runId) {
      await agentRunService.updateState(request.runId, { state: 'planning' });
    }

    await heartbeatRuntime.markStarted(request);

    if (request.runId) {
      await agentRunService.updateState(request.runId, { state: 'executing' });
    }

    return agentRunner.run(request);
  };

  const handleAgentRunCompleted = async (
    request: AgentRunRequest,
    result: AgentRunResult | undefined
  ): Promise<void> => {
    if (result) {
      await heartbeatRuntime.markCompleted(request, result);
    }

    if (request.runId) {
      await agentRunService.updateState(request.runId, {
        state: result?.status === 'blocked' ? 'waiting_approval' : 'completed',
        outputSummary:
          result?.status === 'blocked'
            ? result.reason?.slice(0, 500) ?? null
            : result?.output
              ? JSON.stringify(result.output).slice(0, 500)
              : 'Execution completed'
      });
    }

    await auditService.write({
      actorId: request.agentId,
      action: 'engine.agent.run.completed',
      targetId: request.agentId,
      payload: {
        status: result?.status,
        toolName: request.toolName,
        action: request.action
      }
    });

    await inboxService.createMessage({
      recipientId: 'founder',
      senderId: request.agentId,
      type: 'report',
      title: request.action === 'heartbeat.tick' ? 'Heartbeat completed' : `Agent run ${result?.status ?? 'completed'}`,
      body:
        request.action === 'heartbeat.tick'
          ? `Heartbeat processed by ${request.toolName}`
          : `Action ${request.action} processed by ${request.toolName}`,
      payload: {
        result
      }
    });
  };

  const handleAgentRunFailed = async (request: AgentRunRequest, error: Error): Promise<void> => {
    await heartbeatRuntime.markFailed(request, error);

    if (request.runId) {
      await agentRunService.updateState(request.runId, {
        state: 'failed',
        outputSummary: error.message.slice(0, 500)
      });
    }

    await auditService.write({
      actorId: request.agentId,
      action: 'engine.agent.run.failed',
      targetId: request.agentId,
      payload: {
        toolName: request.toolName,
        action: request.action,
        message: error.message
      }
    });

    await inboxService.createMessage({
      recipientId: 'founder',
      senderId: request.agentId,
      type: 'alert',
      title: request.action === 'heartbeat.tick' ? 'Heartbeat failed' : 'Agent run failed',
      body: error.message,
      payload: {
        action: request.action,
        toolName: request.toolName
      }
    });
  };

  if (queueService instanceof InMemoryQueueService) {
    queueService.setHandlers({
      onAgentRun: async (job) => {
        try {
          const result = await executeAgentRun(job.payload.request);
          await handleAgentRunCompleted(job.payload.request, result);
          return result;
        } catch (error) {
          const normalizedError = toError(error);
          await handleAgentRunFailed(job.payload.request, normalizedError);
          throw normalizedError;
        }
      },
      onToolExecute: async (job) => {
        try {
          const result = await toolExecutor.execute(job.payload.input);
          await auditService.write({
            actorId: 'system',
            action: 'engine.tool.run.completed',
            payload: {
              toolName: job.payload.input.toolName,
              result
            }
          });
          return result;
        } catch (error) {
          const normalizedError = toError(error);
          await auditService.write({
            actorId: 'system',
            action: 'engine.tool.run.failed',
            payload: {
              toolName: job.payload.input.toolName,
              message: normalizedError.message
            }
          });
          throw normalizedError;
        }
      },
      onTaskExecute: async (job) => {
        const syntheticRequest = {
          agentId: job.payload.agentId,
          approvalMode: 'auto' as const,
          action: 'task.execute',
          toolName: 'task.execute',
          toolArguments: {},
          input: `Task execution for agent ${job.payload.agentId}`
        };

        await heartbeatRuntime.markStarted(syntheticRequest);

        try {
          const executionResult = await taskCoordinator.executeForAgent(job.payload.agentId);

          const syntheticAgentResult = {
            status: (executionResult.status === 'waiting_for_approval' || executionResult.status === 'blocked')
              ? ('blocked' as const)
              : ('completed' as const),
            agentId: job.payload.agentId,
            action: 'task.execute',
            toolName: 'task.execute'
          };

          await heartbeatRuntime.markCompleted(syntheticRequest, syntheticAgentResult);

          await auditService.write({
            actorId: job.payload.agentId,
            action: 'engine.task.execute.completed',
            targetId: executionResult.taskId || job.payload.agentId,
            payload: {
              status: executionResult.status,
              summary: executionResult.summary.slice(0, 500)
            }
          });

          return executionResult;
        } catch (error) {
          const normalizedError = toError(error);
          await heartbeatRuntime.markFailed(syntheticRequest, normalizedError);
          await auditService.write({
            actorId: job.payload.agentId,
            action: 'engine.task.execute.failed',
            payload: { message: normalizedError.message }
          });
          throw normalizedError;
        }
      }
    });
  }

  app.addHook('onReady', async () => {
    if (repositoryDriver === 'prisma') {
      migrationState = await runMigrationsWithSafety();
      readOnlyMode = migrationState.readOnlyMode;

      await auditService.write({
        actorId: 'system',
        action: migrationState.status === 'ok' ? 'db.migration.completed' : 'db.migration.failed',
        payload: {
          status: migrationState.status,
          pendingCount: migrationState.pendingCount,
          appliedCount: migrationState.appliedCount,
          backupPath: migrationState.backupPath,
          dbPath: migrationState.dbPath,
          errorMessage: migrationState.errorMessage
        }
      });
    }

    const bootstrapApiKey = await apiKeyService.ensureBootstrapKey('bootstrap', authApiKey);
    await auditService.write({
      actorId: 'system',
      action: 'auth.api_key.bootstrap',
      targetId: bootstrapApiKey.id,
      payload: {
        name: bootstrapApiKey.name
      }
    });

    if (enableHeartbeatScheduler && canProcessAsyncJobs) {
      await heartbeatRuntime.start();
    }
  });

  app.addHook('onClose', async () => {
    await heartbeatRuntime.stop();
    await queueService.close();
  });

  app.get('/health', async () => {
    const jobs = await queueService.listPendingJobs();
    const queueStats = summarizeQueueJobs(jobs);

    return {
      status: readOnlyMode ? 'degraded' : 'ok',
      mode: readOnlyMode ? 'read_only' : 'normal',
      queueDriver,
      queue: {
        agentRunConcurrency,
        toolExecuteConcurrency,
        ...queueStats
      },
      migration: migrationState
        ? {
            status: migrationState.status,
            pendingCount: migrationState.pendingCount,
            appliedCount: migrationState.appliedCount,
            errorMessage: migrationState.errorMessage
          }
        : null
    };
  });

  app.register(
    async (api) => {
      registerAuthController(api, {
        apiKeyService,
        agentService,
        auditService,
        signToken: (payload) => api.jwt.sign(payload)
      });

      api.addHook('preHandler', async (request, reply) => {
        if (readOnlyMode && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
          reply.code(503).send({
            statusCode: 503,
            code: 'READ_ONLY_MODE',
            message: 'Application is in read-only mode because database migration failed'
          });
          return;
        }

        await authenticateApiRequest(request, reply, apiKeyService);
      });

      registerAgentController(api, {
        agentService,
        inboxService,
        approvalService,
        auditService,
        approvalGuard,
        agentRunner,
        chatEngineService,
        toolExecutor,
        listTools: () => toolExecutor.listToolDefinitions(),
        chatStreamRegistry,
        chatAttachmentStore,
        settingsService
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
      registerBudgetController(api, { budgetUsageService, settingsService });
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
        dailyQuotaGuard,
        agentRunService
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
      registerSkillsController(api, {
        skillsService,
        auditService
      });
      registerSetupController(api, {
        agentService,
        projectService,
        settingsService,
        auditService
      });
      registerProviderController(api, { adapterRegistry });
      registerTaskController(api, {
        taskService,
        agentService,
        projectService,
        settingsService,
        approvalService,
        auditService,
        approvalGuard,
        queueService
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

function normalizePositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function resolveDefaultQueueConcurrency(): {
  agentRunConcurrency: number;
  toolExecuteConcurrency: number;
} {
  const cores = os.availableParallelism();
  return {
    agentRunConcurrency: Math.max(2, Math.floor(cores / 2)),
    toolExecuteConcurrency: Math.max(4, cores)
  };
}

function summarizeQueueJobs(jobs: unknown[]): {
  totalJobs: number;
  queuedJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  byType: {
    agentRun: { queued: number; running: number; completed: number; failed: number };
    toolExecute: { queued: number; running: number; completed: number; failed: number };
  };
} {
  const byType = {
    agentRun: { queued: 0, running: 0, completed: 0, failed: 0 },
    toolExecute: { queued: 0, running: 0, completed: 0, failed: 0 }
  };

  let queuedJobs = 0;
  let runningJobs = 0;
  let completedJobs = 0;
  let failedJobs = 0;

  for (const job of jobs) {
    if (!isQueueJobRecord(job)) {
      continue;
    }

    const lane = job.type === 'agent.run' ? byType.agentRun : byType.toolExecute;

    if (job.status === 'queued') {
      queuedJobs += 1;
      lane.queued += 1;
      continue;
    }

    if (job.status === 'running') {
      runningJobs += 1;
      lane.running += 1;
      continue;
    }

    if (job.status === 'completed') {
      completedJobs += 1;
      lane.completed += 1;
      continue;
    }

    failedJobs += 1;
    lane.failed += 1;
  }

  return {
    totalJobs: jobs.length,
    queuedJobs,
    runningJobs,
    completedJobs,
    failedJobs,
    byType
  };
}

function isQueueJobRecord(
  value: unknown
): value is { type: 'agent.run' | 'tool.execute'; status: 'queued' | 'running' | 'completed' | 'failed' } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (record.type !== 'agent.run' && record.type !== 'tool.execute') {
    return false;
  }

  return (
    record.status === 'queued' ||
    record.status === 'running' ||
    record.status === 'completed' ||
    record.status === 'failed'
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
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
  repositoryDriver: RepositoryDriver,
  settingsEncryption: import('./modules/settings/settings.encryption.js').SettingsEncryption | null = null
): {
  agentRepository: AgentRepository;
  agentRunRepository: AgentRunRepository;
  apiKeyRepository: import('./modules/auth/api-key.service.js').ApiKeyRepository;
  approvalRepository: ApprovalRepository;
  auditRepository: AuditRepository;
  budgetUsageRepository: BudgetUsageRepository;
  inboxRepository: InboxRepository;
  projectRepository: ProjectRepository;
  settingsRepository: SettingsRepository;
  taskRepository: TaskRepository;
  taskSessionRepository: import('./repositories/in-memory-task-session.repository.js').InMemoryTaskSessionRepository | import('./repositories/prisma-task-session.repository.js').PrismaTaskSessionRepository;
} {
  if (repositoryDriver === 'prisma') {
    const client = prismaClient;
    return {
      agentRepository: new PrismaAgentRepository(client),
      agentRunRepository: new PrismaAgentRunRepository(client),
      apiKeyRepository: new PrismaApiKeyRepository(client),
      approvalRepository: new PrismaApprovalRepository(client),
      auditRepository: new PrismaAuditRepository(client),
      budgetUsageRepository: new PrismaBudgetUsageRepository(client),
      inboxRepository: new PrismaInboxRepository(client),
      projectRepository: new PrismaProjectRepository(client),
      settingsRepository: new PrismaSettingsRepository(client, settingsEncryption),
      taskRepository: new PrismaTaskRepository(client),
      taskSessionRepository: new PrismaTaskSessionRepository(client)
    };
  }

  return {
    agentRepository: new InMemoryAgentRepository(),
    agentRunRepository: new InMemoryAgentRunRepository(),
    apiKeyRepository: new InMemoryApiKeyRepository(),
    approvalRepository: new InMemoryApprovalRepository(),
    auditRepository: new InMemoryAuditRepository(),
    budgetUsageRepository: new InMemoryBudgetUsageRepository(),
    inboxRepository: new InMemoryInboxRepository(),
    projectRepository: new InMemoryProjectRepository(),
    settingsRepository: new InMemorySettingsRepository(),
    taskRepository: new InMemoryTaskRepository(),
    taskSessionRepository: new InMemoryTaskSessionRepository()
  };
}
