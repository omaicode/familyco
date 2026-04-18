import type {
  ApprovalRequest,
  ApprovalStatus,
  CreateApprovalRequestInput,
  DecideApprovalInput
} from './approval.entity.js';
import type { ApprovalRepository } from './approval.repository.js';
import type { EventBus } from '../events/event-bus.js';

export class ApprovalService {
  constructor(
    private readonly repository: ApprovalRepository,
    private readonly eventBus?: EventBus
  ) {}

  async createApprovalRequest(input: CreateApprovalRequestInput): Promise<ApprovalRequest> {
    const approvalRequest = await this.repository.create(input);
    this.eventBus?.emit('approval.requested', {
      actorId: approvalRequest.actorId,
      action: approvalRequest.action
    });
    return approvalRequest;
  }

  listApprovalRequests(): Promise<ApprovalRequest[]> {
    return this.repository.list();
  }

  async countApprovalRequests(status?: ApprovalStatus): Promise<number> {
    if (status && hasCountByStatusRepository(this.repository)) {
      return this.repository.countByStatus(status);
    }

    const approvals = await this.repository.list();
    return status ? approvals.filter((approval) => approval.status === status).length : approvals.length;
  }

  async decideApproval(input: DecideApprovalInput): Promise<ApprovalRequest> {
    const existingRequest = await this.repository.findById(input.id);
    if (!existingRequest) {
      throw new Error(`APPROVAL_NOT_FOUND:${input.id}`);
    }

    if (existingRequest.status !== 'pending') {
      throw new Error(`APPROVAL_ALREADY_DECIDED:${input.id}`);
    }

    const updatedRequest = await this.repository.updateStatus(input.id, input.status);
    this.eventBus?.emit('approval.decided', {
      approvalId: updatedRequest.id,
      status: updatedRequest.status
    });

    return updatedRequest;
  }
}

interface CountByStatusApprovalRepository extends ApprovalRepository {
  countByStatus(status: ApprovalStatus): Promise<number>;
}

function hasCountByStatusRepository(repository: ApprovalRepository): repository is CountByStatusApprovalRepository {
  return typeof (repository as { countByStatus?: unknown }).countByStatus === 'function';
}
