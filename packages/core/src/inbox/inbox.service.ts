import type {
  CreateInboxMessageInput,
  InboxMessage,
  InboxMessageStatus,
  ListInboxMessagesQuery
} from './inbox.entity.js';

export interface InboxRepository {
  create(input: CreateInboxMessageInput): Promise<InboxMessage>;
  findById(id: string): Promise<InboxMessage | null>;
  list(query: ListInboxMessagesQuery): Promise<InboxMessage[]>;
  updateStatus(id: string, status: InboxMessageStatus): Promise<InboxMessage>;
  clearConversation(agentId: string, founderId?: string): Promise<void>;
}

export class InboxService {
  constructor(private readonly repository: InboxRepository) {}

  createMessage(input: CreateInboxMessageInput): Promise<InboxMessage> {
    return this.repository.create(input);
  }

  listMessages(query: ListInboxMessagesQuery): Promise<InboxMessage[]> {
    return this.repository.list(query);
  }

  async listConversation(agentId: string, limit = 200, founderId = 'founder'): Promise<InboxMessage[]> {
    const [inboundToAgent, founderInbox] = await Promise.all([
      this.repository.list({ recipientId: agentId }),
      this.repository.list({ recipientId: founderId, senderId: agentId })
    ]);

    return [...inboundToAgent, ...founderInbox]
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .slice(-Math.max(limit, 0));
  }

  async clearConversation(agentId: string, founderId = 'founder'): Promise<void> {
    await this.repository.clearConversation(agentId, founderId);
  }

  async markRead(id: string): Promise<InboxMessage> {
    return this.repository.updateStatus(id, 'read');
  }

  async archive(id: string): Promise<InboxMessage> {
    return this.repository.updateStatus(id, 'archived');
  }
}
