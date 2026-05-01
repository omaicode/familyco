import type { AuditService } from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import {
  knowledgeDocumentParamsSchema,
  knowledgeDocumentQuerySchema,
  knowledgeIndexBodySchema,
  knowledgeRetrieveBodySchema
} from './knowledge.schema.js';
import type { KnowledgeService } from './knowledge.service.js';

export interface KnowledgeModuleDeps {
  knowledgeService: KnowledgeService;
  auditService: AuditService;
}

export function registerKnowledgeController(app: FastifyInstance, deps: KnowledgeModuleDeps): void {
  app.get('/knowledge/commands', async (request) => {
    requireMinimumLevel(request, 'L0');
    return {
      items: deps.knowledgeService.listConverterCommands()
    };
  });

  app.get('/knowledge/converter/status', async (request) => {
    requireMinimumLevel(request, 'L0');
    return deps.knowledgeService.getConverterStatus();
  });

  app.get('/knowledge/documents', async (request) => {
    requireMinimumLevel(request, 'L0');
    const query = knowledgeDocumentQuerySchema.parse(request.query);
    return {
      items: await deps.knowledgeService.listDocuments(query)
    };
  });

  app.post('/knowledge/documents/upload', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const uploaded = await request.file();
    if (!uploaded) {
      reply.code(400).send({
        statusCode: 400,
        code: 'KNOWLEDGE_DOCUMENT_REQUIRED',
        message: 'A knowledge document file is required'
      });
      return;
    }

    const buffer = await uploaded.toBuffer();
    if (buffer.byteLength === 0) {
      reply.code(400).send({
        statusCode: 400,
        code: 'KNOWLEDGE_DOCUMENT_EMPTY',
        message: 'Knowledge document must not be empty'
      });
      return;
    }

    const projectId = readMultipartFieldValue(uploaded.fields.projectId);
    const source = readMultipartFieldValue(uploaded.fields.source);

    const document = await deps.knowledgeService.uploadDocument({
      name: uploaded.filename,
      fileType: uploaded.mimetype,
      source,
      projectId,
      data: new Uint8Array(buffer)
    });

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'knowledge.document.upload',
      targetId: document.id,
      payload: {
        name: document.name,
        fileType: document.fileType,
        source: document.source,
        projectId: document.projectId
      }
    });

    reply.code(201);
    return document;
  });

  app.post('/knowledge/documents/:id/index', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const { id } = knowledgeDocumentParamsSchema.parse(request.params);
    const body = knowledgeIndexBodySchema.parse(request.body ?? {});
    const result = await deps.knowledgeService.indexDocument({
      documentId: id,
      ...(body.commandId ? { commandId: body.commandId } : {}),
      ...(body.maxChars !== undefined ? { maxChars: body.maxChars } : {}),
      ...(body.overlapChars !== undefined ? { overlapChars: body.overlapChars } : {})
    });

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'knowledge.document.index',
      targetId: id,
      payload: {
        commandId: body.commandId ?? 'doc-convert',
        maxChars: body.maxChars ?? 1400,
        overlapChars: body.overlapChars ?? Math.floor((body.maxChars ?? 1400) * 0.15),
        chunkCount: result.chunkCount,
        embeddingModel: result.embeddingModel
      }
    });

    reply.code(201);
    return result;
  });

  app.delete('/knowledge/documents/:id', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = knowledgeDocumentParamsSchema.parse(request.params);
    await deps.knowledgeService.deleteDocument(id);

    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'knowledge.document.delete',
      targetId: id
    });

    return { ok: true };
  });

  app.get('/knowledge/documents/:id/chunks', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = knowledgeDocumentParamsSchema.parse(request.params);
    return {
      items: await deps.knowledgeService.listChunks(id)
    };
  });

  app.post('/knowledge/retrieve', async (request) => {
    requireMinimumLevel(request, 'L0');
    const body = knowledgeRetrieveBodySchema.parse(request.body);
    return deps.knowledgeService.retrieve({
      query: body.query,
      ...(body.topK !== undefined ? { topK: body.topK } : {}),
      ...(body.minScore !== undefined ? { minScore: body.minScore } : {}),
      ...(body.projectId ? { projectId: body.projectId } : {}),
      ...(body.documentId ? { documentId: body.documentId } : {})
    });
  });
}

function readMultipartFieldValue(field: unknown): string | undefined {
  const normalized = Array.isArray(field) ? field[0] : field;
  if (!normalized || typeof normalized !== 'object' || !('value' in normalized)) {
    return undefined;
  }

  const value = (normalized as { value?: unknown }).value;
  return typeof value === 'string' ? value : undefined;
}
