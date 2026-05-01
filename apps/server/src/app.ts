import Fastify, { type FastifyInstance } from 'fastify';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  CronService,
  EventBus,
  InboxService,
  PluginRegistry,
  PluginRunService,
  PluginService,
  ProjectService,
  SettingsService,
  TaskService
} from '@familyco/core';

import { createAdapterRegistry } from './adapters/index.js';
import {
  createCorsOriginMatcher,
  normalizePositiveInteger,
  resolveDefaultQueueConcurrency
} from './bootstrap/helpers.js';
import { registerHttpInfrastructure } from './bootstrap/http.js';
import { registerLifecycleHooks, type AppLifecycleState } from './bootstrap/lifecycle.js';
import { registerQueueHandlers } from './bootstrap/queue-handlers.js';
import { createRepositories, type RepositoryDriver } from './bootstrap/repositories.js';
import { registerApiRoutes } from './bootstrap/routes.js';
import {
  ChatAttachmentStore,
  ChatConversationService,
  ChatStreamRegistry,
  processAgentChat,
  type AgentModuleDeps
} from './modules/agent/index.js';
import { ChatEngineService } from './modules/agent/chat-engine.service.js';
import { ApiKeyService } from './modules/auth/api-key.service.js';
import { NotificationService } from './modules/notification/index.js';
import { PluginLoaderService } from './modules/plugins/plugin-loader.service.js';
import { KnowledgeContextService, KnowledgeService } from './modules/knowledge/index.js';
import { createSettingsEncryption } from './modules/settings/settings.encryption.js';
import { DailyQuotaGuard } from './modules/shared/daily-quota.guard.js';
import { SkillsService } from './modules/skills/skills.service.js';
import {
  DefaultToolExecutor,
  HEARTBEAT_ALLOWED_TOOL_NAMES,
  ToolManagementService,
  filterToolDefinitionsByNames
} from './modules/tools/index.js';
import {
  getAuthApiKey,
  getAuthApiKeySalt,
  registerAuthPlugin
} from './plugins/auth.plugin.js';
import { InMemoryQueueService } from './queue/index.js';
import { CronRuntimeService } from './runtime/cron-runtime.service.js';
import { HeartbeatRuntimeService } from './runtime/heartbeat-runtime.service.js';
import { SettingsBackedMemoryService } from './runtime/settings-memory.service.js';
import { TaskExecutionCoordinator } from './runtime/task-execution.coordinator.js';

globalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url));

export type { RepositoryDriver };
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
  pluginsRootDir?: string;
  skillsRootDir?: string;
  adapterRegistry?: ReturnType<typeof createAdapterRegistry>;
  runtimeMode?: 'server' | 'desktop';
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
    chatConversationRepository,
    cronRepository,
    inboxRepository,
    pluginRepository,
    pluginRunRepository,
    projectRepository,
    settingsRepository,
    taskRepository,
    knowledgeRepository,
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
  const chatConversationService = new ChatConversationService(chatConversationRepository);
  const inboxService = new InboxService(inboxRepository);
  const projectService = new ProjectService(projectRepository);
  const agentRunService = new AgentRunService(agentRunRepository);
  const settingsService = new SettingsService(settingsRepository);
  const taskService = new TaskService(taskRepository, eventBus);
  const knowledgeService = new KnowledgeService(knowledgeRepository, settingsService);
  const knowledgeContextService = new KnowledgeContextService(knowledgeService);

  const notificationService = new NotificationService({
    eventBus,
    inboxService,
    settingsService,
    taskService
  });
  notificationService.register();

  const approvalGuard = new ApprovalGuard();
  const dailyQuotaGuard = new DailyQuotaGuard({ maxPerDay: dailyQuotaLimit });
  const pluginRegistry = new PluginRegistry();
  const pluginService = new PluginService(pluginRepository);
  const pluginRunService = new PluginRunService(pluginRunRepository);
  const skillsService = new SkillsService(
    settingsService,
    pluginRegistry,
    options.skillsRootDir ?? process.env.FAMILYCO_SKILLS_DIR ?? path.resolve(__dirname, '../../../', 'skills')
  );

  const adapterRegistry = options.adapterRegistry ?? createAdapterRegistry({
    logger: app.log,
    auditService,
    budgetUsageService,
    settingsService,
    knowledgeContextService,
    onBudgetNearLimit: async (input) => {
      await notificationService.notifyBudgetNearLimit(input);
    }
  });

  const cronService = new CronService(cronRepository);
  const toolExecutor = new DefaultToolExecutor({
    agentService,
    projectService,
    settingsService,
    skillsService,
    taskService,
    adapterRegistry,
    auditService,
    inboxService,
    approvalService,
    cronService,
    eventBus
    // queueService wired in after construction to avoid circular dependency
  });

  const toolsService = new ToolManagementService(settingsService, toolExecutor);
  const pluginLoader = new PluginLoaderService({
    pluginService,
    pluginRegistry,
    pluginRepository,
    auditService,
    pluginsRootDir:
      options.pluginsRootDir ?? process.env.FAMILYCO_PLUGINS_DIR ?? path.resolve(__dirname, '../../../', 'plugins'),
    toolExecutor,
    pluginRunService,
    adapterRegistry
  });

  const memoryService = new SettingsBackedMemoryService(settingsRepository);
  const agentRunner = new AgentRunner(approvalGuard, toolExecutor, memoryService);
  const chatEngineService = new ChatEngineService(settingsService, adapterRegistry, skillsService);
  const chatStreamRegistry = new ChatStreamRegistry();
  const chatAttachmentStore = new ChatAttachmentStore(settingsService);

  const taskCoordinator = new TaskExecutionCoordinator({
    chatEngineService,
    toolExecutor,
    taskService,
    projectService,
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

  const heartbeatToolDefinitions = filterToolDefinitionsByNames(
    toolExecutor.listToolDefinitions(),
    HEARTBEAT_ALLOWED_TOOL_NAMES
  );

  const heartbeatRuntime = new HeartbeatRuntimeService({
    queueService,
    agentService,
    settingsService,
    auditService,
    taskService,
    pollMs: options.heartbeatPollMs,
    defaultHeartbeatMinutes: options.defaultHeartbeatMinutes,
    tools: heartbeatToolDefinitions
  });

  const agentModuleDeps: AgentModuleDeps = {
    agentService,
    inboxService,
    chatConversationService,
    approvalService,
    auditService,
    approvalGuard,
    agentRunner,
    chatEngineService,
    toolExecutor,
    listTools: () => toolExecutor.listToolDefinitions(),
    chatStreamRegistry,
    chatAttachmentStore,
    settingsService,
    notificationService
  };

  const cronRuntime = new CronRuntimeService({
    cronService,
    executeJob: async (job, scheduledAt) => {
      const existingSession = job.sessionId
        ? await chatConversationService.getSessionById(job.sessionId)
        : null;
      const session = existingSession ?? await chatConversationService.createSession({
        agentId: job.agentId,
        founderId: 'founder',
        title: `Cron: ${job.name}`
      });

      const result = await processAgentChat({
        agentId: job.agentId,
        body: {
          message: job.prompt,
          meta: {
            sessionId: session.id,
            trigger: 'cron',
            cronId: job.id,
            scheduledAt: scheduledAt.toISOString()
          }
        },
        deps: agentModuleDeps,
        actorId: 'system'
      });

      return {
        sessionId: session.id,
        output: {
          reply: result.reply,
          replyMessageId: result.replyMessage.id,
          founderMessageId: result.founderMessage.id,
          toolCalls: result.toolCalls
        }
      };
    }
  });

  const canProcessAsyncJobs = true;
  const state: AppLifecycleState = {
    migrationState: null,
    readOnlyMode: false
  };

  registerQueueHandlers({
    queueService,
    agentService,
    chatEngineService,
    toolExecutor,
    agentRunner,
    agentRunService,
    taskCoordinator,
    heartbeatRuntime,
    auditService
  });

  registerLifecycleHooks({
    app,
    state,
    repositoryDriver,
    apiKeyService,
    authApiKey,
    auditService,
    enableHeartbeatScheduler,
    canProcessAsyncJobs,
    heartbeatRuntime,
    cronRuntime,
    pluginLoader,
    toolsService,
    queueService
  });

  registerHttpInfrastructure({
    app,
    queueService,
    queueDriver,
    agentRunConcurrency,
    toolExecuteConcurrency,
    state
  });

  registerApiRoutes({
    app,
    readOnlyMode: () => state.readOnlyMode,
    apiKeyService,
    agentModuleDeps,
    approvalService,
    agentService,
    projectService,
    settingsService,
    taskService,
    auditService,
    inboxService,
    taskSessionRepository,
    budgetUsageService,
    cronService,
    queueService,
    approvalGuard,
    dailyQuotaGuard,
    agentRunService,
    heartbeatRuntime,
    skillsService,
    knowledgeService,
    toolsService,
    pluginService,
    pluginLoader,
    adapterRegistry,
    eventBus,
    runtimeMode: options.runtimeMode ?? 'server',
    onPluginsRefreshed: async () => {
      await toolsService.syncExecutorPolicy();
    }
  });

  return app;
}
