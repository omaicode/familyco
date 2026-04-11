import type { AgentService, AuditService, InboxService } from '@familyco/core';
import type { ChatEngineResult } from './chat-engine.service.js';
import type { ChatToolCall, ProcessedChatResult } from './agent.types.js';
import type { ChatAttachmentRecord } from './chat-attachment-store.js';

export async function buildProcessedChatResult(input: {
  agent: Awaited<ReturnType<AgentService['getAgentById']>>;
  founderMessage: Awaited<ReturnType<InboxService['createMessage']>>;
  engineResult: ChatEngineResult;
  inboxService: InboxService;
  auditService: AuditService;
  actorId: string;
  auditAction: string;
}): Promise<ProcessedChatResult> {
  const { reply, toolCalls, task, project, confirmRequest } = input.engineResult;

  const replyMessage = await input.inboxService.createMessage({
    recipientId: 'founder',
    senderId: input.agent.id,
    type: resolveReplyMessageType(toolCalls),
    title: `Reply from ${input.agent.name}`,
    body: reply,
    payload: {
      channel: 'chat',
      taskId: extractEntityId(task),
      projectId: extractEntityId(project),
      toolCalls
    }
  });

  await input.auditService.write({
    actorId: input.actorId,
    action: input.auditAction,
    targetId: input.agent.id,
    payload: {
      founderMessageId: input.founderMessage.id,
      replyMessageId: replyMessage.id,
      toolNames: toolCalls.map((tc) => tc.toolName),
      taskId: extractEntityId(task),
      projectId: extractEntityId(project)
    }
  });

  return { founderMessage: input.founderMessage, replyMessage, reply, toolCalls, task, project, confirmRequest };
}

export async function createDirectChatReply(input: {
  agent: Awaited<ReturnType<AgentService['getAgentById']>>;
  founderMessage: Awaited<ReturnType<InboxService['createMessage']>>;
  inboxService: InboxService;
  auditService: AuditService;
  actorId: string;
  auditAction: string;
  replyText: string;
  messageType: 'alert' | 'info' | 'report';
}): Promise<ProcessedChatResult> {
  const replyMessage = await input.inboxService.createMessage({
    recipientId: 'founder',
    senderId: input.agent.id,
    type: input.messageType,
    title: `Reply from ${input.agent.name}`,
    body: input.replyText,
    payload: { channel: 'chat', toolCalls: [] }
  });

  await input.auditService.write({
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
    project: null,
    confirmRequest: undefined
  };
}

export async function createFounderMessage(input: {
  agentId: string;
  body: string;
  meta?: Record<string, unknown> | null;
  attachments?: ChatAttachmentRecord[];
  editedFromMessageId?: string;
  supersedesMessageId?: string;
  slashCommand: string | null;
  inboxService: InboxService;
}): Promise<Awaited<ReturnType<InboxService['createMessage']>>> {
  return input.inboxService.createMessage({
    recipientId: input.agentId,
    senderId: 'founder',
    type: 'info',
    title: buildChatTitle(input.body),
    body: input.body,
    payload: {
      channel: 'chat',
      meta: input.meta ?? null,
      ...(input.attachments && input.attachments.length > 0 ? { attachments: input.attachments } : {}),
      ...(input.editedFromMessageId ? { editedFromMessageId: input.editedFromMessageId } : {}),
      ...(input.supersedesMessageId ? { supersedesMessageId: input.supersedesMessageId } : {}),
      ...(input.slashCommand ? { slashCommand: input.slashCommand } : {})
    }
  });
}

export function createEphemeralFounderMessage(
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

export function toConversationHistoryEntry(message: Awaited<ReturnType<InboxService['createMessage']>>): {
  senderId: string;
  title: string;
  body: string;
  createdAt: string;
  toolCalls?: Array<{
    toolName: string;
    ok: boolean;
    summary: string;
    outputJson?: string;
    error?: { code?: string; message: string };
  }>;
} {
  const toolCalls = readToolCallsFromPayload(message.payload);
  const transcriptText = readAttachmentTranscriptText(message.payload);
  const body = [message.body, transcriptText].filter((value) => value.trim().length > 0).join('\n\n').trim();
  return {
    senderId: message.senderId,
    title: message.title,
    body,
    createdAt: message.createdAt.toISOString(),
    ...(toolCalls.length > 0 ? { toolCalls } : {})
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
  socket?: { send: (p: string) => void; close: () => void; on: (e: string, l: (p: unknown) => void) => void };
  send?: (payload: string) => void;
  close?: () => void;
  on?: (event: string, listener: (payload: unknown) => void) => void;
}): { send: (p: string) => void; close: () => void; on: (e: string, l: (p: unknown) => void) => void } {
  if (connection.socket) {
    return connection.socket;
  }

  return {
    send: connection.send?.bind(connection) ?? (() => undefined),
    close: connection.close?.bind(connection) ?? (() => undefined),
    on: connection.on?.bind(connection) ?? (() => undefined)
  };
}

export async function streamReply(
  socket: { send: (payload: string) => void },
  requestId: string,
  reply: string
): Promise<void> {
  const chunks = chunkReply(reply);

  for (let index = 0; index < chunks.length; index += 1) {
    sendSocketEvent(socket, 'chat.chunk', { requestId, index, chunk: chunks[index] });
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

function resolveReplyMessageType(toolCalls: ChatToolCall[]): 'alert' | 'info' | 'report' {
  if (toolCalls.some((tc) => !tc.ok)) {
    return 'alert';
  }

  return toolCalls.length > 0 ? 'report' : 'info';
}

function extractEntityId(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' ? record.id : undefined;
}

function readAttachmentTranscriptText(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('attachments' in payload)) {
    return '';
  }

  const attachments = (payload as { attachments?: unknown }).attachments;
  if (!Array.isArray(attachments)) {
    return '';
  }

  return attachments
    .flatMap((attachment) => {
      if (typeof attachment !== 'object' || attachment === null) {
        return [];
      }

      const transcript = 'transcript' in attachment && typeof attachment.transcript === 'string'
        ? attachment.transcript.trim()
        : '';
      const name = 'name' in attachment && typeof attachment.name === 'string'
        ? attachment.name.trim()
        : 'audio attachment';

      return transcript.length > 0 ? [`Transcript for ${name}:\n${transcript}`] : [];
    })
    .join('\n\n');
}

function readToolCallsFromPayload(payload: Record<string, unknown> | undefined): Array<{
  toolName: string;
  ok: boolean;
  summary: string;
  outputJson?: string;
  error?: { code?: string; message: string };
}> {
  if (typeof payload !== 'object' || payload === null || !Array.isArray(payload.toolCalls)) {
    return [];
  }

  return payload.toolCalls
    .map(normalizeHistoryToolCall)
    .filter((entry): entry is NonNullable<ReturnType<typeof normalizeHistoryToolCall>> => entry !== null);
}

function normalizeHistoryToolCall(value: unknown): {
  toolName: string;
  ok: boolean;
  summary: string;
  outputJson?: string;
  error?: { code?: string; message: string };
} | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.toolName !== 'string' ||
    typeof record.ok !== 'boolean' ||
    typeof record.summary !== 'string'
  ) {
    return null;
  }

  const errorRecord = typeof record.error === 'object' && record.error !== null
    ? record.error as Record<string, unknown>
    : null;
  const error = errorRecord && typeof errorRecord.message === 'string'
    ? {
        message: errorRecord.message,
        ...(typeof errorRecord.code === 'string' ? { code: errorRecord.code } : {})
      }
    : undefined;

  const outputJson = toJsonString(record.output);

  return {
    toolName: record.toolName,
    ok: record.ok,
    summary: record.summary,
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
