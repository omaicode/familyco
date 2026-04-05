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
}

export class InboxService {
  constructor(private readonly repository: InboxRepository) {}

  createMessage(input: CreateInboxMessageInput): Promise<InboxMessage> {
    return this.repository.create(input);
  }

  listMessages(query: ListInboxMessagesQuery): Promise<InboxMessage[]> {
    return this.repository.list(query);
  }

  async markRead(id: string): Promise<InboxMessage> {
    return this.repository.updateStatus(id, 'read');
  }

  async archive(id: string): Promise<InboxMessage> {
    return this.repository.updateStatus(id, 'archived');
  }
}
