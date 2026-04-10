import type { AuditService, SettingsService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { estimateCostUSD, toDateString } from './budget.helpers.js';
import type {
  BudgetReport,
  BudgetReportByAdapter,
  BudgetReportDailyEntry
} from './budget.types.js';

export interface BudgetModuleDeps {
  auditService: AuditService;
  settingsService: SettingsService;
}

export function registerBudgetController(app: FastifyInstance, deps: BudgetModuleDeps): void {
  app.get('/budget/report', async (request) => {
    requireMinimumLevel(request, 'L0');

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1); // start of current month
    const to = now;

    // Fetch adapter.chat.completed audit records for the period
    const records = await deps.auditService.list({
      action: 'adapter.chat.completed',
      from,
      to,
      limit: 10_000
    });

    // Aggregate totals and per-adapter stats
    const adapterMap = new Map<string, BudgetReportByAdapter>();
    const dailyMap = new Map<string, BudgetReportDailyEntry>();

    let totalPrompt = 0;
    let totalCompletion = 0;
    let totalCost = 0;
    let totalRequests = 0;

    for (const record of records) {
      const payload = record.payload ?? {};
      const adapterId = typeof payload.adapterId === 'string' ? payload.adapterId : 'unknown';
      const model = typeof payload.model === 'string' ? payload.model : '';
      const tokenUsage = payload.tokenUsage as { prompt?: number; completion?: number; total?: number } | undefined;

      const prompt = tokenUsage?.prompt ?? 0;
      const completion = tokenUsage?.completion ?? 0;
      const cost = estimateCostUSD(model, prompt, completion);

      totalPrompt += prompt;
      totalCompletion += completion;
      totalCost += cost;
      totalRequests += 1;

      // Per-adapter aggregation
      const existing = adapterMap.get(adapterId);
      if (existing) {
        existing.promptTokens += prompt;
        existing.completionTokens += completion;
        existing.totalTokens += prompt + completion;
        existing.estimatedCostUSD += cost;
        existing.requestCount += 1;
      } else {
        adapterMap.set(adapterId, {
          adapterId,
          promptTokens: prompt,
          completionTokens: completion,
          totalTokens: prompt + completion,
          estimatedCostUSD: cost,
          requestCount: 1
        });
      }

      // Daily breakdown
      const dateKey = toDateString(record.createdAt);
      const existingDay = dailyMap.get(dateKey);
      if (existingDay) {
        existingDay.totalTokens += prompt + completion;
        existingDay.estimatedCostUSD += cost;
        existingDay.requestCount += 1;
      } else {
        dailyMap.set(dateKey, {
          date: dateKey,
          totalTokens: prompt + completion,
          estimatedCostUSD: cost,
          requestCount: 1
        });
      }
    }

    // Fill missing days in the last 30 days
    const dailyBreakdown = buildDailyBreakdown(from, to, dailyMap);

    // Read budget settings
    const [limitSetting, modeSetting, thresholdSetting] = await Promise.all([
      deps.settingsService.get('budget.monthlyLimitUSD'),
      deps.settingsService.get('budget.enforceMode'),
      deps.settingsService.get('budget.alertThresholdPercent')
    ]);

    const monthlyLimitUSD = limitSetting?.value
      ? Number(limitSetting.value)
      : null;
    const enforceMode = modeSetting?.value === 'block'
      ? 'block'
      : modeSetting?.value === 'off'
        ? 'off'
        : 'warn';
    const alertThresholdPercent = thresholdSetting?.value
      ? Number(thresholdSetting.value)
      : 80;
    const usedPercent = monthlyLimitUSD && monthlyLimitUSD > 0
      ? Math.round((totalCost / monthlyLimitUSD) * 100 * 10) / 10
      : null;

    const report: BudgetReport = {
      period: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        promptTokens: totalPrompt,
        completionTokens: totalCompletion,
        totalTokens: totalPrompt + totalCompletion,
        estimatedCostUSD: Math.round(totalCost * 1_000_000) / 1_000_000,
        requestCount: totalRequests
      },
      budget: {
        monthlyLimitUSD,
        alertThresholdPercent,
        enforceMode: enforceMode as 'block' | 'warn' | 'off',
        usedPercent
      },
      byAdapter: Array.from(adapterMap.values()).sort(
        (a, b) => b.estimatedCostUSD - a.estimatedCostUSD
      ),
      dailyBreakdown
    };

    return report;
  });
}

function buildDailyBreakdown(
  from: Date,
  to: Date,
  dailyMap: Map<string, BudgetReportDailyEntry>
): BudgetReportDailyEntry[] {
  const result: BudgetReportDailyEntry[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= to) {
    const dateKey = toDateString(cursor);
    result.push(
      dailyMap.get(dateKey) ?? { date: dateKey, totalTokens: 0, estimatedCostUSD: 0, requestCount: 0 }
    );
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}
