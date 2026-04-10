import type { Logger } from 'pino';

import { AiAdapterRegistry, type AuditService } from '@familyco/core';

import { ClaudeAdapter } from './claude.adapter.js';
import type { AdapterLogger } from './hooks/logging.hook.js';
import { LoggingHook } from './hooks/logging.hook.js';
import { TokenUsageHook } from './hooks/token-usage.hook.js';
import { OpenAiAdapter } from './openai.adapter.js';

export interface AdapterRegistryDeps {
  logger: Logger | AdapterLogger;
  auditService: AuditService;
}

export function createAdapterRegistry(deps?: AdapterRegistryDeps): AiAdapterRegistry {
  const registry = new AiAdapterRegistry();
  registry.register(new OpenAiAdapter());
  registry.register(new ClaudeAdapter());

  if (deps) {
    registry.registerHook(new LoggingHook(deps.logger));
    registry.registerHook(new TokenUsageHook(deps.auditService));
  }

  return registry;
}
