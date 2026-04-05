export interface AuditRecord {
  id: string;
  actorId: string;
  action: string;
  targetId?: string;
  payload?: Record<string, unknown>;
  createdAt: Date;
}
