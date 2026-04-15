import type {
  ChatMessage,
  ChatSession,
  CreateChatMessageInput,
  CreateChatSessionInput,
  UpdateChatMessageInput
} from './chat-conversation.types.js';

const DEFAULT_FOUNDER_ID = 'founder';
const DEFAULT_SESSION_TITLE = 'New chat';

export interface ChatConversationRepository {
  listSessions(agentId: string, founderId: string, limit?: number): Promise<ChatSession[]>;
  findSessionById(id: string): Promise<ChatSession | null>;
  findLatestSession(agentId: string, founderId: string): Promise<ChatSession | null>;
  createSession(input: CreateChatSessionInput): Promise<ChatSession>;
  updateSession(
    id: string,
    input: { title?: string; lastMessageAt?: Date }
  ): Promise<ChatSession>;
  listMessages(input: {
    sessionId: string;
    limit?: number;
    before?: Date;
  }): Promise<ChatMessage[]>;
  createMessage(input: CreateChatMessageInput): Promise<ChatMessage>;
  findMessageById(id: string): Promise<ChatMessage | null>;
  updateMessage(id: string, input: UpdateChatMessageInput): Promise<ChatMessage>;
  countMessages(input: { sessionId: string; senderId?: string }): Promise<number>;
  deleteMessagesAfter(sessionId: string, after: Date): Promise<void>;
  clearSessionMessages(sessionId: string): Promise<void>;
}

export class ChatConversationService {
  constructor(private readonly repository: ChatConversationRepository) {}

  async listSessions(agentId: string, founderId = DEFAULT_FOUNDER_ID, limit = 50): Promise<ChatSession[]> {
    return this.repository.listSessions(agentId, founderId, limit);
  }

  async createSession(input: CreateChatSessionInput): Promise<ChatSession> {
    return this.repository.createSession({
      ...input,
      founderId: input.founderId ?? DEFAULT_FOUNDER_ID,
      title: normalizeSessionTitle(input.title)
    });
  }

  async resolveSessionForWrite(input: {
    agentId: string;
    founderId?: string;
    sessionId?: string;
  }): Promise<ChatSession> {
    const founderId = input.founderId ?? DEFAULT_FOUNDER_ID;
    if (input.sessionId) {
      const found = await this.repository.findSessionById(input.sessionId);
      if (!found) {
        throw new Error(`CHAT_SESSION_NOT_FOUND:${input.sessionId}`);
      }

      if (found.agentId !== input.agentId || found.founderId !== founderId) {
        throw new Error(`CHAT_SESSION_INVALID:${input.sessionId}`);
      }

      return found;
    }

    const latest = await this.repository.findLatestSession(input.agentId, founderId);
    if (latest) {
      return latest;
    }

    return this.repository.createSession({
      agentId: input.agentId,
      founderId,
      title: DEFAULT_SESSION_TITLE
    });
  }

  async getSessionById(id: string): Promise<ChatSession | null> {
    return this.repository.findSessionById(id);
  }

  async updateSession(input: {
    id: string;
    title?: string;
    lastMessageAt?: Date;
  }): Promise<ChatSession> {
    return this.repository.updateSession(input.id, {
      ...(input.title !== undefined ? { title: normalizeSessionTitle(input.title) } : {}),
      ...(input.lastMessageAt ? { lastMessageAt: input.lastMessageAt } : {})
    });
  }

  async listConversation(input: {
    agentId: string;
    founderId?: string;
    sessionId?: string;
    limit?: number;
    before?: Date;
  }): Promise<{ session: ChatSession | null; messages: ChatMessage[] }> {
    const founderId = input.founderId ?? DEFAULT_FOUNDER_ID;
    const session = input.sessionId
      ? await this.resolveSessionForRead({
          sessionId: input.sessionId,
          agentId: input.agentId,
          founderId
        })
      : await this.repository.findLatestSession(input.agentId, founderId);

    if (!session) {
      return { session: null, messages: [] };
    }

    const messages = await this.repository.listMessages({
      sessionId: session.id,
      limit: input.limit,
      ...(input.before ? { before: input.before } : {})
    });

    return { session, messages };
  }

  async listMessages(input: {
    sessionId: string;
    limit?: number;
    before?: Date;
  }): Promise<ChatMessage[]> {
    return this.repository.listMessages(input);
  }

  async countMessages(input: { sessionId: string; senderId?: string }): Promise<number> {
    return this.repository.countMessages(input);
  }

  async createMessage(input: CreateChatMessageInput): Promise<ChatMessage> {
    return this.repository.createMessage(input);
  }

  async findMessageById(id: string): Promise<ChatMessage | null> {
    return this.repository.findMessageById(id);
  }

  async updateMessage(id: string, input: UpdateChatMessageInput): Promise<ChatMessage> {
    return this.repository.updateMessage(id, input);
  }

  async deleteMessagesAfter(sessionId: string, after: Date): Promise<void> {
    await this.repository.deleteMessagesAfter(sessionId, after);
  }

  async clearSession(sessionId: string): Promise<void> {
    await this.repository.clearSessionMessages(sessionId);
  }

  private async resolveSessionForRead(input: {
    sessionId: string;
    agentId: string;
    founderId: string;
  }): Promise<ChatSession | null> {
    const found = await this.repository.findSessionById(input.sessionId);
    if (!found) {
      throw new Error(`CHAT_SESSION_NOT_FOUND:${input.sessionId}`);
    }

    if (found.agentId !== input.agentId || found.founderId !== input.founderId) {
      throw new Error(`CHAT_SESSION_INVALID:${input.sessionId}`);
    }

    return found;
  }
}

function normalizeSessionTitle(title: string | undefined): string {
  const trimmed = title?.trim() ?? '';
  if (trimmed.length === 0) {
    return DEFAULT_SESSION_TITLE;
  }

  return trimmed.length > 96 ? `${trimmed.slice(0, 93).trimEnd()}...` : trimmed;
}
