import type { FastifyInstance } from 'fastify';

import { registerAgentChatRoutes } from './agent-chat.routes.js';
import { registerAgentManagementRoutes } from './agent-management.routes.js';
import type { AgentModuleDeps } from './agent.types.js';

export { type AgentModuleDeps } from './agent.types.js';

export function registerAgentController(app: FastifyInstance, deps: AgentModuleDeps): void {
  registerAgentManagementRoutes(app, deps);
  registerAgentChatRoutes(app, deps);
}
