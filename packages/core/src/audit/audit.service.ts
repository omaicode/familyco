import type { AuditRecord } from './audit.entity.js';

export interface AuditRepository {
  create(record: Omit<AuditRecord, 'id' | 'createdAt'>): Promise<AuditRecord>;
}

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  write(record: Omit<AuditRecord, 'id' | 'createdAt'>): Promise<AuditRecord> {
    return this.repository.create(record);
  }
}
