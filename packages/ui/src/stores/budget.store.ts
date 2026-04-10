import type { BudgetReport } from '../api/contracts.js';
import type { FamilyCoApiContracts } from '../api/contracts.js';
import { createAsyncState, type AsyncState } from './async-state.js';

export class BudgetStore {
  state: AsyncState<BudgetReport | null>;

  constructor(private readonly api: FamilyCoApiContracts) {
    this.state = createAsyncState<BudgetReport | null>(null);
  }

  async load(): Promise<void> {
    this.state.isLoading = true;
    this.state.errorMessage = null;
    try {
      const report = await this.api.getBudgetReport();
      this.state.data = report;
      this.state.isEmpty = report.totals.requestCount === 0;
    } catch (err) {
      this.state.errorMessage = err instanceof Error ? err.message : 'Failed to load budget report';
    } finally {
      this.state.isLoading = false;
    }
  }
}

export function createBudgetStore(api: FamilyCoApiContracts): BudgetStore {
  return new BudgetStore(api);
}
