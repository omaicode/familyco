import type { BudgetUsage, CreateBudgetUsageInput } from './budget.entity.js';

export interface BudgetUsageListQuery {
  from?: Date;
  to?: Date;
  provider?: string;
  model?: string;
  runId?: string;
  agentId?: string;
  projectId?: string;
  taskId?: string;
  limit?: number;
  offset?: number;
}

export interface BudgetUsageRepository {
  create(input: CreateBudgetUsageInput): Promise<BudgetUsage>;
  list(query?: BudgetUsageListQuery): Promise<BudgetUsage[]>;
}

export class BudgetUsageService {
  constructor(private readonly repository: BudgetUsageRepository) {}

  record(input: CreateBudgetUsageInput): Promise<BudgetUsage> {
    const totalTokens = input.totalTokens ?? input.promptTokens + input.completionTokens;

    return this.repository.create({
      ...input,
      totalTokens,
      currency: input.currency ?? 'USD'
    });
  }

  list(query?: BudgetUsageListQuery): Promise<BudgetUsage[]> {
    return this.repository.list(query);
  }
}
