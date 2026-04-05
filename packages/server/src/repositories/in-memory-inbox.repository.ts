import { randomUUID } from 'node:crypto';

import type {
  CreateInboxMessageInput,
  InboxMessage,
  InboxMessageStatus,
  InboxRepository,
  ListInboxMessagesQuery
} from '@familyco/core';

export class InMemoryInboxRepository implements InboxRepository {
  private readonly messages: InboxMessage[] = [];

  async create(input: CreateInboxMessageInput): Promise<InboxMessage> {
    const now = new Date();
    const message: InboxMessage = {
      id: randomUUID(),
      recipientId: input.recipientId,
      senderId: input.senderId,
      type: input.type,
      title: input.title,
      body: input.body,
      status: 'unread',
      payload: input.payload,
      createdAt: now,
      updatedAt: now
    };

    this.messages.push(message);
    return message;
  }

  async findById(id: string): Promise<InboxMessage | null> {
    return this.messages.find((item) => item.id === id) ?? null;
  }

  async list(query: ListInboxMessagesQuery): Promise<InboxMessage[]> {
    const filtered = this.messages.filter((message) => {
      if (message.recipientId !== query.recipientId) {
        return false;
      }

      if (query.type && message.type !== query.type) {
        return false;
      }

      if (query.status && message.status !== query.status) {
        return false;
      }

      return true;
    });

    const offset = query.offset ?? 0;
    const limit = query.limit ?? filtered.length;
    return filtered.slice(offset, offset + limit);
  }

  async updateStatus(id: string, status: InboxMessageStatus): Promise<InboxMessage> {
    const index = this.messages.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new Error(`INBOX_MESSAGE_NOT_FOUND:${id}`);
    }

    const updated: InboxMessage = {
      ...this.messages[index],
      status,
      updatedAt: new Date()
    };

    this.messages[index] = updated;
    return updated;
  }
}
