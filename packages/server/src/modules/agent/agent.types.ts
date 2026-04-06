import type {
  ApprovalGuard,
  AgentRunner,
  AgentService,
  ApprovalService,
  AuditService,
  InboxService
} from '@familyco/core';

export interface ChatToolCall {
  toolName: string;
  ok: boolean;
  summary: string;
  output?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export interface ProcessedChatResult {
  founderMessage: Awaited<ReturnType<InboxService['createMessage']>>;
  replyMessage: Awaited<ReturnType<InboxService['createMessage']>>;
  reply: string;
  toolCalls: ChatToolCall[];
  task: unknown | null;
  project: unknown | null;
}

export interface ChatRequestMeta {
  projectId?: string;
  taskId?: string;
  toolCall?: unknown;
  toolCalls?: unknown[];
  [key: string]: unknown;
}

export interface ChatRequestBody {
  message: string;
  meta?: ChatRequestMeta;
}

export interface AgentModuleDeps {
  agentService: AgentService;
  inboxService: InboxService;
  approvalService: ApprovalService;
  auditService: AuditService;
  approvalGuard: ApprovalGuard;
  agentRunner: AgentRunner;
}

export interface ChatSocketClient {
  send: (payload: string) => void;
  close: () => void;
  on: (event: string, listener: (payload: unknown) => void) => void;
}
