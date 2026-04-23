import assert from 'node:assert/strict';
import test from 'node:test';

import { AiAdapterRegistry, type AiAdapter, type AdapterChatInput, type AdapterChatResult, type AdapterTestResult } from '@familyco/core';

import { createApp } from '../app.js';
import { TEST_API_KEY } from './test-helpers.js';

class FakeProviderAdapter implements AiAdapter {
  readonly name: string;
  readonly description: string;
  readonly logoId: string;
  readonly keyHint: string;
  readonly authType = 'apikey' as const;
  readonly defaultAuthType = 'apikey' as const;
  readonly availableModels: readonly string[];

  constructor(
    readonly id: string,
    readonly supportedAuthTypes: readonly ('apikey' | 'oauth')[],
    readonly defaultModel: string,
    private readonly validCredentials: Set<string>
  ) {
    this.name = id === 'openai' ? 'OpenAI' : 'Claude';
    this.description = `${this.name} test adapter`;
    this.logoId = id;
    this.keyHint = id === 'openai' ? 'sk-…' : 'sk-ant-…';
    this.availableModels = [defaultModel, `${defaultModel}-alt`];
  }

  async chat(_input: AdapterChatInput): Promise<AdapterChatResult> {
    return { content: 'ok' };
  }

  async testConnection(apiKey: string, model?: string): Promise<AdapterTestResult> {
    return {
      ok: this.validCredentials.has(apiKey),
      latencyMs: 1,
      model: model ?? this.defaultModel,
      ...(this.validCredentials.has(apiKey) ? {} : { error: 'Invalid credential' })
    };
  }
}

function createTestRegistry(): AiAdapterRegistry {
  const registry = new AiAdapterRegistry();
  registry.register(new FakeProviderAdapter('openai', ['apikey', 'oauth'], 'gpt-5-mini', new Set(['sk-openai', 'oauth-openai'])));
  registry.register(new FakeProviderAdapter('claude', ['apikey'], 'claude-sonnet-4-5', new Set(['sk-claude'])));
  return registry;
}

test('provider management routes support multiple connections and one primary provider', async () => {
  const app = createApp({
    logger: false,
    repositoryDriver: 'memory',
    authApiKey: TEST_API_KEY,
    adapterRegistry: createTestRegistry()
  });

  const initialList = await app.inject({
    method: 'GET',
    url: '/api/v1/provider/list',
    headers: { 'x-api-key': TEST_API_KEY }
  });

  assert.equal(initialList.statusCode, 200);
  const initialProviders = initialList.json() as Array<{ id: string; connected: boolean; oauthAvailable: boolean }>;
  assert.equal(initialProviders.find((item) => item.id === 'openai')?.connected, false);
  assert.equal(initialProviders.find((item) => item.id === 'openai')?.oauthAvailable, false);

  const connectOpenAi = await app.inject({
    method: 'POST',
    url: '/api/v1/provider/openai/connect',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: { apiKey: 'sk-openai', model: 'gpt-5-mini' }
  });
  assert.equal(connectOpenAi.statusCode, 200);

  const connectClaude = await app.inject({
    method: 'POST',
    url: '/api/v1/provider/claude/connect',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: { apiKey: 'sk-claude', model: 'claude-sonnet-4-5' }
  });
  assert.equal(connectClaude.statusCode, 200);

  const selectOpenAi = await app.inject({
    method: 'POST',
    url: '/api/v1/provider/openai/select',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: { model: 'gpt-5-mini' }
  });
  assert.equal(selectOpenAi.statusCode, 200);

  const connectedList = await app.inject({
    method: 'GET',
    url: '/api/v1/provider/list',
    headers: { 'x-api-key': TEST_API_KEY }
  });
  const connectedProviders = connectedList.json() as Array<{
    id: string;
    connected: boolean;
    isPrimary: boolean;
    connectedAuthTypes: string[];
    currentModel: string;
  }>;
  assert.equal(connectedProviders.find((item) => item.id === 'openai')?.connected, true);
  assert.equal(connectedProviders.find((item) => item.id === 'claude')?.connected, true);
  assert.equal(connectedProviders.find((item) => item.id === 'openai')?.isPrimary, true);
  assert.deepEqual(connectedProviders.find((item) => item.id === 'openai')?.connectedAuthTypes, ['apikey']);
  assert.equal(connectedProviders.find((item) => item.id === 'openai')?.currentModel, 'gpt-5-mini');

  const disconnectOpenAi = await app.inject({
    method: 'POST',
    url: '/api/v1/provider/openai/disconnect',
    headers: { 'x-api-key': TEST_API_KEY }
  });
  assert.equal(disconnectOpenAi.statusCode, 200);

  const disconnectedList = await app.inject({
    method: 'GET',
    url: '/api/v1/provider/list',
    headers: { 'x-api-key': TEST_API_KEY }
  });
  const disconnectedProviders = disconnectedList.json() as Array<{ id: string; connected: boolean; isPrimary: boolean }>;
  assert.equal(disconnectedProviders.find((item) => item.id === 'openai')?.connected, false);
  assert.equal(disconnectedProviders.find((item) => item.id === 'openai')?.isPrimary, false);

  await app.close();
});

test('desktop runtime accepts OAuth candidate tokens while server runtime rejects them', async () => {
  const serverApp = createApp({
    logger: false,
    repositoryDriver: 'memory',
    authApiKey: TEST_API_KEY,
    adapterRegistry: createTestRegistry(),
    runtimeMode: 'server'
  });

  const forbidden = await serverApp.inject({
    method: 'POST',
    url: '/api/v1/provider/openai/oauth/connect',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: { candidateTokens: ['oauth-openai'], model: 'gpt-5-mini' }
  });
  assert.equal(forbidden.statusCode, 403);
  await serverApp.close();

  const desktopApp = createApp({
    logger: false,
    repositoryDriver: 'memory',
    authApiKey: TEST_API_KEY,
    adapterRegistry: createTestRegistry(),
    runtimeMode: 'desktop'
  });

  const connected = await desktopApp.inject({
    method: 'POST',
    url: '/api/v1/provider/openai/oauth/connect',
    headers: { 'x-api-key': TEST_API_KEY },
    payload: { candidateTokens: ['bad-cookie', 'oauth-openai'], model: 'gpt-5-mini' }
  });
  assert.equal(connected.statusCode, 200);

  const listResponse = await desktopApp.inject({
    method: 'GET',
    url: '/api/v1/provider/list',
    headers: { 'x-api-key': TEST_API_KEY }
  });
  const providers = listResponse.json() as Array<{
    id: string;
    oauthAvailable: boolean;
    connectedAuthTypes: string[];
    activeAuthType: string | null;
  }>;
  const openai = providers.find((item) => item.id === 'openai');
  assert.equal(openai?.oauthAvailable, true);
  assert.deepEqual(openai?.connectedAuthTypes, ['oauth']);
  assert.equal(openai?.activeAuthType, 'oauth');

  await desktopApp.close();
});
