import type { AiAdapterRegistry } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { testProviderSchema } from './provider.schema.js';

export interface ProviderModuleDeps {
  adapterRegistry: AiAdapterRegistry;
}

export function registerProviderController(app: FastifyInstance, deps: ProviderModuleDeps): void {
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

    const result = await adapter.testConnection(body.apiKey);
    return result;
  });
}
