import type { AgentLevel } from '@familyco/core';

export interface AuthContext {
  subject: string;
  level: AgentLevel;
  authMethod: 'api-key' | 'jwt';
  apiKeyId?: string;
}

export interface JwtAuthPayload {
  sub: string;
  level: AgentLevel;
}

declare module 'fastify' {
  interface FastifyRequest {
    authContext?: AuthContext;
  }

  interface FastifyJWT {
    payload: JwtAuthPayload;
    user: JwtAuthPayload;
  }
}
