export type InboxMessageType = 'approval' | 'report' | 'alert' | 'info';
export type InboxMessageStatus = 'unread' | 'read' | 'archived';

export interface InboxMessage {
  id: string;
  recipientId: string;
  senderId: string;
  type: InboxMessageType;
  title: string;
  body: string;
  status: InboxMessageStatus;
  payload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInboxMessageInput {
  recipientId: string;
  senderId: string;
  type: InboxMessageType;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
}

export interface UpdateInboxMessageInput {
  title?: string;
  body?: string;
  payload?: Record<string, unknown>;
}

export interface ListInboxMessagesQuery {
  recipientId: string;
  senderId?: string;
  type?: InboxMessageType;
  status?: InboxMessageStatus;
  limit?: number;
  offset?: number;
}
