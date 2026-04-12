import { Prisma, type PrismaClient } from '@familyco/db';
import type { AuditListQuery, AuditRecord, AuditRepository } from '@familyco/core';

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(record: Omit<AuditRecord, 'id' | 'createdAt'>): Promise<AuditRecord> {
    const createdRecord = await this.prisma.auditLog.create({
      data: {
        actorId: record.actorId,
        action: record.action,
        targetId: record.targetId,
        payload: record.payload as Prisma.InputJsonValue | undefined
      }
    });

    return {
      id: createdRecord.id,
      actorId: createdRecord.actorId,
      action: createdRecord.action,
      targetId: createdRecord.targetId ?? undefined,
      payload: isRecord(createdRecord.payload) ? createdRecord.payload : undefined,
      createdAt: createdRecord.createdAt
    };
  }

  async list(query: AuditListQuery = {}): Promise<AuditRecord[]> {
    const records = await this.prisma.auditLog.findMany({
      where: {
        actorId: query.actorId,
        action: query.action,
        targetId: query.targetId,
        createdAt: {
          gte: query.from,
          lte: query.to
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: query.offset,
      take: query.limit
    });

    return records.map((record) => ({
      id: record.id,
      actorId: record.actorId,
      action: record.action,
      targetId: record.targetId ?? undefined,
      payload: isRecord(record.payload) ? record.payload : undefined,
      createdAt: record.createdAt
    }));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
