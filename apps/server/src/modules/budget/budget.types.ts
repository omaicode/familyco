export interface BudgetReportTotals {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
  requestCount: number;
}

export interface BudgetReportByAdapter {
  adapterId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
  requestCount: number;
}

export interface BudgetReportDailyEntry {
  date: string;
  totalTokens: number;
  estimatedCostUSD: number;
  requestCount: number;
}

export interface BudgetReportBudgetStatus {
  monthlyLimitUSD: number | null;
  alertThresholdPercent: number;
  enforceMode: 'block' | 'warn' | 'off';
  usedPercent: number | null;
}

export interface BudgetReport {
  period: { from: string; to: string };
  totals: BudgetReportTotals;
  budget: BudgetReportBudgetStatus;
  byAdapter: BudgetReportByAdapter[];
  dailyBreakdown: BudgetReportDailyEntry[];
}
