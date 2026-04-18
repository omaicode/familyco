import type { ToolParameterDefinition } from './tool.types.js';

export interface ToolListItem {
  name: string;
  description: string;
  parameters: ToolParameterDefinition[];
  source: 'built-in' | 'plugin';
  pluginId: string | null;
  enabled: boolean;
  togglable: boolean;
}

export interface ToolsListResponse {
  items: ToolListItem[];
}

export interface ToolsRegistry {
  enabled: string[];
  disabled: string[];
  updatedAt: string;
}
