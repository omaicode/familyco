import type { PrismaClient } from '@familyco/db';
import type {
  BudgetUsage,
  BudgetUsageListQuery,
  BudgetUsageRepository,
  CreateBudgetUsageInput
} from '@familyco/core';

export class PrismaBudgetUsageRepository implements BudgetUsageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateBudgetUsageInput): Promise<BudgetUsage> {
    const record = await this.prisma.budgetUsage.create({
      data: {
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
        currency: input.currency ?? 'USD'
      }
    });

    return {
      id: record.id,
      companyId: record.companyId ?? undefined,
      runId: record.runId,
      agentId: record.agentId,
      projectId: record.projectId,
      taskId: record.taskId,
      provider: record.provider,
      model: record.model,
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
      totalTokens: record.totalTokens,
      estimatedCost: record.estimatedCost,
      currency: record.currency,
      recordedAt: record.recordedAt
    };
  }

  async list(query: BudgetUsageListQuery = {}): Promise<BudgetUsage[]> {
    const rows = await this.prisma.budgetUsage.findMany({
      where: {
        provider: query.provider,
        model: query.model,
        runId: query.runId,
        agentId: query.agentId,
        projectId: query.projectId,
        taskId: query.taskId,
        recordedAt: {
          gte: query.from,
          lte: query.to
        }
      },
      orderBy: { recordedAt: 'desc' },
      skip: query.offset,
      take: query.limit
    });

    return rows.map((record) => ({
      id: record.id,
      companyId: record.companyId ?? undefined,
      runId: record.runId,
      agentId: record.agentId,
      projectId: record.projectId,
      taskId: record.taskId,
      provider: record.provider,
      model: record.model,
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
      totalTokens: record.totalTokens,
      estimatedCost: record.estimatedCost,
      currency: record.currency,
      recordedAt: record.recordedAt
    }));
  }
}
