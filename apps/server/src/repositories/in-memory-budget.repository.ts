import { randomUUID } from 'node:crypto';

import type {
  BudgetUsage,
  BudgetUsageListQuery,
  BudgetUsageRepository,
  CreateBudgetUsageInput
} from '@familyco/core';

export class InMemoryBudgetUsageRepository implements BudgetUsageRepository {
  private readonly records: BudgetUsage[] = [];

  async create(input: CreateBudgetUsageInput): Promise<BudgetUsage> {
    const record: BudgetUsage = {
      id: randomUUID(),
      companyId: input.companyId,
      runId: input.runId ?? null,
      agentId: input.agentId ?? null,
      projectId: input.projectId ?? null,
      taskId: input.taskId ?? null,
      provider: input.provider,
      model: input.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens ?? input.promptTokens + input.completionTokens,
      estimatedCost: input.estimatedCost,
      currency: input.currency ?? 'USD',
      recordedAt: new Date()
    };

    this.records.push(record);
    return record;
  }

  async list(query: BudgetUsageListQuery = {}): Promise<BudgetUsage[]> {
    const filtered = this.records.filter((record) => {
      if (query.provider && record.provider !== query.provider) return false;
      if (query.model && record.model !== query.model) return false;
      if (query.runId && record.runId !== query.runId) return false;
      if (query.agentId && record.agentId !== query.agentId) return false;
      if (query.projectId && record.projectId !== query.projectId) return false;
      if (query.taskId && record.taskId !== query.taskId) return false;
      if (query.from && record.recordedAt < query.from) return false;
      if (query.to && record.recordedAt > query.to) return false;
      return true;
    });

    const sorted = filtered.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
    const offset = query.offset ?? 0;
    const limit = query.limit ?? sorted.length;

    return sorted.slice(offset, offset + limit);
  }
}
