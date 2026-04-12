import type { BudgetUsageService, SettingsService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { toDateString } from './budget.helpers.js';
import type {
  BudgetReport,
  BudgetReportByAdapter,
  BudgetReportByModel,
  BudgetReportByRun,
  BudgetReportDailyEntry,
  BudgetReportTimeBucketEntry,
  BudgetReportTopEntity
} from './budget.types.js';

export interface BudgetModuleDeps {
  budgetUsageService: BudgetUsageService;
  settingsService: SettingsService;
}

export function registerBudgetController(app: FastifyInstance, deps: BudgetModuleDeps): void {
  app.get('/budget/report', async (request) => {
    requireMinimumLevel(request, 'L0');

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1); // start of current month
    const to = now;

    const records = await deps.budgetUsageService.list({
      from,
      to,
      limit: 10_000
    });

    // Aggregate totals and drilldowns.
    const adapterMap = new Map<string, BudgetReportByAdapter>();
    const modelMap = new Map<string, BudgetReportByModel>();
    const runMap = new Map<string, BudgetReportByRun>();
    const weekMap = new Map<string, BudgetReportTimeBucketEntry>();
    const monthMap = new Map<string, BudgetReportTimeBucketEntry>();
    const agentMap = new Map<string, BudgetReportTopEntity>();
    const projectMap = new Map<string, BudgetReportTopEntity>();
    const dailyMap = new Map<string, BudgetReportDailyEntry>();

    let totalPrompt = 0;
    let totalCompletion = 0;
    let totalCost = 0;
    let totalRequests = 0;

    for (const record of records) {
      const adapterId = record.provider;
      const model = record.model;
      const prompt = record.promptTokens;
      const completion = record.completionTokens;
      const cost = record.estimatedCost;

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

      // Per-model aggregation
      const modelKey = `${adapterId}::${model}`;
      const existingModel = modelMap.get(modelKey);
      if (existingModel) {
        existingModel.totalTokens += prompt + completion;
        existingModel.estimatedCostUSD += cost;
        existingModel.requestCount += 1;
      } else {
        modelMap.set(modelKey, {
          model,
          provider: adapterId,
          totalTokens: prompt + completion,
          estimatedCostUSD: cost,
          requestCount: 1
        });
      }

      // Per-run aggregation
      if (record.runId) {
        const existingRun = runMap.get(record.runId);
        if (existingRun) {
          existingRun.totalTokens += prompt + completion;
          existingRun.estimatedCostUSD += cost;
          existingRun.requestCount += 1;
        } else {
          runMap.set(record.runId, {
            runId: record.runId,
            totalTokens: prompt + completion,
            estimatedCostUSD: cost,
            requestCount: 1
          });
        }
      }

      if (record.agentId) {
        upsertTopEntity(agentMap, record.agentId, prompt + completion, cost);
      }

      if (record.projectId) {
        upsertTopEntity(projectMap, record.projectId, prompt + completion, cost);
      }

      // Daily breakdown
      const dateKey = toDateString(record.recordedAt);
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

      const weekKey = toIsoWeek(record.recordedAt);
      upsertBucket(weekMap, weekKey, prompt + completion, cost);

      const monthKey = toIsoMonth(record.recordedAt);
      upsertBucket(monthMap, monthKey, prompt + completion, cost);
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
      dailyBreakdown,
      byModel: Array.from(modelMap.values()).sort((a, b) => b.estimatedCostUSD - a.estimatedCostUSD),
      byRun: Array.from(runMap.values()).sort((a, b) => b.estimatedCostUSD - a.estimatedCostUSD),
      byWeek: Array.from(weekMap.values()).sort((a, b) => a.bucket.localeCompare(b.bucket)),
      byMonth: Array.from(monthMap.values()).sort((a, b) => a.bucket.localeCompare(b.bucket)),
      topCostlyAgents: Array.from(agentMap.values()).sort((a, b) => b.estimatedCostUSD - a.estimatedCostUSD).slice(0, 5),
      topCostlyProjects: Array.from(projectMap.values()).sort((a, b) => b.estimatedCostUSD - a.estimatedCostUSD).slice(0, 5)
    };

    return report;
  });
}

function upsertTopEntity(
  map: Map<string, BudgetReportTopEntity>,
  entityId: string,
  tokens: number,
  cost: number
): void {
  const existing = map.get(entityId);
  if (existing) {
    existing.totalTokens += tokens;
    existing.estimatedCostUSD += cost;
    existing.requestCount += 1;
    return;
  }

  map.set(entityId, {
    entityId,
    totalTokens: tokens,
    estimatedCostUSD: cost,
    requestCount: 1
  });
}

function upsertBucket(
  map: Map<string, BudgetReportTimeBucketEntry>,
  bucket: string,
  tokens: number,
  cost: number
): void {
  const existing = map.get(bucket);
  if (existing) {
    existing.totalTokens += tokens;
    existing.estimatedCostUSD += cost;
    existing.requestCount += 1;
    return;
  }

  map.set(bucket, {
    bucket,
    totalTokens: tokens,
    estimatedCostUSD: cost,
    requestCount: 1
  });
}

function toIsoMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function toIsoWeek(date: Date): string {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
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
