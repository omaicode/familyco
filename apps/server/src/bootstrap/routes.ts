import type { FastifyInstance } from 'fastify';

import type {
  AgentRunService,
  AgentService,
  ApprovalGuard,
  ApprovalService,
  AuditService,
  BudgetUsageService,
  CronService,
  EventBus,
  InboxService,
  ProjectService,
  SettingsService,
  TaskService
} from '@familyco/core';

import { registerAgentController, type AgentModuleDeps } from '../modules/agent/index.js';
import { registerApprovalController } from '../modules/approval/index.js';
import { registerAuditController } from '../modules/audit/index.js';
import { registerAuthController } from '../modules/auth/index.js';
import type { ApiKeyService } from '../modules/auth/api-key.service.js';
import { authenticateApiRequest } from '../plugins/auth.plugin.js';
import { registerBudgetController } from '../modules/budget/index.js';
import { registerCronController } from '../modules/cron/index.js';
import { registerDashboardController } from '../modules/dashboard/index.js';
import { registerEngineController } from '../modules/engine/index.js';
import { registerInboxController } from '../modules/inbox/index.js';
import { registerPluginsController } from '../modules/plugins/plugin.controller.js';
import type { PluginLoaderService } from '../modules/plugins/plugin-loader.service.js';
import { registerProjectController } from '../modules/project/index.js';
import type { AiAdapterRegistry } from '@familyco/core';
import { registerProviderController } from '../modules/provider/index.js';
import { registerSettingsController } from '../modules/settings/index.js';
import { registerSetupController } from '../modules/setup/index.js';
import { registerSkillsController } from '../modules/skills/index.js';
import type { SkillsService } from '../modules/skills/skills.service.js';
import { type DailyQuotaGuard } from '../modules/shared/daily-quota.guard.js';
import { registerTaskController } from '../modules/task/index.js';
import {
  type ToolManagementService,
  registerToolManagementController
} from '../modules/tools/index.js';
import { registerEventGateway } from '../ws/ws-gateway.js';
import type { InMemoryQueueService } from '../queue/index.js';
import type { HeartbeatRuntimeService } from '../runtime/heartbeat-runtime.service.js';
import type { PluginService } from '@familyco/core';
import type { TaskSessionRepository } from './repositories.js';

export interface RegisterApiRoutesDeps {
  app: FastifyInstance;
  readOnlyMode: () => boolean;
  apiKeyService: ApiKeyService;
  agentModuleDeps: AgentModuleDeps;
  approvalService: ApprovalService;
  agentService: AgentService;
  projectService: ProjectService;
  settingsService: SettingsService;
  taskService: TaskService;
  auditService: AuditService;
  inboxService: InboxService;
  taskSessionRepository: TaskSessionRepository;
  budgetUsageService: BudgetUsageService;
  cronService: CronService;
  queueService: InMemoryQueueService;
  approvalGuard: ApprovalGuard;
  dailyQuotaGuard: DailyQuotaGuard;
  agentRunService: AgentRunService;
  heartbeatRuntime: HeartbeatRuntimeService;
  skillsService: SkillsService;
  toolsService: ToolManagementService;
  pluginService: PluginService;
  pluginLoader: PluginLoaderService;
  adapterRegistry: AiAdapterRegistry;
  eventBus: EventBus;
  runtimeMode: 'server' | 'desktop';
  onPluginsRefreshed: () => Promise<void>;
}

export function registerApiRoutes(deps: RegisterApiRoutesDeps): void {
  deps.app.register(
    async (api) => {
      registerAuthController(api, {
        apiKeyService: deps.apiKeyService,
        agentService: deps.agentService,
        auditService: deps.auditService,
        signToken: (payload) => api.jwt.sign(payload)
      });

      api.addHook('preHandler', async (request, reply) => {
        if (deps.readOnlyMode() && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
          reply.code(503).send({
            statusCode: 503,
            code: 'READ_ONLY_MODE',
            message: 'Application is in read-only mode because database migration failed'
          });
          return;
        }

        await authenticateApiRequest(request, reply, deps.apiKeyService);
      });

      registerAgentController(api, deps.agentModuleDeps);
      registerApprovalController(api, {
        approvalService: deps.approvalService,
        agentService: deps.agentService,
        projectService: deps.projectService,
        settingsService: deps.settingsService,
        taskService: deps.taskService,
        auditService: deps.auditService,
        inboxService: deps.inboxService,
        sessionStore: deps.taskSessionRepository
      });
      registerAuditController(api, { auditService: deps.auditService });
      registerBudgetController(api, { budgetUsageService: deps.budgetUsageService, settingsService: deps.settingsService });
      registerDashboardController(api, {
        agentService: deps.agentService,
        approvalService: deps.approvalService,
        auditService: deps.auditService,
        projectService: deps.projectService,
        taskService: deps.taskService
      });
      registerCronController(api, {
        cronService: deps.cronService,
        auditService: deps.auditService,
        settingsService: deps.settingsService,
        agentService: deps.agentService
      });
      registerEngineController(api, {
        queueService: deps.queueService,
        auditService: deps.auditService,
        approvalService: deps.approvalService,
        approvalGuard: deps.approvalGuard,
        settingsService: deps.settingsService,
        dailyQuotaGuard: deps.dailyQuotaGuard,
        agentRunService: deps.agentRunService,
        heartbeatRuntime: deps.heartbeatRuntime
      });
      registerInboxController(api, { inboxService: deps.inboxService, auditService: deps.auditService });
      registerProjectController(api, {
        projectService: deps.projectService,
        taskService: deps.taskService,
        approvalService: deps.approvalService,
        auditService: deps.auditService,
        approvalGuard: deps.approvalGuard,
        settingsService: deps.settingsService
      });
      registerSettingsController(api, {
        settingsService: deps.settingsService,
        auditService: deps.auditService
      });
      registerSkillsController(api, {
        skillsService: deps.skillsService,
        auditService: deps.auditService
      });
      registerToolManagementController(api, {
        toolsService: deps.toolsService,
        auditService: deps.auditService
      });
      registerPluginsController(api, {
        pluginService: deps.pluginService,
        pluginLoader: deps.pluginLoader,
        auditService: deps.auditService,
        onPluginsRefreshed: deps.onPluginsRefreshed
      });
      registerSetupController(api, {
        agentService: deps.agentService,
        projectService: deps.projectService,
        settingsService: deps.settingsService,
        auditService: deps.auditService
      });
      registerProviderController(api, {
        adapterRegistry: deps.adapterRegistry,
        settingsService: deps.settingsService,
        auditService: deps.auditService,
        runtimeMode: deps.runtimeMode
      });
      registerTaskController(api, {
        taskService: deps.taskService,
        agentService: deps.agentService,
        projectService: deps.projectService,
        settingsService: deps.settingsService,
        approvalService: deps.approvalService,
        auditService: deps.auditService,
        approvalGuard: deps.approvalGuard,
        queueService: deps.queueService,
        eventBus: deps.eventBus
      });
      registerEventGateway(api, { eventBus: deps.eventBus });
    },
    { prefix: '/api/v1' }
  );
}
