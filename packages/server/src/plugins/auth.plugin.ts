import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest, FastifyInstance } from 'fastify';

import type { ApiKeyService } from '../modules/auth/api-key.service.js';
import type { JwtAuthPayload } from './auth.types.js';

const DEFAULT_JWT_SECRET = 'local-dev-secret';
const DEFAULT_API_KEY_SALT = 'local-dev-salt';

export function registerAuthPlugin(app: FastifyInstance): void {
  app.register(jwt, {
    secret: process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET
  });
}

export function getAuthApiKey(): string {
  return process.env.FAMILYCO_API_KEY ?? 'local-dev-api-key';
}

export function getAuthApiKeySalt(): string {
  return process.env.API_KEY_SALT ?? DEFAULT_API_KEY_SALT;
}

export async function authenticateApiRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  apiKeyService: ApiKeyService
): Promise<void> {
  const routeUrl = request.routeOptions.url ?? '';
  if (routeUrl === '/auth/token' || routeUrl.endsWith('/auth/token')) {
    return;
  }

  if (routeUrl === '/provider/test' || routeUrl.endsWith('/provider/test')) {
    return;
  }

  const apiKeyHeader = request.headers['x-api-key'];
  const apiKeyFromQuery =
    typeof request.query === 'object' && request.query !== null && 'apiKey' in request.query
      ? request.query.apiKey
      : undefined;
  const apiKey =
    typeof apiKeyHeader === 'string'
      ? apiKeyHeader
      : typeof apiKeyFromQuery === 'string'
        ? apiKeyFromQuery
        : undefined;

  if (apiKey) {
    const apiKeyRecord = await apiKeyService.verify(apiKey);
    if (apiKeyRecord) {
      request.authContext = {
        subject: 'service-account',
        level: 'L0',
        authMethod: 'api-key',
        apiKeyId: apiKeyRecord.id
      };
      return;
    }
  }

  try {
    await request.jwtVerify();
    const payload = request.user as JwtAuthPayload;
    request.authContext = {
      subject: payload.sub,
      level: payload.level,
      authMethod: 'jwt'
    };
  } catch {
    reply.code(401).send({
      statusCode: 401,
      code: 'AUTH_UNAUTHORIZED',
      message: 'Unauthorized'
    });
  }
}
