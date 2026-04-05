import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest, FastifyInstance } from 'fastify';

const DEFAULT_JWT_SECRET = 'local-dev-secret';
const DEFAULT_API_KEY = 'local-dev-api-key';

export function registerAuthPlugin(app: FastifyInstance): void {
  app.register(jwt, {
    secret: process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET
  });
}

export function getAuthApiKey(): string {
  return process.env.FAMILYCO_API_KEY ?? DEFAULT_API_KEY;
}

export async function authenticateApiRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  expectedApiKey: string
): Promise<void> {
  const routeUrl = request.routeOptions.url ?? '';
  if (routeUrl === '/auth/token' || routeUrl.endsWith('/auth/token')) {
    return;
  }

  const apiKeyHeader = request.headers['x-api-key'];
  const apiKey = typeof apiKeyHeader === 'string' ? apiKeyHeader : undefined;

  if (apiKey && apiKey === expectedApiKey) {
    return;
  }

  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({
      statusCode: 401,
      code: 'AUTH_UNAUTHORIZED',
      message: 'Unauthorized'
    });
  }
}
