import type { Logger } from 'pino';

import {
  AiAdapterRegistry,
  type AuditService,
  type BudgetUsageService,
  type SettingsService
} from '@familyco/core';

import { ClaudeAdapter } from './claude.adapter.js';
import { DeepSeekAdapter } from './deepseek.adapter.js';
import type { AdapterLogger } from './hooks/logging.hook.js';
import { LoggingHook } from './hooks/logging.hook.js';
import { TokenUsageHook } from './hooks/token-usage.hook.js';
import { OpenAiAdapter } from './openai.adapter.js';
import { OpenRouterAdapter } from './openrouter.adapter.js';
import { VercelAdapter } from './vercel.adapter.js';

export interface AdapterRegistryDeps {
  logger: Logger | AdapterLogger;
  auditService: AuditService;
  budgetUsageService: BudgetUsageService;
  settingsService: SettingsService;
  onBudgetNearLimit?: (input: {
    usedPercent: number;
    monthlyLimitUSD: number;
    alertThresholdPercent: number;
    totalCostUSD: number;
  }) => Promise<void>;
}

export function createAdapterRegistry(deps?: AdapterRegistryDeps): AiAdapterRegistry {
  const registry = new AiAdapterRegistry();
  registry.register(new OpenAiAdapter());
  registry.register(new OpenRouterAdapter());
  registry.register(new ClaudeAdapter());
  registry.register(new VercelAdapter());
  registry.register(new DeepSeekAdapter());

  if (deps) {
    registry.registerHook(new LoggingHook(deps.logger));
    registry.registerHook(
      new TokenUsageHook(
        deps.auditService,
        deps.budgetUsageService,
        deps.settingsService,
        deps.onBudgetNearLimit
      )
    );
  }

  return registry;
}
