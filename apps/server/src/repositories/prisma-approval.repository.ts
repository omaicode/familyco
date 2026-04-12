import type {
  ApprovalRepository,
  ApprovalRequest,
  ApprovalStatus,
  CreateApprovalRequestInput
} from '@familyco/core';
import { Prisma, type PrismaClient } from '@familyco/db';

const APPROVAL_STATUSES: ApprovalStatus[] = ['pending', 'approved', 'rejected'];

export class PrismaApprovalRepository implements ApprovalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateApprovalRequestInput): Promise<ApprovalRequest> {
    const request = await this.prisma.approvalRequest.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        targetId: input.targetId,
        status: 'pending',
        payload: input.payload as Prisma.InputJsonValue | undefined
      }
    });

    return toApprovalRequest(request);
  }

  async findById(id: string): Promise<ApprovalRequest | null> {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id }
    });

    return request ? toApprovalRequest(request) : null;
  }

  async list(): Promise<ApprovalRequest[]> {
    const requests = await this.prisma.approvalRequest.findMany({
      orderBy: { createdAt: 'asc' }
    });

    return requests.map(toApprovalRequest);
  }

  async reassignActor(previousAgentId: string, nextAgentId: string): Promise<ApprovalRequest[]> {
    const affectedRequests = await this.prisma.approvalRequest.findMany({
      where: { actorId: previousAgentId },
      orderBy: { createdAt: 'asc' }
    });

    if (affectedRequests.length === 0) {
      return [];
    }

    await this.prisma.approvalRequest.updateMany({
      where: { actorId: previousAgentId },
      data: {
        actorId: nextAgentId
      }
    });

    const updatedRequests = await this.prisma.approvalRequest.findMany({
      where: {
        id: {
          in: affectedRequests.map((request) => request.id)
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return updatedRequests.map(toApprovalRequest);
  }

  async updateStatus(id: string, status: ApprovalStatus): Promise<ApprovalRequest> {
    const request = await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status
      }
    });

    return toApprovalRequest(request);
  }
}

function toApprovalRequest(request: {
  id: string;
  actorId: string;
  action: string;
  targetId: string | null;
  status: string;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ApprovalRequest {
  if (!APPROVAL_STATUSES.includes(request.status as ApprovalStatus)) {
    throw new Error(`APPROVAL_STATUS_INVALID:${request.status}`);
  }

  return {
    id: request.id,
    actorId: request.actorId,
    action: request.action,
    targetId: request.targetId ?? undefined,
    status: request.status as ApprovalStatus,
    payload: isRecord(request.payload) ? request.payload : undefined,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
