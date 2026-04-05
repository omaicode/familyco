import type { FamilyCoApiContracts, SettingItem, UpsertSettingPayload } from '../api/contracts.js';
import { createAsyncState, type AsyncState } from './async-state.js';

export class SettingsStore {
  state: AsyncState<SettingItem[]>;

  constructor(private readonly api: FamilyCoApiContracts) {
    this.state = createAsyncState<SettingItem[]>([]);
  }

  async load(): Promise<void> {
    this.state.isLoading = true;
    this.state.errorMessage = null;

    try {
      const settings = await this.api.listSettings();
      this.state.data = settings;
      this.state.isEmpty = settings.length === 0;
    } catch (error) {
      this.state.errorMessage = error instanceof Error ? error.message : 'Failed to load settings';
    } finally {
      this.state.isLoading = false;
    }
  }

  async upsert(payload: UpsertSettingPayload): Promise<SettingItem> {
    const updated = await this.api.upsertSetting(payload);
    const exists = this.state.data.some((item) => item.key === updated.key);

    if (exists) {
      this.state.data = this.state.data.map((item) => (item.key === updated.key ? updated : item));
    } else {
      this.state.data = [updated, ...this.state.data];
      this.state.isEmpty = false;
    }

    return updated;
  }
}

export const createSettingsStore = (api: FamilyCoApiContracts): SettingsStore =>
  new SettingsStore(api);
