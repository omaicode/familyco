import type {
  ApprovalRequest,
  ApprovalStatus,
  CreateApprovalRequestInput
} from './approval.entity.js';

export interface ApprovalRepository {
  create(input: CreateApprovalRequestInput): Promise<ApprovalRequest>;
  findById(id: string): Promise<ApprovalRequest | null>;
  list(): Promise<ApprovalRequest[]>;
  reassignActor(previousAgentId: string, nextAgentId: string): Promise<ApprovalRequest[]>;
  updateStatus(id: string, status: ApprovalStatus): Promise<ApprovalRequest>;
}
