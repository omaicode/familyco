import { randomUUID } from 'node:crypto';

import type {
  ApprovalRepository,
  ApprovalRequest,
  ApprovalStatus,
  CreateApprovalRequestInput
} from '@familyco/core';

export class InMemoryApprovalRepository implements ApprovalRepository {
  private readonly requests = new Map<string, ApprovalRequest>();

  async create(input: CreateApprovalRequestInput): Promise<ApprovalRequest> {
    const now = new Date();
    const request: ApprovalRequest = {
      id: randomUUID(),
      actorId: input.actorId,
      action: input.action,
      targetId: input.targetId,
      status: 'pending',
      payload: input.payload,
      createdAt: now,
      updatedAt: now
    };

    this.requests.set(request.id, request);
    return request;
  }

  async findById(id: string): Promise<ApprovalRequest | null> {
    return this.requests.get(id) ?? null;
  }

  async list(): Promise<ApprovalRequest[]> {
    return Array.from(this.requests.values());
  }

  async updateStatus(id: string, status: ApprovalStatus): Promise<ApprovalRequest> {
    const request = this.requests.get(id);
    if (!request) {
      throw new Error(`APPROVAL_NOT_FOUND:${id}`);
    }

    const updatedRequest: ApprovalRequest = {
      ...request,
      status,
      updatedAt: new Date()
    };

    this.requests.set(id, updatedRequest);
    return updatedRequest;
  }
}
