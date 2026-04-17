export type ChatMessageType = 'approval' | 'report' | 'alert' | 'info';

export interface ChatSession {
  id: string;
  agentId: string;
  founderId: string;
  title: string;
  lastMessageAt: Date;
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  recipientId: string;
  type: ChatMessageType;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChatSessionInput {
  agentId: string;
  founderId?: string;
  title?: string;
  summary?: string;
}

export interface CreateChatMessageInput {
  sessionId: string;
  senderId: string;
  recipientId: string;
  type: ChatMessageType;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
}

export interface UpdateChatMessageInput {
  title?: string;
  body?: string;
  payload?: Record<string, unknown>;
}
