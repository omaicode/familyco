import type { AuditService, InboxService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import {
  createInboxSchema,
  inboxMessageParamsSchema,
  listInboxQuerySchema,
  respondInboxBodySchema
} from './inbox.schema.js';

export interface InboxModuleDeps {
  inboxService: InboxService;
  auditService: AuditService;
}

export function registerInboxController(app: FastifyInstance, deps: InboxModuleDeps): void {
  app.get('/inbox', async (request) => {
    requireMinimumLevel(request, 'L1');
    const query = listInboxQuerySchema.parse(request.query);
    return deps.inboxService.listMessages(query);
  });

  app.post('/inbox', async (request, reply) => {
    requireMinimumLevel(request, 'L1');
    const body = createInboxSchema.parse(request.body);
    const message = await deps.inboxService.createMessage(body);

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? body.senderId,
      action: 'inbox.message.create',
      targetId: message.id,
      payload: {
        recipientId: message.recipientId,
        type: message.type
      }
    });

    reply.code(201);
    return message;
  });

  app.post('/inbox/:id/read', async (request) => {
    requireMinimumLevel(request, 'L1');
    const { id } = inboxMessageParamsSchema.parse(request.params);
    const message = await deps.inboxService.markRead(id);

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'inbox.message.read',
      targetId: message.id,
      payload: {
        status: message.status
      }
    });

    return message;
  });

  app.post('/inbox/:id/archive', async (request) => {
    requireMinimumLevel(request, 'L1');
    const { id } = inboxMessageParamsSchema.parse(request.params);
    const message = await deps.inboxService.archive(id);

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'inbox.message.archive',
      targetId: message.id,
      payload: {
        status: message.status
      }
    });

    return message;
  });

  app.post('/inbox/:id/request-change', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = inboxMessageParamsSchema.parse(request.params);
    const { responseText } = respondInboxBodySchema.parse(request.body);

    const message = await deps.inboxService.updateMessage(id, {
      payload: {
        responseType: 'request_change',
        responseText,
        respondedBy: request.authContext?.subject ?? 'founder',
        respondedAt: new Date().toISOString()
      }
    });

    await deps.inboxService.archive(id);

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'inbox.message.request_change',
      targetId: message.id,
      payload: {
        responseText,
        originalType: message.type
      }
    });

    return message;
  });

  app.post('/inbox/:id/clarification', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = inboxMessageParamsSchema.parse(request.params);
    const { responseText } = respondInboxBodySchema.parse(request.body);

    const message = await deps.inboxService.updateMessage(id, {
      payload: {
        responseType: 'clarification_answer',
        responseText,
        respondedBy: request.authContext?.subject ?? 'founder',
        respondedAt: new Date().toISOString()
      }
    });

    await deps.inboxService.archive(id);

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'inbox.message.clarification_answer',
      targetId: message.id,
      payload: {
        responseText,
        originalType: message.type
      }
    });

    return message;
  });
}
