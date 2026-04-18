import type { FamilyCoApiContracts, ToolListItem, ToolsListResponse } from '../api/contracts.js';
import { createAsyncState, type AsyncState } from './async-state.js';

const EMPTY_TOOLS_RESPONSE: ToolsListResponse = {
  items: []
};

export class ToolsStore {
  state: AsyncState<ToolsListResponse>;

  constructor(private readonly api: FamilyCoApiContracts) {
    this.state = createAsyncState<ToolsListResponse>(EMPTY_TOOLS_RESPONSE);
  }

  async load(): Promise<void> {
    this.state.isLoading = true;
    this.state.errorMessage = null;

    try {
      const response = await this.api.listTools();
      this.state.data = response;
      this.state.isEmpty = response.items.length === 0;
    } catch (error) {
      this.state.errorMessage = error instanceof Error ? error.message : 'Failed to load tools';
    } finally {
      this.state.isLoading = false;
    }
  }

  async enable(toolName: string): Promise<ToolListItem> {
    const updated = await this.api.enableTool(toolName);
    this.applyUpdate(updated);
    return updated;
  }

  async disable(toolName: string): Promise<ToolListItem> {
    const updated = await this.api.disableTool(toolName);
    this.applyUpdate(updated);
    return updated;
  }

  private applyUpdate(tool: ToolListItem): void {
    const exists = this.state.data.items.some((item) => item.name === tool.name);
    const nextItems = exists
      ? this.state.data.items.map((item) => (item.name === tool.name ? tool : item))
      : [tool, ...this.state.data.items];

    this.state.data = {
      ...this.state.data,
      items: nextItems
    };
    this.state.isEmpty = this.state.data.items.length === 0;
  }
}

export function createToolsStore(api: FamilyCoApiContracts): ToolsStore {
  return new ToolsStore(api);
}
