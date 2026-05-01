import type { FastifyInstance } from 'fastify';

import { runMigrationsWithSafety, type MigrationRunResult } from '@familyco/db';
import type { ApiKeyService } from '../modules/auth/api-key.service.js';
import type { AuditService } from '@familyco/core';
import type { PluginLoaderService } from '../modules/plugins/plugin-loader.service.js';
import type { ToolManagementService } from '../modules/tools/index.js';
import type { HeartbeatRuntimeService } from '../runtime/heartbeat-runtime.service.js';
import type { CronRuntimeService } from '../runtime/cron-runtime.service.js';
import type { InMemoryQueueService } from '../queue/index.js';
import type { RepositoryDriver } from './repositories.js';

export interface AppLifecycleState {
  migrationState: MigrationRunResult | null;
  readOnlyMode: boolean;
}

export interface RegisterLifecycleHooksDeps {
  app: FastifyInstance;
  state: AppLifecycleState;
  repositoryDriver: RepositoryDriver;
  apiKeyService: ApiKeyService;
  authApiKey: string;
  auditService: AuditService;
  enableHeartbeatScheduler: boolean;
  canProcessAsyncJobs: boolean;
  heartbeatRuntime: HeartbeatRuntimeService;
  cronRuntime: CronRuntimeService;
  pluginLoader: PluginLoaderService;
  toolsService: ToolManagementService;
  queueService: InMemoryQueueService;
}

export function registerLifecycleHooks(deps: RegisterLifecycleHooksDeps): void {
  const {
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
  } = deps;

  app.addHook('onReady', async () => {
    if (repositoryDriver === 'prisma') {
      state.migrationState = await runMigrationsWithSafety();
      state.readOnlyMode = state.migrationState.readOnlyMode;

      await auditService.write({
        actorId: 'system',
        action: state.migrationState.status === 'ok' ? 'db.migration.completed' : 'db.migration.failed',
        payload: {
          status: state.migrationState.status,
          pendingCount: state.migrationState.pendingCount,
          appliedCount: state.migrationState.appliedCount,
          backupPath: state.migrationState.backupPath,
          dbPath: state.migrationState.dbPath,
          errorMessage: state.migrationState.errorMessage
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
    if (canProcessAsyncJobs) {
      await cronRuntime.start();
    }

    // Discover plugins from filesystem (non-blocking — errors logged, not thrown)
    try {
      await pluginLoader.discover();
    } catch (error) {
      app.log.error({ err: error }, 'Plugin discovery failed during startup');
    }

    await toolsService.syncExecutorPolicy();
  });

  app.addHook('onClose', async () => {
    await cronRuntime.stop();
    await heartbeatRuntime.stop();
    await queueService.close();
  });
}
