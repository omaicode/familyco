import { randomUUID } from 'node:crypto';

import type { AuditListQuery, AuditRecord, AuditRepository } from '@familyco/core';

export class InMemoryAuditRepository implements AuditRepository {
  private readonly records: AuditRecord[] = [];

  async create(record: Omit<AuditRecord, 'id' | 'createdAt'>): Promise<AuditRecord> {
    const auditRecord: AuditRecord = {
      id: randomUUID(),
      createdAt: new Date(),
      ...record
    };

    this.records.push(auditRecord);
    return auditRecord;
  }

  async list(query: AuditListQuery = {}): Promise<AuditRecord[]> {
    const filteredRecords = this.records.filter((record) => {
      if (query.actorId && record.actorId !== query.actorId) {
        return false;
      }

      if (query.action && record.action !== query.action) {
        return false;
      }

      if (query.targetId && record.targetId !== query.targetId) {
        return false;
      }

      if (query.from && record.createdAt < query.from) {
        return false;
      }

      if (query.to && record.createdAt > query.to) {
        return false;
      }

      return true;
    });

    const offset = query.offset ?? 0;
    const limit = query.limit ?? filteredRecords.length;

    return filteredRecords.slice(offset, offset + limit);
  }
}
