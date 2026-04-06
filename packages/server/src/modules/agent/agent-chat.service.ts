import { randomUUID } from 'node:crypto';

import type { AgentRunner, AgentService, InboxService, ToolExecutionResult } from '@familyco/core';

import { buildSlashCommandHelp, parseSlashCommand } from './slash-commands/index.js';
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

export async function processAgentChat(input: {
  agentId: string;
  body: ChatRequestBody;
  deps: AgentModuleDeps;
  actorId: string;
}): Promise<ProcessedChatResult> {
  const agent = await input.deps.agentService.getAgentById(input.agentId);
  const parsedCommand = parseSlashCommand(input.body.message);

  if (parsedCommand) {
    return runSlashCommand({
      agent,
      body: input.body,
      deps: input.deps,
      actorId: input.actorId,
      parsedCommand
    });
  }

  const founderMessage = await createFounderMessage({
    agentId: agent.id,
    body: input.body,
    slashCommand: null,
    inboxService: input.deps.inboxService
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

async function runSlashCommand(input: {
  agent: Awaited<ReturnType<AgentService['getAgentById']>>;
  body: ChatRequestBody;
  deps: AgentModuleDeps;
  actorId: string;
  parsedCommand: ReturnType<typeof parseSlashCommand> extends infer T ? Exclude<T, null> : never;
}): Promise<ProcessedChatResult> {
  const helpText = buildSlashCommandHelp();

  if (!input.parsedCommand.definition) {
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

  const commandResult = await input.parsedCommand.definition.execute({
    args: input.parsedCommand.args,
    helpText
  });

  if (commandResult.kind === 'tool') {
    const founderMessage = await createFounderMessage({
      agentId: input.agent.id,
      body: input.body,
      slashCommand: input.parsedCommand.definition.name,
      inboxService: input.deps.inboxService
    });
    const conversationHistory = await input.deps.inboxService.listConversation(input.agent.id, 24);

    const runResult = await input.deps.agentRunner.run({
      agentId: input.agent.id,
      approvalMode: 'auto',
      action: commandResult.action,
      toolName: 'chat.respond',
      toolArguments: {
        agentId: input.agent.id,
        message: commandResult.input,
        meta: {
          ...(isRecord(input.body.meta) ? input.body.meta : {}),
          slashCommand: input.parsedCommand.definition.name,
          toolCall: commandResult.toolCall
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
      auditAction: commandResult.auditAction
    });
  }

  if (commandResult.resetConversation) {
    await input.deps.inboxService.clearConversation(input.agent.id);
  }

  if (commandResult.resetMemory) {
    await input.deps.agentRunner.clearMemory(input.agent.id);
  }

  const founderMessage = commandResult.persistFounderMessage === false
    ? createEphemeralFounderMessage(input.agent.id, input.body.message)
    : await createFounderMessage({
        agentId: input.agent.id,
        body: input.body,
        slashCommand: input.parsedCommand.definition.name,
        inboxService: input.deps.inboxService
      });

  return createDirectChatReply({
    agent: input.agent,
    founderMessage,
    deps: input.deps,
    actorId: input.actorId,
    auditAction: commandResult.auditAction,
    replyText: commandResult.replyText,
    messageType: commandResult.messageType
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

function chunkReply(reply: string): string[] {
  const compact = reply.replace(/\s+/g, ' ').trim();
  if (compact.length === 0) {
    return [''];
  }

  const words = compact.split(' ');
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length > 56 && current.length > 0) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
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
