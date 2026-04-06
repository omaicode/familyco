import { randomUUID } from 'node:crypto';

import {
  ApprovalGuard,
  type AgentRunner,
  type AgentService,
  type ApprovalService,
  type AuditService,
  type InboxService
} from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { ensureApproval } from '../shared/approval-flow.js';
import {
  agentChatBodySchema,
  createAgentSchema,
  pauseAgentParamsSchema,
  updateParentBodySchema,
  updateParentParamsSchema
} from './agent.schema.js';

interface ChatToolCall {
  toolName: string;
  ok: boolean;
  summary: string;
  output?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

interface ProcessedChatResult {
  founderMessage: Awaited<ReturnType<InboxService['createMessage']>>;
  replyMessage: Awaited<ReturnType<InboxService['createMessage']>>;
  reply: string;
  toolCalls: ChatToolCall[];
  task: unknown | null;
  project: unknown | null;
}

export interface AgentModuleDeps {
  agentService: AgentService;
  inboxService: InboxService;
  approvalService: ApprovalService;
  auditService: AuditService;
  approvalGuard: ApprovalGuard;
  agentRunner: AgentRunner;
}

export function registerAgentController(app: FastifyInstance, deps: AgentModuleDeps): void {
  app.get('/agents', async (request) => {
    requireMinimumLevel(request, 'L1');
    return deps.agentService.listAgents();
  });

  app.post('/agents', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const body = createAgentSchema.parse(request.body);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'agent.create',
      payload: {
        name: body.name,
        role: body.role,
        level: body.level,
        department: body.department,
        parentAgentId: body.parentAgentId ?? null
      }
    });

    if (!approval.allowed) {
      await deps.auditService.write({
        actorId: request.authContext?.subject ?? 'system',
        action: 'approval.request.create',
        targetId: approval.request.id,
        payload: {
          approvalAction: 'agent.create'
        }
      });

      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    const agent = await deps.agentService.createAgent(body);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'agent.create',
      targetId: agent.id,
      payload: {
        level: agent.level,
        department: agent.department
      }
    });

    reply.code(201);
    return agent;
  });

  app.post('/agents/:id/pause', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const { id } = pauseAgentParamsSchema.parse(request.params);

    const approval = await ensureApproval({
      approvalGuard: deps.approvalGuard,
      approvalService: deps.approvalService,
      authContext: request.authContext,
      action: 'agent.pause',
      targetId: id,
      payload: {
        status: 'paused'
      }
    });

    if (!approval.allowed) {
      reply.code(202);
      return {
        approvalRequired: true,
        approvalRequestId: approval.request.id,
        reason: approval.reason
      };
    }

    const pausedAgent = await deps.agentService.pauseAgent(id);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'agent.pause',
      targetId: pausedAgent.id,
      payload: {
        status: pausedAgent.status
      }
    });

    return pausedAgent;
  });

  app.get('/agents/:id/children', async (request) => {
    requireMinimumLevel(request, 'L1');
    const { id } = pauseAgentParamsSchema.parse(request.params);
    return deps.agentService.getChildren(id);
  });

  app.get('/agents/:id/path', async (request) => {
    requireMinimumLevel(request, 'L1');
    const { id } = pauseAgentParamsSchema.parse(request.params);
    return deps.agentService.getPath(id);
  });

  app.get('/agents/:id/chat', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = pauseAgentParamsSchema.parse(request.params);
    await deps.agentService.getAgentById(id);

    const inboundToAgent = await deps.inboxService.listMessages({ recipientId: id, limit: 100 });
    const founderInbox = await deps.inboxService.listMessages({ recipientId: 'founder', limit: 200 });

    return [...inboundToAgent, ...founderInbox.filter((message) => message.senderId === id)]
      .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
      .map((message) => ({
        ...message,
        direction: message.senderId === id ? 'agent_to_founder' : 'founder_to_agent'
      }));
  });

  app.post('/agents/:id/chat', async (request, reply) => {
    requireMinimumLevel(request, 'L0');
    const { id } = pauseAgentParamsSchema.parse(request.params);
    const body = agentChatBodySchema.parse(request.body);

    const result = await processAgentChat({
      agentId: id,
      body,
      deps,
      actorId: request.authContext?.subject ?? 'founder'
    });

    reply.code(201);
    return result;
  });

  app.get('/agents/:id/chat/stream', { websocket: true }, (connection, request) => {
    const socket = resolveSocketClient(connection);

    try {
      requireMinimumLevel(request, 'L0');
      const { id } = pauseAgentParamsSchema.parse(request.params);

      void deps.agentService.getAgentById(id).then(() => {
        sendSocketEvent(socket, 'chat.ready', { agentId: id });
      }).catch((error) => {
        sendSocketEvent(socket, 'chat.error', { message: toErrorMessage(error) });
        socket.close();
      });

      socket.on('message', (raw) => {
        void handleSocketChatMessage({
          raw: String(raw),
          socket,
          agentId: id,
          deps,
          actorId: request.authContext?.subject ?? 'founder'
        });
      });
    } catch (error) {
      sendSocketEvent(socket, 'chat.error', { message: toErrorMessage(error) });
      socket.close();
    }
  });

  app.patch('/agents/:id/parent', async (request) => {
    requireMinimumLevel(request, 'L0');
    const { id } = updateParentParamsSchema.parse(request.params);
    const body = updateParentBodySchema.parse(request.body);
    const updated = await deps.agentService.updateParent(id, body.parentAgentId);
    await deps.auditService.write({
      actorId: request.authContext?.subject ?? 'system',
      action: 'agent.parent.update',
      targetId: updated.id,
      payload: {
        parentAgentId: updated.parentAgentId
      }
    });

    return updated;
  });
}

async function handleSocketChatMessage(input: {
  raw: string;
  socket: { send: (payload: string) => void };
  agentId: string;
  deps: AgentModuleDeps;
  actorId: string;
}): Promise<void> {
  try {
    const body = agentChatBodySchema.parse(JSON.parse(input.raw) as unknown);
    const requestId = randomUUID();

    sendSocketEvent(input.socket, 'chat.started', {
      requestId,
      agentId: input.agentId,
      startedAt: new Date().toISOString()
    });

    const result = await processAgentChat({
      agentId: input.agentId,
      body,
      deps: input.deps,
      actorId: input.actorId
    });

    for (const toolCall of result.toolCalls) {
      sendSocketEvent(input.socket, 'chat.tool.used', {
        requestId,
        ...toolCall
      });
    }

    await streamReply(input.socket, requestId, result.replyMessage.body);

    sendSocketEvent(input.socket, 'chat.completed', {
      requestId,
      founderMessage: result.founderMessage,
      replyMessage: result.replyMessage,
      reply: result.reply,
      task: result.task,
      project: result.project,
      toolCalls: result.toolCalls
    });
  } catch (error) {
    sendSocketEvent(input.socket, 'chat.error', {
      message: toErrorMessage(error)
    });
  }
}

async function processAgentChat(input: {
  agentId: string;
  body: {
    message: string;
    meta?: {
      projectId?: string;
      taskId?: string;
    };
  };
  deps: AgentModuleDeps;
  actorId: string;
}): Promise<ProcessedChatResult> {
  const agent = await input.deps.agentService.getAgentById(input.agentId);

  const founderMessage = await input.deps.inboxService.createMessage({
    recipientId: agent.id,
    senderId: 'founder',
    type: 'info',
    title: buildChatTitle(input.body.message),
    body: input.body.message,
    payload: {
      meta: input.body.meta ?? null
    }
  });

  const runResult = await input.deps.agentRunner.run({
    agentId: agent.id,
    approvalMode: 'auto',
    action: 'chat.message',
    toolName: 'chat.respond',
    toolArguments: {
      agentId: agent.id,
      message: input.body.message,
      meta: input.body.meta ?? null
    },
    input: input.body.message
  });

  const normalizedOutput = normalizeChatOutput(runResult.output?.output);
  const replyText = runResult.status === 'blocked'
    ? runResult.reason ?? 'The chat request is waiting for review.'
    : normalizedOutput.reply;

  const replyMessage = await input.deps.inboxService.createMessage({
    recipientId: 'founder',
    senderId: agent.id,
    type: normalizedOutput.toolCalls.length > 0 ? 'report' : 'info',
    title: `Reply from ${agent.name}`,
    body: replyText,
    payload: {
      taskId: extractEntityId(normalizedOutput.task),
      projectId: extractEntityId(normalizedOutput.project),
      toolCalls: normalizedOutput.toolCalls
    }
  });

  await input.deps.auditService.write({
    actorId: input.actorId,
    action: 'agent.chat',
    targetId: agent.id,
    payload: {
      founderMessageId: founderMessage.id,
      replyMessageId: replyMessage.id,
      toolNames: normalizedOutput.toolCalls.map((toolCall) => toolCall.toolName),
      taskId: extractEntityId(normalizedOutput.task),
      projectId: extractEntityId(normalizedOutput.project)
    }
  });

  return {
    founderMessage,
    replyMessage,
    reply: replyText,
    toolCalls: normalizedOutput.toolCalls,
    task: normalizedOutput.task,
    project: normalizedOutput.project
  };
}

function normalizeChatOutput(output: unknown): {
  reply: string;
  toolCalls: ChatToolCall[];
  task: unknown | null;
  project: unknown | null;
} {
  if (!isRecord(output)) {
    return {
      reply: 'I reviewed the request and kept it in the executive chat lane.',
      toolCalls: [],
      task: null,
      project: null
    };
  }

  const toolCalls = Array.isArray(output.toolCalls)
    ? output.toolCalls.filter(isChatToolCall)
    : [];

  return {
    reply:
      typeof output.reply === 'string' && output.reply.trim().length > 0
        ? output.reply.trim()
        : 'I reviewed the request and kept it in the executive chat lane.',
    toolCalls,
    task: 'task' in output ? output.task ?? null : null,
    project: 'project' in output ? output.project ?? null : null
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isChatToolCall(value: unknown): value is ChatToolCall {
  return isRecord(value)
    && typeof value.toolName === 'string'
    && typeof value.ok === 'boolean'
    && typeof value.summary === 'string';
}

function extractEntityId(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return typeof value.id === 'string' ? value.id : undefined;
}

function sendSocketEvent(
  socket: { send: (payload: string) => void },
  type: string,
  payload: Record<string, unknown>
): void {
  socket.send(JSON.stringify({ type, payload }));
}

function resolveSocketClient(connection: {
  socket?: {
    send: (payload: string) => void;
    close: () => void;
    on: (event: string, listener: (payload: unknown) => void) => void;
  };
  send?: (payload: string) => void;
  close?: () => void;
  on?: (event: string, listener: (payload: unknown) => void) => void;
}): {
  send: (payload: string) => void;
  close: () => void;
  on: (event: string, listener: (payload: unknown) => void) => void;
} {
  if (connection.socket) {
    return connection.socket;
  }

  return {
    send: connection.send?.bind(connection) ?? (() => undefined),
    close: connection.close?.bind(connection) ?? (() => undefined),
    on: connection.on?.bind(connection) ?? (() => undefined)
  };
}

async function streamReply(
  socket: { send: (payload: string) => void },
  requestId: string,
  reply: string
): Promise<void> {
  const chunks = chunkReply(reply);

  for (let index = 0; index < chunks.length; index += 1) {
    sendSocketEvent(socket, 'chat.chunk', {
      requestId,
      index,
      chunk: chunks[index]
    });

    if (index < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 18));
    }
  }
}

function chunkReply(reply: string): string[] {
  const normalized = reply.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return [''];
  }

  const words = normalized.split(' ');
  if (words.length <= 8) {
    return [normalized];
  }

  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    const nextChunk = current.length === 0 ? word : `${current} ${word}`;
    if (nextChunk.length > 56 && current.length > 0) {
      chunks.push(current);
      current = word;
      continue;
    }

    current = nextChunk;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function buildChatTitle(message: string): string {
  const compact = message.replace(/\s+/g, ' ').trim();
  if (compact.length <= 56) {
    return compact;
  }

  return `${compact.slice(0, 53).trimEnd()}...`;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Chat stream failed';
}
