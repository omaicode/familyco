export interface BudgetUsage {
  id: string;
  companyId?: string;
  runId: string | null;
  agentId: string | null;
  projectId: string | null;
  taskId: string | null;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  currency: string;
  recordedAt: Date;
}

export interface CreateBudgetUsageInput {
  companyId?: string;
  runId?: string | null;
  agentId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  estimatedCost: number;
  currency?: string;
}
