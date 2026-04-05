import assert from 'node:assert/strict';
import test from 'node:test';

import { ApprovalService } from './approval.service.js';
import type {
  ApprovalRequest,
  ApprovalRepository,
  ApprovalStatus,
  CreateApprovalRequestInput
} from './index.js';
import { EventBus } from '../events/event-bus.js';

test('ApprovalService enforces pending-only decisions and emits approval events', async () => {
  const repository = new InMemoryApprovalRepositoryStub();
  const eventBus = new EventBus();
  const service = new ApprovalService(repository, eventBus);

  const eventLog: Array<{ event: string; payload: unknown }> = [];
  eventBus.on('approval.requested', (payload) => {
    eventLog.push({ event: 'approval.requested', payload });
  });
  eventBus.on('approval.decided', (payload) => {
    eventLog.push({ event: 'approval.decided', payload });
  });

  const request = await service.createApprovalRequest({
    actorId: 'agent-1',
    action: 'task.publish',
    targetId: 'task-1'
  });

  const approved = await service.decideApproval({
    id: request.id,
    status: 'approved'
  });

  assert.equal(approved.status, 'approved');

  await assert.rejects(
    () => service.decideApproval({ id: request.id, status: 'rejected' }),
    /APPROVAL_ALREADY_DECIDED/
  );

  assert.deepEqual(eventLog, [
    {
      event: 'approval.requested',
      payload: {
        actorId: 'agent-1',
        action: 'task.publish'
      }
    },
    {
      event: 'approval.decided',
      payload: {
        approvalId: request.id,
        status: 'approved'
      }
    }
  ]);
});

class InMemoryApprovalRepositoryStub implements ApprovalRepository {
  private readonly records = new Map<string, ApprovalRequest>();

  async create(input: CreateApprovalRequestInput): Promise<ApprovalRequest> {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const record: ApprovalRequest = {
      id: `approval-${this.records.size + 1}`,
      actorId: input.actorId,
      action: input.action,
      targetId: input.targetId,
      status: 'pending',
      payload: input.payload,
      createdAt: now,
      updatedAt: now
    };

    this.records.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<ApprovalRequest | null> {
    return this.records.get(id) ?? null;
  }

  async list(): Promise<ApprovalRequest[]> {
    return Array.from(this.records.values());
  }

  async updateStatus(id: string, status: ApprovalStatus): Promise<ApprovalRequest> {
    const existing = this.records.get(id);
    if (!existing) {
      throw new Error(`APPROVAL_NOT_FOUND:${id}`);
    }

    const updated: ApprovalRequest = {
      ...existing,
      status,
      updatedAt: new Date('2026-01-02T00:00:00.000Z')
    };

    this.records.set(id, updated);
    return updated;
  }
}
