import type { SettingsService } from '@familyco/core';

import type { ToolDefinitionSummary, ToolParameterDefinition } from './tool.types.js';
import type { ToolListItem, ToolsListResponse, ToolsRegistry } from './tool-management.types.js';

const TOOLS_REGISTRY_KEY = 'tools.registry';

interface ToolRegistryExecutor {
  listToolDefinitions(options?: { includeDisabledPluginTools?: boolean }): ToolDefinitionSummary[];
  setDisabledPluginTools(toolNames: readonly string[]): void;
}

export class ToolManagementService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly toolExecutor: ToolRegistryExecutor
  ) {}

  async list(): Promise<ToolsListResponse> {
    const registry = await this.getRegistry();
    return {
      items: this.collectToolItems(registry)
    };
  }

  async getByName(name: string): Promise<ToolListItem | null> {
    const registry = await this.getRegistry();
    const item = this.collectToolItems(registry).find((tool) => tool.name === name);
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

    const registry = await this.getRegistry();
    registry.disabled = registry.disabled.filter((toolName) => toolName !== name);
    registry.enabled = Array.from(new Set([...registry.enabled, name]));

    await this.setRegistry(registry);
    return { ...existing, enabled: true };
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
    return { ...existing, enabled: false };
  }

  async syncExecutorPolicy(): Promise<void> {
    const registry = await this.getRegistry();
    this.applyExecutorPolicy(registry);
  }

  private collectToolItems(registry: ToolsRegistry): ToolListItem[] {
    const discovered = this.toolExecutor.listToolDefinitions({ includeDisabledPluginTools: true });

    return discovered
      .map((tool) => mapToolSummary(tool, registry))
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

    this.applyExecutorPolicy(payload);
  }

  private applyExecutorPolicy(registry: ToolsRegistry): void {
    const discovered = this.toolExecutor.listToolDefinitions({ includeDisabledPluginTools: true });
    const disabledPluginToolNames = discovered
      .filter((tool) => isPluginToolName(tool.name))
      .filter((tool) => !isPluginToolEnabled(tool, registry))
      .map((tool) => tool.name);

    this.toolExecutor.setDisabledPluginTools(disabledPluginToolNames);
  }
}

function mapToolSummary(summary: ToolDefinitionSummary, registry: ToolsRegistry): ToolListItem {
  const pluginMeta = parsePluginToolName(summary.name);
  const source = pluginMeta ? 'plugin' : 'built-in';

  return {
    name: summary.name,
    description: summary.description,
    parameters: cloneParameters(summary.parameters),
    source,
    pluginId: pluginMeta?.pluginId ?? null,
    enabled: pluginMeta ? isPluginToolEnabled(summary, registry) : true,
    togglable: pluginMeta !== null
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

function withStatusCode(error: Error, statusCode: number): Error & { statusCode: number } {
  return Object.assign(error, { statusCode });
}
