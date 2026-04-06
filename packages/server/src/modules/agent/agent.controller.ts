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

    const conversation = await deps.inboxService.listConversation(id, 200);
    return conversation.map((message) => ({
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
      toolCall?: unknown;
      toolCalls?: unknown[];
      [key: string]: unknown;
    };
  };
  deps: AgentModuleDeps;
  actorId: string;
}): Promise<ProcessedChatResult> {
  const agent = await input.deps.agentService.getAgentById(input.agentId);
  const slashCommand = parseSlashCommand(input.body.message);

  if (slashCommand) {
    return handleSlashCommand({
      agent,
      body: input.body,
      deps: input.deps,
      actorId: input.actorId,
      command: slashCommand
    });
  }

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
  const conversationHistory = await input.deps.inboxService.listConversation(agent.id, 24);

  const runResult = await input.deps.agentRunner.run({
    agentId: agent.id,
    approvalMode: 'auto',
    action: 'chat.message',
    toolName: 'chat.respond',
    toolArguments: {
      agentId: agent.id,
      message: input.body.message,
      meta: input.body.meta ?? null,
      conversationHistory: conversationHistory.map(toConversationHistoryEntry)
    },
    input: input.body.message
  });

  return buildProcessedChatResult({
    agent,
    founderMessage,
    runResult,
    deps: input.deps,
    actorId: input.actorId,
    auditAction: 'agent.chat'
  });
}

async function handleSlashCommand(input: {
  agent: Awaited<ReturnType<AgentService['getAgentById']>>;
  body: {
    message: string;
    meta?: {
      projectId?: string;
      taskId?: string;
      toolCall?: unknown;
      toolCalls?: unknown[];
      [key: string]: unknown;
    };
  };
  deps: AgentModuleDeps;
  actorId: string;
  command: SlashCommand;
}): Promise<ProcessedChatResult> {
  if (input.command.name === 'reset') {
    await input.deps.inboxService.clearConversation(input.agent.id);
    await input.deps.agentRunner.clearMemory(input.agent.id);

    return createDirectChatReply({
      agent: input.agent,
      founderMessage: createEphemeralFounderMessage(input.agent.id, input.body.message),
      deps: input.deps,
      actorId: input.actorId,
      auditAction: 'agent.chat.reset',
      replyText: 'Started a new chat. Previous conversation history and working memory were cleared. Use `/help` to see the available chat commands.',
      messageType: 'info'
    });
  }

  const founderMessage = await input.deps.inboxService.createMessage({
    recipientId: input.agent.id,
    senderId: 'founder',
    type: 'info',
    title: buildChatTitle(input.body.message),
    body: input.body.message,
    payload: {
      meta: input.body.meta ?? null,
      slashCommand: input.command.name
    }
  });

  if (input.command.name === 'help') {
    return createDirectChatReply({
      agent: input.agent,
      founderMessage,
      deps: input.deps,
      actorId: input.actorId,
      auditAction: 'agent.chat.help',
      replyText: buildSlashCommandHelp(),
      messageType: 'info'
    });
  }

  if (input.command.name === 'create-task' || input.command.name === 'create-project') {
    if (input.command.args.length === 0) {
      const usage = input.command.name === 'create-task'
        ? 'Usage: /create-task {desc}'
        : 'Usage: /create-project {desc}';

      return createDirectChatReply({
        agent: input.agent,
        founderMessage,
        deps: input.deps,
        actorId: input.actorId,
        auditAction: `agent.chat.${input.command.name}.usage`,
        replyText: `${usage}\n\n${buildSlashCommandHelp()}`,
        messageType: 'alert'
      });
    }

    const conversationHistory = await input.deps.inboxService.listConversation(input.agent.id, 24);
    const explicitToolCall = input.command.name === 'create-task'
      ? {
          toolName: 'task.create',
          arguments: {
            title: summarizeSlashDescription(input.command.args, 'Executive follow-up'),
            description: input.command.args
          }
        }
      : {
          toolName: 'project.create',
          arguments: {
            name: summarizeSlashDescription(input.command.args, 'Executive initiative'),
            description: input.command.args
          }
        };

    const runResult = await input.deps.agentRunner.run({
      agentId: input.agent.id,
      approvalMode: 'auto',
      action: `chat.command.${input.command.name}`,
      toolName: 'chat.respond',
      toolArguments: {
        agentId: input.agent.id,
        message: input.command.args,
        meta: {
          ...(isRecord(input.body.meta) ? input.body.meta : {}),
          slashCommand: input.command.name,
          toolCall: explicitToolCall
        },
        conversationHistory: conversationHistory.map(toConversationHistoryEntry)
      },
      input: input.body.message
    });

    return buildProcessedChatResult({
      agent: input.agent,
      founderMessage,
      runResult,
      deps: input.deps,
      actorId: input.actorId,
      auditAction: `agent.chat.${input.command.name}`
    });
  }

  return createDirectChatReply({
    agent: input.agent,
    founderMessage,
    deps: input.deps,
    actorId: input.actorId,
    auditAction: 'agent.chat.command.invalid',
    replyText: `Unknown command \`${input.command.raw}\`.\n\n${buildSlashCommandHelp()}`,
    messageType: 'alert'
  });
}

async function buildProcessedChatResult(input: {
  agent: Awaited<ReturnType<AgentService['getAgentById']>>;
  founderMessage: Awaited<ReturnType<InboxService['createMessage']>>;
  runResult: Awaited<ReturnType<AgentRunner['run']>>;
  deps: AgentModuleDeps;
  actorId: string;
  auditAction: string;
}): Promise<ProcessedChatResult> {
  const normalizedOutput = normalizeChatOutput(input.runResult.output?.output);
  const replyText = input.runResult.status === 'blocked'
    ? input.runResult.reason ?? 'The chat request is waiting for review.'
    : normalizedOutput.reply;

  const messageType = input.runResult.status === 'blocked'
    ? 'alert'
    : normalizedOutput.toolCalls.some((toolCall) => !toolCall.ok)
      ? 'alert'
      : normalizedOutput.toolCalls.length > 0
        ? 'report'
        : 'info';

  const replyMessage = await input.deps.inboxService.createMessage({
    recipientId: 'founder',
    senderId: input.agent.id,
    type: messageType,
    title: `Reply from ${input.agent.name}`,
    body: replyText,
    payload: {
      taskId: extractEntityId(normalizedOutput.task),
      projectId: extractEntityId(normalizedOutput.project),
      toolCalls: normalizedOutput.toolCalls
    }
  });

  await input.deps.auditService.write({
    actorId: input.actorId,
    action: input.auditAction,
    targetId: input.agent.id,
    payload: {
      founderMessageId: input.founderMessage.id,
      replyMessageId: replyMessage.id,
      toolNames: normalizedOutput.toolCalls.map((toolCall) => toolCall.toolName),
      taskId: extractEntityId(normalizedOutput.task),
      projectId: extractEntityId(normalizedOutput.project)
    }
  });

  return {
    founderMessage: input.founderMessage,
    replyMessage,
    reply: replyText,
    toolCalls: normalizedOutput.toolCalls,
    task: normalizedOutput.task,
    project: normalizedOutput.project
  };
}

async function createDirectChatReply(input: {
  agent: Awaited<ReturnType<AgentService['getAgentById']>>;
  founderMessage: Awaited<ReturnType<InboxService['createMessage']>>;
  deps: AgentModuleDeps;
  actorId: string;
  auditAction: string;
  replyText: string;
  messageType: 'alert' | 'info' | 'report';
}): Promise<ProcessedChatResult> {
  const replyMessage = await input.deps.inboxService.createMessage({
    recipientId: 'founder',
    senderId: input.agent.id,
    type: input.messageType,
    title: `Reply from ${input.agent.name}`,
    body: input.replyText,
    payload: {
      toolCalls: []
    }
  });

  await input.deps.auditService.write({
    actorId: input.actorId,
    action: input.auditAction,
    targetId: input.agent.id,
    payload: {
      founderMessageId: input.founderMessage.id,
      replyMessageId: replyMessage.id,
      toolNames: []
    }
  });

  return {
    founderMessage: input.founderMessage,
    replyMessage,
    reply: input.replyText,
    toolCalls: [],
    task: null,
    project: null
  };
}

interface SlashCommand {
  name: 'reset' | 'help' | 'create-task' | 'create-project' | 'unknown';
  raw: string;
  args: string;
}

function parseSlashCommand(message: string): SlashCommand | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const [rawCommand, ...rest] = trimmed.split(/\s+/);
  const args = rest.join(' ').trim();
  const normalized = rawCommand.toLowerCase();

  if (normalized === '/reset' || normalized === '/new') {
    return { name: 'reset', raw: rawCommand, args };
  }

  if (normalized === '/help' || normalized === '/h') {
    return { name: 'help', raw: rawCommand, args };
  }

  if (normalized === '/create-task') {
    return { name: 'create-task', raw: rawCommand, args };
  }

  if (normalized === '/create-project') {
    return { name: 'create-project', raw: rawCommand, args };
  }

  return { name: 'unknown', raw: rawCommand, args };
}

function buildSlashCommandHelp(): string {
  return [
    'Available slash commands:',
    '- `/help` or `/h`: Show the list of chat commands.',
    '- `/reset` or `/new`: Clear the current chat history and start a fresh session.',
    '- `/create-project {desc}`: Open a new project from the description you provide.',
    '- `/create-task {desc}`: Create a new task from the description you provide.'
  ].join('\n');
}

function summarizeSlashDescription(description: string, fallback: string): string {
  const normalized = description.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return fallback;
  }

  if (normalized.length <= 72) {
    return normalized;
  }

  return `${normalized.slice(0, 69).trimEnd()}...`;
}

function toConversationHistoryEntry(message: Awaited<ReturnType<InboxService['createMessage']>>): {
  senderId: string;
  title: string;
  body: string;
  createdAt: string;
} {
  return {
    senderId: message.senderId,
    title: message.title,
    body: message.body,
    createdAt: message.createdAt.toISOString()
  };
}

function createEphemeralFounderMessage(
  agentId: string,
  message: string
): Awaited<ReturnType<InboxService['createMessage']>> {
  const now = new Date();
  return {
    id: `local-${now.getTime()}`,
    recipientId: agentId,
    senderId: 'founder',
    type: 'info',
    title: buildChatTitle(message),
    body: message,
    status: 'read',
    createdAt: now,
    updatedAt: now
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
