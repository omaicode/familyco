import type { AuditRecord } from './audit.entity.js';

export interface AuditListQuery {
  actorId?: string;
  action?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditRepository {
  create(record: Omit<AuditRecord, 'id' | 'createdAt'>): Promise<AuditRecord>;
  list(query?: AuditListQuery): Promise<AuditRecord[]>;
}

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  write(record: Omit<AuditRecord, 'id' | 'createdAt'>): Promise<AuditRecord> {
    return this.repository.create(record);
  }

  list(query?: AuditListQuery): Promise<AuditRecord[]> {
    return this.repository.list(query);
  }
}
