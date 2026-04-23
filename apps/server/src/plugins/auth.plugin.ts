import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest, FastifyInstance } from 'fastify';

import type { ApiKeyService } from '../modules/auth/api-key.service.js';
import type { JwtAuthPayload } from './auth.types.js';

const DEFAULT_JWT_SECRET = 'local-dev-secret';
const DEFAULT_API_KEY_SALT = 'local-dev-salt';

export function registerAuthPlugin(app: FastifyInstance): void {
  app.register(jwt, {
    secret: process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET,
    sign: { expiresIn: '8h' }
  });
}

export function getAuthApiKey(): string {
  return process.env.FAMILYCO_API_KEY ?? 'replace-with-a-random-secret';
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

  const apiKeyHeader = request.headers['x-api-key'];
  const apiKeyFromHeader = typeof apiKeyHeader === 'string' ? apiKeyHeader : undefined;
  const apiKeyFromQuery = readApiKeyFromQuery(request.query);
  const apiKey = apiKeyFromHeader ?? apiKeyFromQuery;

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

function readApiKeyFromQuery(query: unknown): string | undefined {
  if (!isRecord(query)) {
    return undefined;
  }

  const value = query.apiKey;
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
