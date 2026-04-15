import { Prisma, type PrismaClient } from '@familyco/db';

import type {
  ChatMessage,
  ChatSession,
  CreateChatMessageInput,
  CreateChatSessionInput,
  UpdateChatMessageInput
} from '../modules/agent/chat-conversation.types.js';
import type { ChatConversationRepository } from '../modules/agent/chat-conversation.service.js';

export class PrismaChatConversationRepository implements ChatConversationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listSessions(agentId: string, founderId: string, limit = 50): Promise<ChatSession[]> {
    const sessions = await this.prisma.chatSession.findMany({
      where: {
        agentId,
        founderId
      },
      orderBy: { lastMessageAt: 'desc' },
      take: Math.max(0, limit)
    });

    return sessions.map(toChatSession);
  }

  async findSessionById(id: string): Promise<ChatSession | null> {
    const session = await this.prisma.chatSession.findUnique({ where: { id } });
    return session ? toChatSession(session) : null;
  }

  async findLatestSession(agentId: string, founderId: string): Promise<ChatSession | null> {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        agentId,
        founderId
      },
      orderBy: { lastMessageAt: 'desc' }
    });

    return session ? toChatSession(session) : null;
  }

  async createSession(input: CreateChatSessionInput): Promise<ChatSession> {
    const session = await this.prisma.chatSession.create({
      data: {
        agentId: input.agentId,
        founderId: input.founderId ?? 'founder',
        title: input.title ?? 'New chat'
      }
    });

    return toChatSession(session);
  }

  async updateSession(
    id: string,
    input: { title?: string; lastMessageAt?: Date }
  ): Promise<ChatSession> {
    const session = await this.prisma.chatSession.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.lastMessageAt ? { lastMessageAt: input.lastMessageAt } : {})
      }
    });

    return toChatSession(session);
  }

  async listMessages(input: {
    sessionId: string;
    limit?: number;
    before?: Date;
  }): Promise<ChatMessage[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        sessionId: input.sessionId,
        ...(input.before ? { createdAt: { lt: input.before } } : {})
      },
      orderBy: { createdAt: 'desc' },
      ...(typeof input.limit === 'number' ? { take: Math.max(0, input.limit) } : {})
    });

    return messages.reverse().map(toChatMessage);
  }

  async createMessage(input: CreateChatMessageInput): Promise<ChatMessage> {
    const created = await this.prisma.$transaction(async (tx) => {
      const message = await tx.chatMessage.create({
        data: {
          sessionId: input.sessionId,
          senderId: input.senderId,
          recipientId: input.recipientId,
          type: input.type,
          title: input.title,
          body: input.body,
          payload: toJsonValue(input.payload)
        }
      });

      await tx.chatSession.update({
        where: { id: input.sessionId },
        data: { lastMessageAt: message.createdAt }
      });

      return message;
    });

    return toChatMessage(created);
  }

  async findMessageById(id: string): Promise<ChatMessage | null> {
    const message = await this.prisma.chatMessage.findUnique({ where: { id } });
    return message ? toChatMessage(message) : null;
  }

  async updateMessage(id: string, input: UpdateChatMessageInput): Promise<ChatMessage> {
    const message = await this.prisma.chatMessage.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.payload !== undefined ? { payload: toJsonValue(input.payload) } : {})
      }
    });

    return toChatMessage(message);
  }

  async countMessages(input: { sessionId: string; senderId?: string }): Promise<number> {
    return this.prisma.chatMessage.count({
      where: {
        sessionId: input.sessionId,
        ...(input.senderId ? { senderId: input.senderId } : {})
      }
    });
  }

  async deleteMessagesAfter(sessionId: string, after: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.chatMessage.deleteMany({
        where: {
          sessionId,
          createdAt: { gt: after }
        }
      });

      const [session, latest] = await Promise.all([
        tx.chatSession.findUnique({
          where: { id: sessionId },
          select: { createdAt: true }
        }),
        tx.chatMessage.findFirst({
          where: { sessionId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true }
        })
      ]);

      if (!session) {
        return;
      }

      await tx.chatSession.update({
        where: { id: sessionId },
        data: { lastMessageAt: latest?.createdAt ?? session.createdAt }
      });
    });
  }

  async clearSessionMessages(sessionId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.chatMessage.deleteMany({ where: { sessionId } });

      const session = await tx.chatSession.findUnique({
        where: { id: sessionId },
        select: { createdAt: true }
      });

      if (!session) {
        return;
      }

      await tx.chatSession.update({
        where: { id: sessionId },
        data: { lastMessageAt: session.createdAt }
      });
    });
  }
}

function toChatSession(session: {
  id: string;
  agentId: string;
  founderId: string;
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): ChatSession {
  return {
    id: session.id,
    agentId: session.agentId,
    founderId: session.founderId,
    title: session.title,
    lastMessageAt: session.lastMessageAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

function toChatMessage(message: {
  id: string;
  sessionId: string;
  senderId: string;
  recipientId: string;
  type: string;
  title: string;
  body: string;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ChatMessage {
  return {
    id: message.id,
    sessionId: message.sessionId,
    senderId: message.senderId,
    recipientId: message.recipientId,
    type: message.type as ChatMessage['type'],
    title: message.title,
    body: message.body,
    ...(isRecord(message.payload) ? { payload: message.payload } : {}),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt
  };
}

function toJsonValue(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  return value ? (value as Prisma.InputJsonValue) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
