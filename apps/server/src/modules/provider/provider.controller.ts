import type { AdapterAuthType, AiAdapterRegistry, AuditService, SettingsService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import {
  connectProviderOAuthSchema,
  connectProviderSchema,
  selectProviderSchema,
  testProviderSchema
} from './provider.schema.js';

export interface ProviderModuleDeps {
  adapterRegistry: AiAdapterRegistry;
  settingsService: SettingsService;
  auditService: AuditService;
  runtimeMode?: 'server' | 'desktop';
}

export function registerProviderController(app: FastifyInstance, deps: ProviderModuleDeps): void {
  app.get('/provider/list', async () => {
    const adapters = deps.adapterRegistry.list();
    const settings = await Promise.all([
      deps.settingsService.get('provider.name'),
      deps.settingsService.get('provider.defaultModel'),
      ...adapters.flatMap((adapter) => [
        deps.settingsService.get(`provider.${adapter.id}.apiKey`),
        deps.settingsService.get(`provider.${adapter.id}.oauth.accessToken`),
        deps.settingsService.get(`provider.${adapter.id}.authType`),
        deps.settingsService.get(`provider.${adapter.id}.defaultModel`)
      ])
    ]);

    const primaryProviderId = toNonEmptyString(settings[0]?.value);
    const primaryModel = toNonEmptyString(settings[1]?.value);
    const perAdapterSettings = settings.slice(2);

    return adapters.map((adapter, index) => {
      const apiKeySetting = perAdapterSettings[index * 4];
      const oauthTokenSetting = perAdapterSettings[index * 4 + 1];
      const authTypeSetting = perAdapterSettings[index * 4 + 2];
      const modelSetting = perAdapterSettings[index * 4 + 3];
      const connectedAuthTypes = [
        ...(toNonEmptyString(apiKeySetting?.value) ? ['apikey' as const] : []),
        ...(toNonEmptyString(oauthTokenSetting?.value) ? ['oauth' as const] : [])
      ];
      const activeAuthType = resolveProviderAuthType(
        authTypeSetting?.value,
        connectedAuthTypes,
        adapter.defaultAuthType
      );
      const isPrimary = primaryProviderId === adapter.id;

      return {
        id: adapter.id,
        name: adapter.name,
        description: adapter.description,
        logoId: adapter.logoId,
        keyHint: adapter.keyHint,
        supportedAuthTypes: [...adapter.supportedAuthTypes],
        connectedAuthTypes,
        activeAuthType,
        connected: connectedAuthTypes.length > 0,
        isPrimary,
        availableModels: [...adapter.availableModels],
        defaultModel: adapter.defaultModel,
        currentModel: isPrimary
          ? (primaryModel ?? toNonEmptyString(modelSetting?.value) ?? adapter.defaultModel)
          : (toNonEmptyString(modelSetting?.value) ?? adapter.defaultModel),
        oauthAvailable: deps.runtimeMode === 'desktop' && adapter.supportedAuthTypes.includes('oauth')
      };
    });
  });

  app.post('/provider/test', async (request, reply) => {
    const body = testProviderSchema.parse(request.body);

    const adapter = deps.adapterRegistry.get(body.adapterId);
    if (!adapter) {
      reply.code(400).send({
        statusCode: 400,
        code: 'ADAPTER_NOT_FOUND',
        message: `ADAPTER_NOT_FOUND:${body.adapterId}`
      });
      return;
    }

    const result = await adapter.testConnection(body.apiKey, body.model);
    return result;
  });

  app.post('/provider/:id/connect', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = connectProviderSchema.parse(request.body);
    const adapter = deps.adapterRegistry.get(id);

    if (!adapter) {
      reply.code(404).send({
        statusCode: 404,
        code: 'ADAPTER_NOT_FOUND',
        message: `ADAPTER_NOT_FOUND:${id}`
      });
      return;
    }

    if (!adapter.supportedAuthTypes.includes('apikey')) {
      reply.code(400).send({
        statusCode: 400,
        code: 'ADAPTER_NOT_APIKEY',
        message: 'This provider does not support API key authentication'
      });
      return;
    }

    const testResult = await adapter.testConnection(body.apiKey, body.model);
    if (!testResult.ok) {
      reply.code(400).send({
        statusCode: 400,
        code: 'CONNECTION_FAILED',
        message: testResult.error ?? 'Connection test failed'
      });
      return;
    }

    await Promise.all([
      deps.settingsService.upsert({ key: `provider.${id}.apiKey`, value: body.apiKey }),
      deps.settingsService.upsert({ key: `provider.${id}.authType`, value: 'apikey' }),
      deps.settingsService.upsert({ key: `provider.${id}.defaultModel`, value: body.model })
    ]);

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'provider.connected',
      targetId: id,
      payload: { providerId: id, authType: 'apikey' }
    });

    return { ok: true };
  });

  app.post('/provider/:id/oauth/connect', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = connectProviderOAuthSchema.parse(request.body);
    const adapter = deps.adapterRegistry.get(id);

    if (!adapter) {
      reply.code(404).send({
        statusCode: 404,
        code: 'ADAPTER_NOT_FOUND',
        message: `ADAPTER_NOT_FOUND:${id}`
      });
      return;
    }

    if (deps.runtimeMode !== 'desktop') {
      reply.code(403).send({
        statusCode: 403,
        code: 'OAUTH_DESKTOP_ONLY',
        message: 'OAuth connections are only available in Electron runtime'
      });
      return;
    }

    if (!adapter.supportedAuthTypes.includes('oauth')) {
      reply.code(400).send({
        statusCode: 400,
        code: 'ADAPTER_NOT_OAUTH',
        message: 'This provider does not support OAuth'
      });
      return;
    }

    const candidates = Array.from(
      new Set(body.candidateTokens.map((value) => value.trim()).filter((value) => value.length > 0))
    );
    let matchedToken: string | null = null;

    for (const candidate of candidates) {
      const testResult = await adapter.testConnection(candidate, body.model);
      if (testResult.ok) {
        matchedToken = candidate;
        break;
      }
    }

    if (!matchedToken) {
      reply.code(400).send({
        statusCode: 400,
        code: 'OAUTH_TOKEN_INVALID',
        message: 'No usable OAuth token was found in the captured cookies'
      });
      return;
    }

    await Promise.all([
      deps.settingsService.upsert({ key: `provider.${id}.oauth.accessToken`, value: matchedToken }),
      deps.settingsService.upsert({ key: `provider.${id}.authType`, value: 'oauth' }),
      deps.settingsService.upsert({ key: `provider.${id}.defaultModel`, value: body.model })
    ]);

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'provider.connected',
      targetId: id,
      payload: { providerId: id, authType: 'oauth' }
    });

    return { ok: true };
  });

  app.post('/provider/:id/disconnect', async (request, reply) => {
    const { id } = request.params as { id: string };
    const adapter = deps.adapterRegistry.get(id);

    if (!adapter) {
      reply.code(404).send({
        statusCode: 404,
        code: 'ADAPTER_NOT_FOUND',
        message: `ADAPTER_NOT_FOUND:${id}`
      });
      return;
    }

    await Promise.all([
      deps.settingsService.upsert({ key: `provider.${id}.apiKey`, value: '' }),
      deps.settingsService.upsert({ key: `provider.${id}.oauth.accessToken`, value: '' }),
      deps.settingsService.upsert({ key: `provider.${id}.authType`, value: '' })
    ]);

    const primaryProviderSetting = await deps.settingsService.get('provider.name');
    if (toNonEmptyString(primaryProviderSetting?.value) === id) {
      await Promise.all([
        deps.settingsService.upsert({ key: 'provider.name', value: '' }),
        deps.settingsService.upsert({ key: 'provider.defaultModel', value: '' })
      ]);
    }

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'provider.disconnected',
      targetId: id,
      payload: { providerId: id }
    });

    return { ok: true };
  });

  app.post('/provider/:id/select', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = selectProviderSchema.parse(request.body);
    const adapter = deps.adapterRegistry.get(id);

    if (!adapter) {
      reply.code(404).send({
        statusCode: 404,
        code: 'ADAPTER_NOT_FOUND',
        message: `ADAPTER_NOT_FOUND:${id}`
      });
      return;
    }

    const [apiKeySetting, oauthTokenSetting] = await Promise.all([
      deps.settingsService.get(`provider.${id}.apiKey`),
      deps.settingsService.get(`provider.${id}.oauth.accessToken`)
    ]);

    if (!toNonEmptyString(apiKeySetting?.value) && !toNonEmptyString(oauthTokenSetting?.value)) {
      reply.code(400).send({
        statusCode: 400,
        code: 'PROVIDER_NOT_CONNECTED',
        message: 'Connect this provider before setting it as default'
      });
      return;
    }

    await Promise.all([
      deps.settingsService.upsert({ key: 'provider.name', value: id }),
      deps.settingsService.upsert({ key: 'provider.defaultModel', value: body.model }),
      deps.settingsService.upsert({ key: `provider.${id}.defaultModel`, value: body.model })
    ]);

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'provider.selected',
      targetId: id,
      payload: { providerId: id, model: body.model }
    });

    return { ok: true };
  });
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

function toAdapterAuthType(value: unknown): AdapterAuthType | null {
  if (value === 'apikey' || value === 'oauth') {
    return value;
  }

  return null;
}

function resolveProviderAuthType(
  configuredAuthType: unknown,
  connectedAuthTypes: AdapterAuthType[],
  fallbackAuthType: AdapterAuthType
): AdapterAuthType | null {
  const explicit = toAdapterAuthType(configuredAuthType);
  if (explicit && connectedAuthTypes.includes(explicit)) {
    return explicit;
  }

  if (connectedAuthTypes.includes(fallbackAuthType)) {
    return fallbackAuthType;
  }

  return connectedAuthTypes[0] ?? null;
}
