import { randomUUID } from 'node:crypto';

import type {
  ChatMessage,
  ChatSession,
  CreateChatMessageInput,
  CreateChatSessionInput,
  UpdateChatMessageInput
} from '../modules/agent/chat-conversation.types.js';
import type { ChatConversationRepository } from '../modules/agent/chat-conversation.service.js';

export class InMemoryChatConversationRepository implements ChatConversationRepository {
  private readonly sessions: ChatSession[] = [];
  private readonly messages: ChatMessage[] = [];

  async listSessions(agentId: string, founderId: string, limit = 50): Promise<ChatSession[]> {
    return this.sessions
      .filter((session) => session.agentId === agentId && session.founderId === founderId)
      .sort((left, right) => right.lastMessageAt.getTime() - left.lastMessageAt.getTime())
      .slice(0, Math.max(0, limit));
  }

  async findSessionById(id: string): Promise<ChatSession | null> {
    return this.sessions.find((session) => session.id === id) ?? null;
  }

  async findLatestSession(agentId: string, founderId: string): Promise<ChatSession | null> {
    return this.sessions
      .filter((session) => session.agentId === agentId && session.founderId === founderId)
      .sort((left, right) => right.lastMessageAt.getTime() - left.lastMessageAt.getTime())[0] ?? null;
  }

  async createSession(input: CreateChatSessionInput): Promise<ChatSession> {
    const now = new Date();
    const created: ChatSession = {
      id: randomUUID(),
      agentId: input.agentId,
      founderId: input.founderId ?? 'founder',
      title: input.title ?? 'New chat',
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now
    };

    this.sessions.push(created);
    return created;
  }

  async updateSession(
    id: string,
    input: { title?: string; lastMessageAt?: Date }
  ): Promise<ChatSession> {
    const index = this.sessions.findIndex((session) => session.id === id);
    if (index < 0) {
      throw new Error(`CHAT_SESSION_NOT_FOUND:${id}`);
    }

    const current = this.sessions[index];
    const updated: ChatSession = {
      ...current,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.lastMessageAt ? { lastMessageAt: input.lastMessageAt } : {}),
      updatedAt: new Date()
    };

    this.sessions[index] = updated;
    return updated;
  }

  async listMessages(input: {
    sessionId: string;
    limit?: number;
    before?: Date;
  }): Promise<ChatMessage[]> {
    const beforeTimestamp = input.before?.getTime();
    const filtered = this.messages
      .filter((message) => message.sessionId === input.sessionId)
      .filter((message) => beforeTimestamp === undefined || message.createdAt.getTime() < beforeTimestamp)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

    const limit = input.limit ?? filtered.length;
    if (limit <= 0) {
      return [];
    }

    return filtered.slice(-limit);
  }

  async createMessage(input: CreateChatMessageInput): Promise<ChatMessage> {
    const sessionIndex = this.sessions.findIndex((session) => session.id === input.sessionId);
    if (sessionIndex < 0) {
      throw new Error(`CHAT_SESSION_NOT_FOUND:${input.sessionId}`);
    }

    const now = new Date();
    const created: ChatMessage = {
      id: randomUUID(),
      sessionId: input.sessionId,
      senderId: input.senderId,
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      body: input.body,
      ...(input.payload ? { payload: input.payload } : {}),
      createdAt: now,
      updatedAt: now
    };

    this.messages.push(created);
    this.sessions[sessionIndex] = {
      ...this.sessions[sessionIndex],
      lastMessageAt: created.createdAt,
      updatedAt: new Date()
    };

    return created;
  }

  async findMessageById(id: string): Promise<ChatMessage | null> {
    return this.messages.find((message) => message.id === id) ?? null;
  }

  async updateMessage(id: string, input: UpdateChatMessageInput): Promise<ChatMessage> {
    const index = this.messages.findIndex((message) => message.id === id);
    if (index < 0) {
      throw new Error(`CHAT_MESSAGE_NOT_FOUND:${id}`);
    }

    const current = this.messages[index];
    const updated: ChatMessage = {
      ...current,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
      updatedAt: new Date()
    };

    this.messages[index] = updated;
    return updated;
  }

  async countMessages(input: { sessionId: string; senderId?: string }): Promise<number> {
    return this.messages.filter((message) => {
      if (message.sessionId !== input.sessionId) {
        return false;
      }

      if (input.senderId && message.senderId !== input.senderId) {
        return false;
      }

      return true;
    }).length;
  }

  async deleteMessagesAfter(sessionId: string, after: Date): Promise<void> {
    const afterTimestamp = after.getTime();
    const remaining = this.messages.filter((message) => {
      if (message.sessionId !== sessionId) {
        return true;
      }

      return message.createdAt.getTime() <= afterTimestamp;
    });

    this.messages.splice(0, this.messages.length, ...remaining);
    this.touchSessionLastMessageAt(sessionId);
  }

  async clearSessionMessages(sessionId: string): Promise<void> {
    const remaining = this.messages.filter((message) => message.sessionId !== sessionId);
    this.messages.splice(0, this.messages.length, ...remaining);
    this.touchSessionLastMessageAt(sessionId);
  }

  private touchSessionLastMessageAt(sessionId: string): void {
    const sessionIndex = this.sessions.findIndex((session) => session.id === sessionId);
    if (sessionIndex < 0) {
      return;
    }

    const session = this.sessions[sessionIndex];
    const latestMessage = this.messages
      .filter((message) => message.sessionId === sessionId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];

    this.sessions[sessionIndex] = {
      ...session,
      lastMessageAt: latestMessage?.createdAt ?? session.createdAt,
      updatedAt: new Date()
    };
  }
}
