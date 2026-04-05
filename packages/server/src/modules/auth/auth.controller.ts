import type { AgentService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import type { ApiKeyService } from './api-key.service.js';
import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { createTokenSchema, revokeApiKeySchema } from './auth.schema.js';

export interface AuthModuleDeps {
  apiKeyService: ApiKeyService;
  agentService: AgentService;
  signToken: (payload: { sub: string; level: 'L0' | 'L1' | 'L2' }) => string;
}

export function registerAuthController(app: FastifyInstance, deps: AuthModuleDeps): void {
  app.post('/auth/token', async (request, reply) => {
    const body = createTokenSchema.parse(request.body);
    const apiKeyRecord = await deps.apiKeyService.verify(body.apiKey);

    if (!apiKeyRecord) {
      reply.code(401);
      return {
        statusCode: 401,
        code: 'AUTH_INVALID_API_KEY',
        message: 'Invalid API key'
      };
    }

    const subjectAgent = body.agentId
      ? await deps.agentService.getAgentById(body.agentId)
      : null;

    const token = deps.signToken({
      sub: subjectAgent?.id ?? 'service-account',
      level: subjectAgent?.level ?? 'L0'
    });

    return {
      token,
      tokenType: 'Bearer',
      apiKeyId: apiKeyRecord.id,
      level: subjectAgent?.level ?? 'L0'
    };
  });

  app.post('/auth/api-keys/revoke', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const body = revokeApiKeySchema.parse(request.body);
    const revokedApiKey = await deps.apiKeyService.revoke(body.apiKey);

    if (!revokedApiKey) {
      reply.code(404);
      return {
        statusCode: 404,
        code: 'AUTH_API_KEY_NOT_FOUND',
        message: 'API key not found'
      };
    }

    return {
      id: revokedApiKey.id,
      active: revokedApiKey.active
    };
  });
}
