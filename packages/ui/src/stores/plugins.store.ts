import type {
  FamilyCoApiContracts,
  PluginApprovalMode,
  PluginDiscoverResult,
  PluginListItem,
  PluginsListResponse
} from '../api/contracts.js';
import { createAsyncState, type AsyncState } from './async-state.js';

const EMPTY_PLUGINS_RESPONSE: PluginsListResponse = {
  items: []
};

export class PluginsStore {
  state: AsyncState<PluginsListResponse>;

  constructor(private readonly api: FamilyCoApiContracts) {
    this.state = createAsyncState<PluginsListResponse>(EMPTY_PLUGINS_RESPONSE);
  }

  async load(): Promise<void> {
    this.state.isLoading = true;
    this.state.errorMessage = null;

    try {
      const response = await this.api.listPlugins();
      this.state.data = response;
      this.state.isEmpty = response.items.length === 0;
    } catch (error) {
      this.state.errorMessage = error instanceof Error ? error.message : 'Failed to load plugins';
    } finally {
      this.state.isLoading = false;
    }
  }

  async discover(): Promise<PluginDiscoverResult> {
    const result = await this.api.discoverPlugins();
    await this.load();
    return result;
  }

  async enable(pluginId: string): Promise<PluginListItem> {
    const updated = await this.api.enablePlugin(pluginId);
    this.applyUpdate(updated);
    return updated;
  }

  async disable(pluginId: string): Promise<PluginListItem> {
    const updated = await this.api.disablePlugin(pluginId);
    this.applyUpdate(updated);
    return updated;
  }

  async updateApproval(pluginId: string, approvalMode: PluginApprovalMode): Promise<PluginListItem> {
    const updated = await this.api.updatePluginApproval(pluginId, approvalMode);
    this.applyUpdate(updated);
    return updated;
  }

  private applyUpdate(plugin: PluginListItem): void {
    const exists = this.state.data.items.some((item) => item.id === plugin.id);
    const nextItems = exists
      ? this.state.data.items.map((item) => (item.id === plugin.id ? plugin : item))
      : [plugin, ...this.state.data.items];

    this.state.data = {
      ...this.state.data,
      items: nextItems
    };
    this.state.isEmpty = this.state.data.items.length === 0;
  }
}

export function createPluginsStore(api: FamilyCoApiContracts): PluginsStore {
  return new PluginsStore(api);
}
