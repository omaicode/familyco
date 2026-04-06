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

  async listMessages(query: ListInboxMessagesQuery): Promise<InboxMessage[]> {
    const messages = await this.repository.list(query);

    if (query.recipientId !== 'founder') {
      return messages;
    }

    return messages.filter(shouldIncludeInFounderInbox);
  }

  async listConversation(
    agentId: string,
    limit = 200,
    founderId = 'founder',
    before?: Date
  ): Promise<InboxMessage[]> {
    const [inboundToAgent, founderInbox] = await Promise.all([
      this.repository.list({ recipientId: agentId }),
      this.repository.list({ recipientId: founderId, senderId: agentId })
    ]);

    const beforeTimestamp = before?.getTime();

    return [...inboundToAgent, ...founderInbox]
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .filter((message) => beforeTimestamp === undefined || message.createdAt.getTime() < beforeTimestamp)
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

function shouldIncludeInFounderInbox(message: InboxMessage): boolean {
  if (isChatConversationMessage(message)) {
    return false;
  }

  if (message.type === 'approval') {
    return true;
  }

  if (message.senderId === 'founder') {
    return false;
  }

  return isTaskRelatedInboxMessage(message);
}

function isChatConversationMessage(message: InboxMessage): boolean {
  if (message.title.startsWith('Reply from ')) {
    return true;
  }

  const payload = message.payload ?? {};
  return payload.channel === 'chat' || Array.isArray(payload.toolCalls);
}

function isTaskRelatedInboxMessage(message: InboxMessage): boolean {
  const payload = message.payload ?? {};
  const taskId = typeof payload.taskId === 'string' ? payload.taskId : null;
  const targetId = typeof payload.targetId === 'string' ? payload.targetId.toLowerCase() : '';
  const action = typeof payload.action === 'string' ? payload.action.toLowerCase() : '';
  const toolName = typeof payload.toolName === 'string' ? payload.toolName.toLowerCase() : '';
  const body = message.body.toLowerCase();
  const title = message.title.toLowerCase();

  return Boolean(
    taskId
    || targetId.startsWith('task')
    || action.includes('task')
    || toolName.includes('task')
    || body.includes('task')
    || title.includes('task')
  );
}
