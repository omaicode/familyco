import type { AgentChatMessage } from '@familyco/ui';

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

export type ThreadMessage = AgentChatMessage & {
  payload?: {
    taskId?: string;
    projectId?: string;
    toolCalls?: ChatToolCallDetails[];
    toolsInProgress?: ChatToolInProgress[];
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
