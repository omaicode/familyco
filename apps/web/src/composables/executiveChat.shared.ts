import type { AgentChatMessage, ChatAttachmentItem } from '@familyco/ui';

import { uiRuntime } from '../runtime';

export interface ChatSocketEvent {
  type: string;
  payload?: Record<string, unknown>;
}

export interface ChatToolCallDetails {
  toolName: string;
  ok: boolean;
  summary: string;
  error?: {
    code?: string;
    message?: string;
  };
}

export interface ChatToolInProgress {
  toolName: string;
  startedAt: string;
}

export interface ChatConfirmRequest {
  question: string;
  options: string[];
}

export interface DraftChatAttachment extends ChatAttachmentItem {
  localId: string;
  uploadState: 'uploading' | 'uploaded' | 'failed';
  errorText?: string;
}

export type ThreadMessage = AgentChatMessage & {
  payload?: {
    taskId?: string;
    projectId?: string;
    toolCalls?: ChatToolCallDetails[];
    toolsInProgress?: ChatToolInProgress[];
    attachments?: ChatAttachmentItem[];
    confirmRequest?: ChatConfirmRequest;
    resuming?: boolean;
    [key: string]: unknown;
  };
};

export type ChatConnectionState = 'connecting' | 'connected' | 'disconnected';
export type ChatFeedback = { type: 'success' | 'error' | 'info'; text: string } | null;

export function sortThread(messages: ThreadMessage[]): ThreadMessage[] {
  return [...messages].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isToolCallDetails(value: unknown): value is ChatToolCallDetails {
  return isRecord(value)
    && typeof value.toolName === 'string'
    && typeof value.ok === 'boolean'
    && typeof value.summary === 'string';
}

export function isChatConfirmRequest(value: unknown): value is ChatConfirmRequest {
  return isRecord(value)
    && typeof value.question === 'string'
    && Array.isArray(value.options)
    && (value.options as unknown[]).every((o) => typeof o === 'string');
}

export function isChatAttachmentItem(value: unknown): value is ChatAttachmentItem {
  return isRecord(value)
    && typeof value.id === 'string'
    && (value.kind === 'file' || value.kind === 'audio')
    && typeof value.name === 'string'
    && typeof value.mediaType === 'string'
    && typeof value.sizeBytes === 'number'
    && typeof value.storageKey === 'string'
    && typeof value.createdAt === 'string';
}

export function formatToolFeedback(toolCall: ChatToolCallDetails): string {
  if (toolCall.ok) {
    return `Tool ${toolCall.toolName}: ${toolCall.summary}`;
  }

  const errorMessage = typeof toolCall.error?.message === 'string' && toolCall.error.message.trim().length > 0
    ? toolCall.error.message.trim()
    : toolCall.summary;
  const errorCode = typeof toolCall.error?.code === 'string' && toolCall.error.code.trim().length > 0
    ? ` (${toolCall.error.code.trim()})`
    : '';

  return `Tool ${toolCall.toolName} failed${errorCode}: ${errorMessage}`;
}

export function buildChatTitle(message: string): string {
  const compact = message.replace(/\s+/g, ' ').trim();
  if (compact.length <= 56) {
    return compact;
  }

  return `${compact.slice(0, 53).trimEnd()}...`;
}

export function buildChatAttachmentUrl(agentId: string, attachmentId: string): string {
  const url = new URL(`/api/v1/agents/${agentId}/chat/attachments/${attachmentId}`, uiRuntime.stores.app.state.connection.baseURL);
  const runtimeApiKey = window.familycoDesktopConfig?.apiKey?.trim() || import.meta.env.VITE_API_KEY?.trim();
  if (runtimeApiKey) {
    url.searchParams.set('apiKey', runtimeApiKey);
  }

  return url.toString();
}

export function formatAttachmentSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const units = ['KB', 'MB', 'GB'];
  let value = sizeBytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
