import type {
  AdapterHook,
  AfterChatHookContext,
  AuditService,
  BudgetUsageService,
  SettingsService
} from '@familyco/core';

import { estimateCostUSD } from '../../modules/budget/budget.helpers.js';

export class TokenUsageHook implements AdapterHook {
  readonly id = 'token-usage';

  constructor(
    private readonly auditService: AuditService,
    private readonly budgetUsageService: BudgetUsageService,
    private readonly settingsService: SettingsService,
    private readonly onBudgetNearLimit?: (input: {
      usedPercent: number;
      monthlyLimitUSD: number;
      alertThresholdPercent: number;
      totalCostUSD: number;
    }) => Promise<void>
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

    await this.evaluateBudgetNearLimit();
  }

  private async evaluateBudgetNearLimit(): Promise<void> {
    if (!this.onBudgetNearLimit) {
      return;
    }

    const [limitSetting, thresholdSetting] = await Promise.all([
      this.settingsService.get('budget.monthlyLimitUSD'),
      this.settingsService.get('budget.alertThresholdPercent')
    ]);

    const monthlyLimitUSD = Number(limitSetting?.value ?? 0);
    if (!Number.isFinite(monthlyLimitUSD) || monthlyLimitUSD <= 0) {
      return;
    }

    const alertThresholdPercent = Number(thresholdSetting?.value ?? 80);
    const normalizedThreshold = Number.isFinite(alertThresholdPercent) && alertThresholdPercent > 0
      ? alertThresholdPercent
      : 80;

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const records = await this.budgetUsageService.list({
      from,
      to: now,
      limit: 10_000
    });

    const totalCostUSD = records.reduce((sum, record) => sum + record.estimatedCost, 0);
    const usedPercent = (totalCostUSD / monthlyLimitUSD) * 100;

    if (usedPercent < normalizedThreshold) {
      return;
    }

    await this.onBudgetNearLimit({
      usedPercent,
      monthlyLimitUSD,
      alertThresholdPercent: normalizedThreshold,
      totalCostUSD
    });
  }
}
