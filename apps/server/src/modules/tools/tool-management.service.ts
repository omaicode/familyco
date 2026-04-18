import type { PluginToolCustomFieldDefinition, SettingsService } from '@familyco/core';

import type { ToolDefinitionSummary, ToolParameterDefinition } from './tool.types.js';
import type {
  ToolCustomFieldRegistry,
  ToolCustomFieldValue,
  ToolCustomFieldValues,
  ToolListItem,
  ToolsListResponse,
  ToolsRegistry
} from './tool-management.types.js';

const TOOLS_REGISTRY_KEY = 'tools.registry';
const TOOLS_CUSTOM_FIELDS_KEY = 'tools.customFields';

interface ToolRegistryExecutor {
  listToolDefinitions(options?: { includeDisabledPluginTools?: boolean }): ToolDefinitionSummary[];
  setDisabledPluginTools(toolNames: readonly string[]): void;
  setPluginToolCustomFieldValues(toolCustomFieldValuesByToolName: Readonly<Record<string, Record<string, unknown>>>): void;
}

export class ToolManagementService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly toolExecutor: ToolRegistryExecutor
  ) {}

  async list(): Promise<ToolsListResponse> {
    const registry = await this.getRegistry();
    const customFieldRegistry = await this.getCustomFieldRegistry();
    return {
      items: this.collectToolItems(registry, customFieldRegistry)
    };
  }

  async getByName(name: string): Promise<ToolListItem | null> {
    const registry = await this.getRegistry();
    const customFieldRegistry = await this.getCustomFieldRegistry();
    const item = this.collectToolItems(registry, customFieldRegistry).find((tool) => tool.name === name);
    return item ?? null;
  }

  async enable(name: string): Promise<ToolListItem> {
    const existing = await this.getByName(name);
    if (!existing) {
      throw new Error(`TOOL_NOT_FOUND:${name}`);
    }
    if (!existing.togglable) {
      throw withStatusCode(new Error(`TOOL_IMMUTABLE:${name}`), 403);
    }
    if (existing.missingRequiredCustomFields.length > 0) {
      const missingLabels = existing.missingRequiredCustomFields
        .map((fieldKey) => existing.customFields[fieldKey]?.name ?? fieldKey)
        .join(', ');
      throw withStatusCode(
        new Error(`TOOL_CONFIG_REQUIRED:Missing required custom fields for ${name}: ${missingLabels}`),
        400
      );
    }

    const registry = await this.getRegistry();
    registry.disabled = registry.disabled.filter((toolName) => toolName !== name);
    registry.enabled = Array.from(new Set([...registry.enabled, name]));

    await this.setRegistry(registry);
    const updated = await this.getByName(name);
    if (!updated) {
      throw new Error(`TOOL_NOT_FOUND:${name}`);
    }

    return updated;
  }

  async disable(name: string): Promise<ToolListItem> {
    const existing = await this.getByName(name);
    if (!existing) {
      throw new Error(`TOOL_NOT_FOUND:${name}`);
    }
    if (!existing.togglable) {
      throw withStatusCode(new Error(`TOOL_IMMUTABLE:${name}`), 403);
    }

    const registry = await this.getRegistry();
    registry.enabled = registry.enabled.filter((toolName) => toolName !== name);
    registry.disabled = Array.from(new Set([...registry.disabled, name]));

    await this.setRegistry(registry);
    const updated = await this.getByName(name);
    if (!updated) {
      throw new Error(`TOOL_NOT_FOUND:${name}`);
    }

    return updated;
  }

  async updateCustomFields(name: string, updates: Record<string, unknown>): Promise<ToolListItem> {
    const existing = await this.getByName(name);
    if (!existing) {
      throw new Error(`TOOL_NOT_FOUND:${name}`);
    }
    if (!existing.togglable) {
      throw withStatusCode(new Error(`TOOL_IMMUTABLE:${name}`), 403);
    }

    const normalizedValues = normalizeToolCustomFieldValues(existing.customFields, updates, existing.customFieldValues);
    const customFieldRegistry = await this.getCustomFieldRegistry();

    if (Object.keys(normalizedValues).length === 0) {
      delete customFieldRegistry.values[name];
    } else {
      customFieldRegistry.values[name] = normalizedValues;
    }

    await this.setCustomFieldRegistry(customFieldRegistry);

    const updated = await this.getByName(name);
    if (!updated) {
      throw new Error(`TOOL_NOT_FOUND:${name}`);
    }

    return updated;
  }

  async syncExecutorPolicy(): Promise<void> {
    await this.syncExecutorPolicyWithCurrentSettings();
  }

  private collectToolItems(registry: ToolsRegistry, customFieldRegistry: ToolCustomFieldRegistry): ToolListItem[] {
    const discovered = this.toolExecutor.listToolDefinitions({ includeDisabledPluginTools: true });

    return discovered
      .map((tool) => mapToolSummary(tool, registry, customFieldRegistry))
      .sort((left, right) => {
        if (left.source !== right.source) {
          return left.source === 'built-in' ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });
  }

  private async getRegistry(): Promise<ToolsRegistry> {
    const setting = await this.settingsService.get(TOOLS_REGISTRY_KEY);
    const value = setting?.value;

    if (!isRegistryPayload(value)) {
      return {
        enabled: [],
        disabled: [],
        updatedAt: new Date(0).toISOString()
      };
    }

    return {
      enabled: normalizeRegistryList(value.enabled),
      disabled: normalizeRegistryList(value.disabled),
      updatedAt: value.updatedAt
    };
  }

  private async setRegistry(registry: ToolsRegistry): Promise<void> {
    const payload: ToolsRegistry = {
      enabled: normalizeRegistryList(registry.enabled),
      disabled: normalizeRegistryList(registry.disabled),
      updatedAt: new Date().toISOString()
    };

    await this.settingsService.upsert({
      key: TOOLS_REGISTRY_KEY,
      value: payload
    });

    await this.syncExecutorPolicyWithCurrentSettings();
  }

  private async getCustomFieldRegistry(): Promise<ToolCustomFieldRegistry> {
    const setting = await this.settingsService.get(TOOLS_CUSTOM_FIELDS_KEY);
    const value = setting?.value;

    if (!isCustomFieldRegistryPayload(value)) {
      return {
        values: {},
        updatedAt: new Date(0).toISOString()
      };
    }

    return {
      values: normalizeCustomFieldRegistryValues(value.values),
      updatedAt: value.updatedAt
    };
  }

  private async setCustomFieldRegistry(registry: ToolCustomFieldRegistry): Promise<void> {
    const payload: ToolCustomFieldRegistry = {
      values: normalizeCustomFieldRegistryValues(registry.values),
      updatedAt: new Date().toISOString()
    };

    await this.settingsService.upsert({
      key: TOOLS_CUSTOM_FIELDS_KEY,
      value: payload
    });

    await this.syncExecutorPolicyWithCurrentSettings();
  }

  private async syncExecutorPolicyWithCurrentSettings(): Promise<void> {
    const registry = await this.getRegistry();
    const customFieldRegistry = await this.getCustomFieldRegistry();
    this.applyExecutorPolicy(registry, customFieldRegistry);
  }

  private applyExecutorPolicy(registry: ToolsRegistry, customFieldRegistry: ToolCustomFieldRegistry): void {
    const discovered = this.toolExecutor.listToolDefinitions({ includeDisabledPluginTools: true });
    const disabledPluginToolNames: string[] = [];
    const toolCustomFieldValuesByToolName: Record<string, Record<string, unknown>> = {};

    for (const tool of discovered) {
      if (!isPluginToolName(tool.name)) {
        continue;
      }

      const customFields = cloneCustomFieldDefinitions(tool.customFields);
      const customFieldValues = normalizeToolCustomFieldValues(
        customFields,
        customFieldRegistry.values[tool.name] ?? {}
      );
      const missingRequiredCustomFields = getMissingRequiredCustomFields(customFields, customFieldValues);
      const isEnabled = isPluginToolEnabled(tool, registry) && missingRequiredCustomFields.length === 0;

      if (!isEnabled) {
        disabledPluginToolNames.push(tool.name);
      }

      toolCustomFieldValuesByToolName[tool.name] = { ...customFieldValues };
    }

    this.toolExecutor.setDisabledPluginTools(disabledPluginToolNames);
    this.toolExecutor.setPluginToolCustomFieldValues(toolCustomFieldValuesByToolName);
  }
}

function mapToolSummary(
  summary: ToolDefinitionSummary,
  registry: ToolsRegistry,
  customFieldRegistry: ToolCustomFieldRegistry
): ToolListItem {
  const pluginMeta = parsePluginToolName(summary.name);
  const source = pluginMeta ? 'plugin' : 'built-in';
  const customFields = cloneCustomFieldDefinitions(summary.customFields);
  const customFieldValues = normalizeToolCustomFieldValues(customFields, customFieldRegistry.values[summary.name] ?? {});
  const missingRequiredCustomFields = getMissingRequiredCustomFields(customFields, customFieldValues);
  const enabledByRegistry = pluginMeta ? isPluginToolEnabled(summary, registry) : true;
  const enabled = pluginMeta ? enabledByRegistry && missingRequiredCustomFields.length === 0 : true;

  return {
    name: summary.name,
    description: summary.description,
    parameters: cloneParameters(summary.parameters),
    source,
    pluginId: pluginMeta?.pluginId ?? null,
    enabled,
    togglable: pluginMeta !== null,
    customFields,
    customFieldValues,
    missingRequiredCustomFields
  };
}

function parsePluginToolName(name: string): { pluginId: string } | null {
  if (!name.startsWith('plugin.')) {
    return null;
  }

  const parts = name.split('.');
  if (parts.length < 3) {
    return null;
  }

  const pluginId = parts[1]?.trim();
  if (!pluginId) {
    return null;
  }

  return { pluginId };
}

function isPluginToolName(name: string): boolean {
  return name.startsWith('plugin.');
}

function isPluginToolEnabled(summary: ToolDefinitionSummary, registry: ToolsRegistry): boolean {
  if (registry.enabled.includes(summary.name)) {
    return true;
  }

  if (registry.disabled.includes(summary.name)) {
    return false;
  }

  return summary.enabledByDefault === true;
}

function cloneParameters(parameters: ToolParameterDefinition[]): ToolParameterDefinition[] {
  return parameters.map((item) => ({
    name: item.name,
    type: item.type,
    required: item.required,
    description: item.description,
    ...(item.items ? { items: { ...item.items } } : {})
  }));
}

function cloneCustomFieldDefinitions(
  customFields?: Readonly<Record<string, PluginToolCustomFieldDefinition>>
): Readonly<Record<string, PluginToolCustomFieldDefinition>> {
  if (!customFields) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(customFields).map(([key, definition]) => [
      key,
      {
        ...definition,
        ...(definition.options ? { options: [...definition.options] } : {})
      }
    ])
  );
}

function getMissingRequiredCustomFields(
  customFields: Readonly<Record<string, PluginToolCustomFieldDefinition>>,
  customFieldValues: ToolCustomFieldValues
): string[] {
  return Object.entries(customFields)
    .filter(([, definition]) => definition.required)
    .filter(([fieldKey, definition]) => !hasCustomFieldValue(definition, customFieldValues[fieldKey]))
    .map(([fieldKey]) => fieldKey)
    .sort((left, right) => left.localeCompare(right));
}

function hasCustomFieldValue(definition: PluginToolCustomFieldDefinition, value: unknown): boolean {
  if (definition.type === 'boolean') {
    return typeof value === 'boolean';
  }

  if (definition.type === 'number') {
    return typeof value === 'number' && Number.isFinite(value);
  }

  if (definition.type === 'select') {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return false;
    }

    return !definition.options || definition.options.includes(value);
  }

  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeToolCustomFieldValues(
  customFields: Readonly<Record<string, PluginToolCustomFieldDefinition>>,
  values: Record<string, unknown>,
  base: ToolCustomFieldValues = {}
): ToolCustomFieldValues {
  const normalized: ToolCustomFieldValues = {};

  for (const [fieldKey, value] of Object.entries(base)) {
    if (!Object.prototype.hasOwnProperty.call(customFields, fieldKey)) {
      continue;
    }

    const definition = customFields[fieldKey]!;
    const parsed = normalizeCustomFieldValue(definition, value);
    if (typeof parsed !== 'undefined') {
      normalized[fieldKey] = parsed;
    }
  }

  for (const [fieldKey, value] of Object.entries(values)) {
    if (!Object.prototype.hasOwnProperty.call(customFields, fieldKey)) {
      continue;
    }

    const definition = customFields[fieldKey]!;
    const parsed = normalizeCustomFieldValue(definition, value);

    if (typeof parsed === 'undefined') {
      delete normalized[fieldKey];
      continue;
    }

    normalized[fieldKey] = parsed;
  }

  return normalized;
}

function normalizeCustomFieldValue(
  definition: PluginToolCustomFieldDefinition,
  value: unknown
): ToolCustomFieldValue | undefined {
  if (value === null || typeof value === 'undefined') {
    return undefined;
  }

  if (definition.type === 'boolean') {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }

    return undefined;
  }

  if (definition.type === 'number') {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) {
        return undefined;
      }

      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return undefined;
  }

  if (definition.type === 'select' && definition.options && !definition.options.includes(normalized)) {
    return undefined;
  }

  return normalized;
}

function isRegistryPayload(
  value: unknown
): value is {
  enabled: unknown[];
  disabled?: unknown[];
  updatedAt: string;
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return Array.isArray(payload.enabled) && typeof payload.updatedAt === 'string';
}

function isCustomFieldRegistryPayload(
  value: unknown
): value is {
  values: Record<string, unknown>;
  updatedAt: string;
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return isRecord(payload.values) && typeof payload.updatedAt === 'string';
}

function normalizeCustomFieldRegistryValues(value: Record<string, unknown>): Record<string, ToolCustomFieldValues> {
  const normalized: Record<string, ToolCustomFieldValues> = {};

  for (const [toolName, fieldValues] of Object.entries(value)) {
    if (!isRecord(fieldValues)) {
      continue;
    }

    const parsed: ToolCustomFieldValues = {};
    for (const [fieldKey, fieldValue] of Object.entries(fieldValues)) {
      if (typeof fieldValue === 'string') {
        parsed[fieldKey] = fieldValue;
      } else if (typeof fieldValue === 'number' && Number.isFinite(fieldValue)) {
        parsed[fieldKey] = fieldValue;
      } else if (typeof fieldValue === 'boolean') {
        parsed[fieldKey] = fieldValue;
      }
    }

    if (Object.keys(parsed).length > 0) {
      normalized[toolName] = parsed;
    }
  }

  return normalized;
}

function normalizeRegistryList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function withStatusCode(error: Error, statusCode: number): Error & { statusCode: number } {
  return Object.assign(error, { statusCode });
}
