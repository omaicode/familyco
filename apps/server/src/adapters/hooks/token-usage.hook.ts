import type {
  AdapterHook,
  AfterChatHookContext,
  AuditService,
  BudgetUsageService
} from '@familyco/core';

import { estimateCostUSD } from '../../modules/budget/budget.helpers.js';

export class TokenUsageHook implements AdapterHook {
  readonly id = 'token-usage';

  constructor(
    private readonly auditService: AuditService,
    private readonly budgetUsageService: BudgetUsageService
  ) {}

  async afterChat(ctx: AfterChatHookContext): Promise<void> {
    if (!ctx.result.tokenUsage) return;

    const prompt = ctx.result.tokenUsage.prompt ?? 0;
    const completion = ctx.result.tokenUsage.completion ?? 0;
    const total = ctx.result.tokenUsage.total ?? prompt + completion;
    const estimatedCost = estimateCostUSD(ctx.model, prompt, completion);

    await this.budgetUsageService.record({
      provider: ctx.adapterId,
      model: ctx.model,
      promptTokens: prompt,
      completionTokens: completion,
      totalTokens: total,
      estimatedCost,
      currency: 'USD'
    });

    await this.auditService.write({
      actorId: 'system',
      action: 'adapter.chat.completed',
      payload: {
        adapterId: ctx.adapterId,
        model: ctx.model,
        durationMs: ctx.durationMs,
        tokenUsage: {
          prompt,
          completion,
          total
        },
        estimatedCostUSD: estimatedCost
      }
    });
  }
}
