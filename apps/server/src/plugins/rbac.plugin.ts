import type { AgentLevel } from '@familyco/core';
import type { FastifyRequest } from 'fastify';

const LEVEL_RANK: Record<AgentLevel, number> = {
  L0: 3,
  L1: 2,
  L2: 1
};

export function requireMinimumLevel(request: FastifyRequest, minimumLevel: AgentLevel): void {
  const requestLevel = request.authContext?.level;

  if (!requestLevel) {
    throw withStatusCode(new Error('AUTH_FORBIDDEN:Missing auth context'), 403);
  }

  if (LEVEL_RANK[requestLevel] < LEVEL_RANK[minimumLevel]) {
    throw withStatusCode(
      new Error(`AUTH_FORBIDDEN:Requires ${minimumLevel} but current level is ${requestLevel}`),
      403
    );
  }
}

function withStatusCode(error: Error, statusCode: number): Error & { statusCode: number } {
  return Object.assign(error, { statusCode });
}
