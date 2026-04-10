import { randomUUID } from 'node:crypto';

import type { AgentRunner, AgentService, InboxService, ToolExecutionResult } from '@familyco/core';

import { registerChatChunkListener } from './agent-chat-stream-broker.js';
import { buildAgentSlashRegistry } from './agent-chat.registry.js';
import type { ParsedSlashEntry } from './agent-chat.registry.js';
import type {
  AgentModuleDeps,
  ChatRequestBody,
  ChatSocketClient,
  ChatToolCall,
  ProcessedChatResult
} from './agent.types.js';

export async function handleSocketChatMessage(input: {
  raw: string;
  socket: ChatSocketClient;
  agentId: string;
  deps: AgentModuleDeps;
  actorId: string;
}): Promise<void> {
  try {
    const body = JSON.parse(input.raw) as ChatRequestBody;
    const requestId = randomUUID();

    sendSocketEvent(input.socket, 'chat.started', {
      requestId,
      agentId: input.agentId,
      startedAt: new Date().toISOString()
    });

    let chunkIndex = 0;
    const unregisterChunkListener = registerChatChunkListener(requestId, (chunk) => {
      sendSocketEvent(input.socket, 'chat.chunk', {
        requestId,
        index: chunkIndex,
        chunk
      });
      chunkIndex += 1;
    });

    const result = await processAgentChat({
      agentId: input.agentId,
      body,
      deps: input.deps,
      actorId: input.actorId,
      streamRequestId: requestId
    }).finally(() => {
      unregisterChunkListener();
    });

    for (const toolCall of result.toolCalls) {
      sendSocketEvent(input.socket, 'chat.tool.used', {
        requestId,
        ...toolCall
      });
    }

    if (chunkIndex === 0) {
      await streamReply(input.socket, requestId, result.replyMessage.body);
    }

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

export async function processAgentChat(input: {
  agentId: string;
  body: ChatRequestBody;
  deps: AgentModuleDeps;
  actorId: string;
  streamRequestId?: string;
}): Promise<ProcessedChatResult> {
  const agent = await input.deps.agentService.getAgentById(input.agentId);
  const registry = buildAgentSlashRegistry();
  const parsedCommand = registry.parse(input.body.message);

  if (parsedCommand) {
    return runSlashCommand({
      agent,
      body: input.body,
      deps: input.deps,
      actorId: input.actorId,
      parsedCommand,
      streamRequestId: input.streamRequestId
    });
  }

  const founderMessage = await createFounderMessage({
    agentId: agent.id,
    body: input.body,
    slashCommand: null,
    inboxService: input.deps.inboxService
  });
  const conversationHistory = await input.deps.inboxService.listConversation(agent.id, 12);

  const runResult = await input.deps.agentRunner.run({
    agentId: agent.id,
    approvalMode: 'auto',
    action: 'chat.message',
    toolName: 'chat.respond',
    toolArguments: {
      agentId: agent.id,
      message: input.body.message,
      meta: {
        ...(isRecord(input.body.meta) ? input.body.meta : {}),
        ...(input.streamRequestId ? { streamRequestId: input.streamRequestId } : {})
      },
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

async function runSlashCommand(input: {
  agent: Awaited<ReturnType<AgentService['getAgentById']>>;
  body: ChatRequestBody;
  deps: AgentModuleDeps;
  actorId: string;
  parsedCommand: Exclude<ParsedSlashEntry, null>;
  streamRequestId?: string;
}): Promise<ProcessedChatResult> {
  const registry = buildAgentSlashRegistry();
  const helpText = registry.buildHelpText(input.agent.level);
  const { entry } = input.parsedCommand;

  if (!entry) {
    const founderMessage = await createFounderMessage({
      agentId: input.agent.id,
      body: input.body,
      slashCommand: 'unknown',
      inboxService: input.deps.inboxService
    });

    return createDirectChatReply({
      agent: input.agent,
      founderMessage,
      deps: input.deps,
      actorId: input.actorId,
      auditAction: 'agent.chat.command.invalid',
      replyText: `Unknown command \`${input.parsedCommand.raw}\`.\n\n${helpText}`,
      messageType: 'alert'
    });
  }

  if (entry.kind === 'tool') {
    const { args } = input.parsedCommand;

    if (args.trim().length === 0) {
      const founderMessage = await createFounderMessage({
        agentId: input.agent.id,
        body: input.body,
        slashCommand: entry.name,
        inboxService: input.deps.inboxService
      });

      return createDirectChatReply({
        agent: input.agent,
        founderMessage,
        deps: input.deps,
        actorId: input.actorId,
        auditAction: `${entry.auditAction}.usage`,
        replyText: `Usage: ${entry.usage}\n\n${helpText}`,
        messageType: 'alert'
      });
    }

    const founderMessage = await createFounderMessage({
      agentId: input.agent.id,
      body: input.body,
      slashCommand: entry.name,
      inboxService: input.deps.inboxService
    });
    const conversationHistory = await input.deps.inboxService.listConversation(input.agent.id, 12);

    const runResult = await input.deps.agentRunner.run({
      agentId: input.agent.id,
      approvalMode: 'auto',
      action: `chat.command.${entry.name}`,
      toolName: 'chat.respond',
      toolArguments: {
        agentId: input.agent.id,
        message: args,
        meta: {
          ...(isRecord(input.body.meta) ? input.body.meta : {}),
          slashCommand: entry.name,
          toolCall: { toolName: entry.toolName, arguments: entry.buildArguments(args) },
          ...(input.streamRequestId ? { streamRequestId: input.streamRequestId } : {})
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
      auditAction: entry.auditAction
    });
  }

  const builtinResult = entry.execute(input.parsedCommand.args, helpText);

  if (builtinResult.resetConversation) {
    await input.deps.inboxService.clearConversation(input.agent.id);
  }

  if (builtinResult.resetMemory) {
    await input.deps.agentRunner.clearMemory(input.agent.id);
  }

  const founderMessage = builtinResult.persistFounderMessage === false
    ? createEphemeralFounderMessage(input.agent.id, input.body.message)
    : await createFounderMessage({
        agentId: input.agent.id,
        body: input.body,
        slashCommand: entry.name,
        inboxService: input.deps.inboxService
      });

  return createDirectChatReply({
    agent: input.agent,
    founderMessage,
    deps: input.deps,
    actorId: input.actorId,
    auditAction: builtinResult.auditAction,
    replyText: builtinResult.replyText,
    messageType: builtinResult.messageType
  });
}

async function createFounderMessage(input: {
  agentId: string;
  body: ChatRequestBody;
  slashCommand: string | null;
  inboxService: InboxService;
}): Promise<Awaited<ReturnType<InboxService['createMessage']>>> {
  return input.inboxService.createMessage({
    recipientId: input.agentId,
    senderId: 'founder',
    type: 'info',
    title: buildChatTitle(input.body.message),
    body: input.body.message,
    payload: {
      channel: 'chat',
      meta: input.body.meta ?? null,
      ...(input.slashCommand ? { slashCommand: input.slashCommand } : {})
    }
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

  const replyMessage = await input.deps.inboxService.createMessage({
    recipientId: 'founder',
    senderId: input.agent.id,
    type: resolveReplyMessageType(input.runResult.status, normalizedOutput.toolCalls),
    title: `Reply from ${input.agent.name}`,
    body: replyText,
    payload: {
      channel: 'chat',
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
      channel: 'chat',
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

function resolveReplyMessageType(
  status: Awaited<ReturnType<AgentRunner['run']>>['status'],
  toolCalls: ChatToolCall[]
): 'alert' | 'info' | 'report' {
  if (status === 'blocked') {
    return 'alert';
  }

  if (toolCalls.some((toolCall) => !toolCall.ok)) {
    return 'alert';
  }

  return toolCalls.length > 0 ? 'report' : 'info';
}

function normalizeChatOutput(output: unknown): {
  reply: string;
  toolCalls: ChatToolCall[];
  task: unknown | null;
  project: unknown | null;
} {
  if (!isRecord(output)) {
    return {
      reply: '',
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
        : '',
    toolCalls,
    task: 'task' in output ? output.task ?? null : null,
    project: 'project' in output ? output.project ?? null : null
  };
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

function toConversationHistoryEntry(message: Awaited<ReturnType<InboxService['createMessage']>>): {
  senderId: string;
  title: string;
  body: string;
  createdAt: string;
  toolCalls?: Array<{
    toolName: string;
    ok: boolean;
    summary: string;
    outputJson?: string;
    error?: {
      code?: string;
      message: string;
    };
  }>;
} {
  const toolCalls = readToolCallsFromPayload(message.payload);

  return {
    senderId: message.senderId,
    title: message.title,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    ...(toolCalls.length > 0 ? { toolCalls } : {})
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

export function buildChatTitle(message: string): string {
  const compact = message.replace(/\s+/g, ' ').trim();
  if (compact.length <= 56) {
    return compact;
  }

  return `${compact.slice(0, 53).trimEnd()}...`;
}

export function sendSocketEvent(
  socket: { send: (payload: string) => void },
  type: string,
  payload: Record<string, unknown>
): void {
  socket.send(JSON.stringify({ type, payload }));
}

export function resolveSocketClient(connection: {
  socket?: {
    send: (payload: string) => void;
    close: () => void;
    on: (event: string, listener: (payload: unknown) => void) => void;
  };
  send?: (payload: string) => void;
  close?: () => void;
  on?: (event: string, listener: (payload: unknown) => void) => void;
}): ChatSocketClient {
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
  }
}

export function chunkReply(reply: string): string[] {
  if (reply.length === 0) {
    return [''];
  }

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < reply.length) {
    const remaining = reply.slice(cursor);
    if (remaining.length <= 56) {
      chunks.push(remaining);
      break;
    }

    let take = 56;
    const window = remaining.slice(0, take);
    const newlineIndex = window.lastIndexOf('\n');
    if (newlineIndex > 0) {
      take = newlineIndex + 1;
    } else {
      const spaceIndex = window.lastIndexOf(' ');
      if (spaceIndex > 20) {
        take = spaceIndex + 1;
      }
    }

    chunks.push(remaining.slice(0, take));
    cursor += take;
  }

  return chunks;
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'The executive chat request could not be processed.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readToolCallsFromPayload(payload: Record<string, unknown> | undefined): Array<{
  toolName: string;
  ok: boolean;
  summary: string;
  outputJson?: string;
  error?: {
    code?: string;
    message: string;
  };
}> {
  if (!isRecord(payload) || !Array.isArray(payload.toolCalls)) {
    return [];
  }

  return payload.toolCalls
    .map((entry) => normalizeHistoryToolCall(entry))
    .filter((entry): entry is {
      toolName: string;
      ok: boolean;
      summary: string;
      outputJson?: string;
      error?: {
        code?: string;
        message: string;
      };
    } => entry !== null);
}

function normalizeHistoryToolCall(value: unknown): {
  toolName: string;
  ok: boolean;
  summary: string;
  outputJson?: string;
  error?: {
    code?: string;
    message: string;
  };
} | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.toolName !== 'string' || typeof value.ok !== 'boolean' || typeof value.summary !== 'string') {
    return null;
  }

  const error = isRecord(value.error) && typeof value.error.message === 'string'
    ? {
        message: value.error.message,
        ...(typeof value.error.code === 'string' ? { code: value.error.code } : {})
      }
    : undefined;
  const outputJson = toJsonString(value.output);

  return {
    toolName: value.toolName,
    ok: value.ok,
    summary: value.summary,
    ...(outputJson ? { outputJson } : {}),
    ...(error ? { error } : {})
  };
}

function toJsonString(value: unknown, maxLength = 2_000): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    const serialized = JSON.stringify(value);
    if (!serialized) {
      return undefined;
    }

    return serialized.length > maxLength
      ? `${serialized.slice(0, Math.max(maxLength - 1, 0)).trimEnd()}…`
      : serialized;
  } catch {
    return undefined;
  }
}
