import assert from 'node:assert/strict';
import test from 'node:test';

import { AiAdapterRegistry, SettingsService, type AiAdapter, type AdapterChatInput, type AdapterChatResult, type AdapterTestResult, type Setting, type SettingsRepository, type UpsertSettingInput } from '@familyco/core';

import type { ToolDefinitionSummary } from '../tools/tool.types.js';
import { ChatEngineService, filterToolsForAgent } from './chat-engine.service.js';

function toTool(name: string): ToolDefinitionSummary {
  return {
    name,
    description: `${name} description`,
    parameters: []
  };
}

test('filterToolsForAgent keeps plugin tools for chat prompt/tool availability', () => {
  const tools: ToolDefinitionSummary[] = [
    toTool('plugin.base.tavily_search'),
    toTool('unknown.internal.tool'),
    toTool('confirm.request')
  ];

  const filtered = filterToolsForAgent(tools, 'L0');
  const filteredNames = filtered.map((tool) => tool.name);

  assert.equal(filteredNames.includes('plugin.base.tavily_search'), true);
  assert.equal(filteredNames.includes('confirm.request'), true);
  assert.equal(filteredNames.includes('unknown.internal.tool'), false);
});

test('getAdapterConfig prefers per-provider OAuth token and model for agent overrides', async () => {
  const settingsService = new SettingsService(new InMemorySettingsRepository());
  const registry = createTestRegistry();
  const service = new ChatEngineService(settingsService, registry);

  await settingsService.upsert({ key: 'provider.name', value: 'openai' });
  await settingsService.upsert({ key: 'provider.defaultModel', value: 'gpt-5-mini' });
  await settingsService.upsert({ key: 'provider.claude.defaultModel', value: 'claude-sonnet-4-5' });
  await settingsService.upsert({ key: 'provider.claude.oauth.accessToken', value: 'oauth-claude' });
  await settingsService.upsert({ key: 'provider.claude.authType', value: 'oauth' });

  const config = await service.getAdapterConfig('claude', null);
  assert.deepEqual(config, {
    adapterId: 'claude',
    apiKey: 'oauth-claude',
    model: 'claude-sonnet-4-5'
  });
});

test('getAdapterConfig falls back to available API key when auth type is unset', async () => {
  const settingsService = new SettingsService(new InMemorySettingsRepository());
  const registry = createTestRegistry();
  const service = new ChatEngineService(settingsService, registry);

  await settingsService.upsert({ key: 'provider.name', value: 'openai' });
  await settingsService.upsert({ key: 'provider.defaultModel', value: 'gpt-5-mini' });
  await settingsService.upsert({ key: 'provider.openai.apiKey', value: 'sk-openai' });

  const config = await service.getAdapterConfig(null, null);
  assert.deepEqual(config, {
    adapterId: 'openai',
    apiKey: 'sk-openai',
    model: 'gpt-5-mini'
  });
});

class InMemorySettingsRepository implements SettingsRepository {
  private readonly items = new Map<string, Setting>();

  async get(key: string): Promise<Setting | null> {
    return this.items.get(key) ?? null;
  }

  async list(): Promise<Setting[]> {
    return Array.from(this.items.values());
  }

  async upsert(input: UpsertSettingInput): Promise<Setting> {
    const existing = this.items.get(input.key);
    const next: Setting = {
      key: input.key,
      value: input.value,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date()
    };
    this.items.set(input.key, next);
    return next;
  }
}

class FakeAdapter implements AiAdapter {
  readonly name: string;
  readonly description: string;
  readonly logoId: string;
  readonly keyHint = 'sk-…';
  readonly authType = 'apikey' as const;

  constructor(
    readonly id: 'openai' | 'claude',
    readonly supportedAuthTypes: readonly ('apikey' | 'oauth')[],
    readonly defaultAuthType: 'apikey' | 'oauth',
    readonly defaultModel: string,
    readonly availableModels: readonly string[]
  ) {
    this.name = id;
    this.description = `${id} adapter`;
    this.logoId = id;
  }

  async chat(_input: AdapterChatInput): Promise<AdapterChatResult> {
    return { content: 'ok' };
  }

  async testConnection(apiKey: string, model?: string): Promise<AdapterTestResult> {
    return {
      ok: apiKey.length > 0,
      latencyMs: 1,
      model
    };
  }
}

function createTestRegistry(): AiAdapterRegistry {
  const registry = new AiAdapterRegistry();
  registry.register(new FakeAdapter('openai', ['apikey', 'oauth'], 'apikey', 'gpt-5-mini', ['gpt-5-mini']));
  registry.register(new FakeAdapter('claude', ['apikey', 'oauth'], 'apikey', 'claude-sonnet-4-5', ['claude-sonnet-4-5']));
  return registry;
}
