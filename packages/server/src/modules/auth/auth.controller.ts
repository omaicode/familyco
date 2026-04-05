import type { FastifyInstance } from 'fastify';

import { createTokenSchema } from './auth.schema.js';

export interface AuthModuleDeps {
  expectedApiKey: string;
  signToken: (subject: string) => string;
}

export function registerAuthController(app: FastifyInstance, deps: AuthModuleDeps): void {
  app.post('/auth/token', async (request, reply) => {
    const body = createTokenSchema.parse(request.body);

    if (body.apiKey !== deps.expectedApiKey) {
      reply.code(401);
      return {
        statusCode: 401,
        code: 'AUTH_INVALID_API_KEY',
        message: 'Invalid API key'
      };
    }

    const token = deps.signToken('api-key-client');

    return {
      token,
      tokenType: 'Bearer'
    };
  });
}
