import { Prisma, type PrismaClient } from '../db/prisma/client.js';
import type {
  CreateInboxMessageInput,
  InboxMessage,
  InboxMessageStatus,
  InboxRepository,
  ListInboxMessagesQuery,
  UpdateInboxMessageInput
} from '@familyco/core';

export class PrismaInboxRepository implements InboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateInboxMessageInput): Promise<InboxMessage> {
    const message = await this.prisma.inboxMessage.create({
      data: {
        recipientId: input.recipientId,
        senderId: input.senderId,
        type: input.type,
        title: input.title,
        body: input.body,
        status: 'unread',
        payload: toJsonValue(input.payload)
      }
    });

    return toInboxMessage(message);
  }

  async findById(id: string): Promise<InboxMessage | null> {
    const message = await this.prisma.inboxMessage.findUnique({
      where: { id }
    });

    return message ? toInboxMessage(message) : null;
  }

  async list(query: ListInboxMessagesQuery): Promise<InboxMessage[]> {
    const messages = await this.prisma.inboxMessage.findMany({
      where: {
        recipientId: query.recipientId,
        ...(query.senderId ? { senderId: query.senderId } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.status ? { status: query.status } : {})
      } as never,
      orderBy: { createdAt: 'asc' },
      skip: query.offset,
      take: query.limit
    });

    return messages.map(toInboxMessage);
  }

  async updateStatus(id: string, status: InboxMessageStatus): Promise<InboxMessage> {
    const message = await this.prisma.inboxMessage.update({
      where: { id },
      data: {
        status
      }
    });

    return toInboxMessage(message);
  }

  async updateMessage(id: string, input: UpdateInboxMessageInput): Promise<InboxMessage> {
    const message = await this.prisma.inboxMessage.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.payload !== undefined ? { payload: toJsonValue(input.payload) } : {})
      }
    });

    return toInboxMessage(message);
  }

  async clearConversation(agentId: string, founderId = 'founder'): Promise<void> {
    await this.prisma.inboxMessage.deleteMany({
      where: {
        OR: [
          { recipientId: agentId },
          {
            recipientId: founderId,
            senderId: agentId
          }
        ]
      }
    });
  }
}

function toInboxMessage(message: {
  id: string;
  recipientId: string;
  senderId: string;
  type: string;
  title: string;
  body: string;
  status: string;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
}): InboxMessage {
  return {
    id: message.id,
    recipientId: message.recipientId,
    senderId: message.senderId,
    type: message.type as InboxMessage['type'],
    title: message.title,
    body: message.body,
    status: message.status as InboxMessage['status'],
    payload: isRecord(message.payload) ? message.payload : undefined,
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
