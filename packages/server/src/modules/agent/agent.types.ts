import type {
  ApprovalGuard,
  AgentRunner,
  AgentService,
  ApprovalService,
  AuditService,
  InboxService,
  ToolExecutor
} from '@familyco/core';
import type { ChatEngineService } from './chat-engine.service.js';
import type { ChatStreamRegistry } from './chat-stream-registry.js';
import type { ChatAttachmentStore } from './chat-attachment-store.js';
import type { ToolDefinitionSummary } from '../../tools/tool.types.js';

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
  confirmRequest?: { question: string; options: string[] };
}

export interface ChatRequestMeta {
  projectId?: string;
  taskId?: string;
  toolCall?: unknown;
  toolCalls?: unknown[];
  attachments?: Array<{ id: string }>;
  editedFromMessageId?: string;
  supersedesMessageId?: string;
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
  chatEngineService: ChatEngineService;
  toolExecutor: ToolExecutor;
  listTools: () => ToolDefinitionSummary[];
  chatStreamRegistry: ChatStreamRegistry;
  chatAttachmentStore: ChatAttachmentStore;
}

export interface ChatSocketClient {
  send: (payload: string) => void;
  close: () => void;
  on: (event: string, listener: (payload: unknown) => void) => void;
}
