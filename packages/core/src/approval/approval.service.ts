import type {
  ApprovalRequest,
  CreateApprovalRequestInput,
  DecideApprovalInput
} from './approval.entity.js';
import type { ApprovalRepository } from './approval.repository.js';

export class ApprovalService {
  constructor(private readonly repository: ApprovalRepository) {}

  createApprovalRequest(input: CreateApprovalRequestInput): Promise<ApprovalRequest> {
    return this.repository.create(input);
  }

  listApprovalRequests(): Promise<ApprovalRequest[]> {
    return this.repository.list();
  }

  async decideApproval(input: DecideApprovalInput): Promise<ApprovalRequest> {
    const existingRequest = await this.repository.findById(input.id);
    if (!existingRequest) {
      throw new Error(`APPROVAL_NOT_FOUND:${input.id}`);
    }

    if (existingRequest.status !== 'pending') {
      throw new Error(`APPROVAL_ALREADY_DECIDED:${input.id}`);
    }

    return this.repository.updateStatus(input.id, input.status);
  }
}
