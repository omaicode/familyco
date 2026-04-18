import type { ToolParameterDefinition } from './tool.types.js';
import type { PluginToolCustomFieldDefinition } from '@familyco/core';

export type ToolCustomFieldValue = string | number | boolean;

export type ToolCustomFieldValues = Record<string, ToolCustomFieldValue>;

export interface ToolListItem {
  name: string;
  description: string;
  parameters: ToolParameterDefinition[];
  source: 'built-in' | 'plugin';
  pluginId: string | null;
  enabled: boolean;
  togglable: boolean;
  customFields: Readonly<Record<string, PluginToolCustomFieldDefinition>>;
  customFieldValues: ToolCustomFieldValues;
  missingRequiredCustomFields: string[];
}

export interface ToolsListResponse {
  items: ToolListItem[];
}

export interface ToolsRegistry {
  enabled: string[];
  disabled: string[];
  updatedAt: string;
}

export interface ToolCustomFieldRegistry {
  values: Record<string, ToolCustomFieldValues>;
  updatedAt: string;
}
