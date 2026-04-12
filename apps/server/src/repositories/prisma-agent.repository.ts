import type {
  AgentLevel,
  AgentProfile,
  AgentRepository,
  AgentStatus,
  CreateAgentInput,
  UpdateAgentInput
} from '@familyco/core';
import type { PrismaClient } from '@familyco/db';

const AGENT_LEVELS: AgentLevel[] = ['L0', 'L1', 'L2'];
const AGENT_STATUSES: AgentStatus[] = ['active', 'idle', 'running', 'error', 'paused', 'terminated', 'archived'];
const LEGACY_AGENT_STATUS_ALIASES: Record<string, AgentStatus> = {
  archived: 'terminated'
};

export class PrismaAgentRepository implements AgentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateAgentInput): Promise<AgentProfile> {
    const agent = await this.prisma.agent.create({
      data: {
        name: input.name,
        role: input.role,
        level: input.level,
        department: input.department,
        status: 'active',
        parentAgentId: input.parentAgentId ?? null
      }
    });

    return toAgentProfile(agent);
  }

  async findById(id: string): Promise<AgentProfile | null> {
    const agent = await this.prisma.agent.findUnique({
      where: { id }
    });

    return agent ? toAgentProfile(agent) : null;
  }

  async findChildren(parentAgentId: string): Promise<AgentProfile[]> {
    const agents = await this.prisma.agent.findMany({
      where: {
        parentAgentId
      },
      orderBy: { createdAt: 'asc' }
    });

    return agents.map(toAgentProfile);
  }

  async list(): Promise<AgentProfile[]> {
    const agents = await this.prisma.agent.findMany({
      orderBy: { createdAt: 'asc' }
    });

    return agents.map(toAgentProfile);
  }

  async pause(id: string): Promise<AgentProfile> {
    return this.setStatus(id, 'paused');
  }

  async setStatus(id: string, status: AgentStatus): Promise<AgentProfile> {
    const agent = await this.prisma.agent.update({
      where: { id },
      data: {
        status
      }
    });

    return toAgentProfile(agent);
  }

  async update(id: string, input: UpdateAgentInput): Promise<AgentProfile> {
    const agent = await this.prisma.agent.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.department !== undefined ? { department: input.department } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.aiAdapterId !== undefined ? { aiAdapterId: input.aiAdapterId } : {}),
        ...(input.aiModel !== undefined ? { aiModel: input.aiModel } : {})
      }
    });

    return toAgentProfile(agent);
  }

  async updateParent(id: string, parentAgentId: string | null): Promise<AgentProfile> {
    const agent = await this.prisma.agent.update({
      where: { id },
      data: {
        parentAgentId
      }
    });

    return toAgentProfile(agent);
  }

  async reassignChildren(parentAgentId: string, nextParentAgentId: string): Promise<AgentProfile[]> {
    const children = await this.prisma.agent.findMany({
      where: { parentAgentId },
      orderBy: { createdAt: 'asc' }
    });

    if (children.length === 0) {
      return [];
    }

    await this.prisma.agent.updateMany({
      where: { parentAgentId },
      data: {
        parentAgentId: nextParentAgentId
      }
    });

    const updatedChildren = await this.prisma.agent.findMany({
      where: { id: { in: children.map((child) => child.id) } },
      orderBy: { createdAt: 'asc' }
    });

    return updatedChildren.map(toAgentProfile);
  }

  async delete(id: string): Promise<AgentProfile> {
    const agent = await this.prisma.agent.delete({
      where: { id }
    });

    return toAgentProfile(agent);
  }
}

function toAgentProfile(agent: {
  id: string;
  name: string;
  role: string;
  level: string;
  department: string;
  status: string;
  parentAgentId: string | null;
  aiAdapterId: string | null;
  aiModel: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AgentProfile {
  if (!AGENT_LEVELS.includes(agent.level as AgentLevel)) {
    throw new Error(`AGENT_LEVEL_INVALID:${agent.level}`);
  }

  return {
    ...agent,
    level: agent.level as AgentLevel,
    status: normalizeAgentStatus(agent.status)
  };
}

function normalizeAgentStatus(status: string): AgentStatus {
  const aliasedStatus = LEGACY_AGENT_STATUS_ALIASES[status];
  if (aliasedStatus) {
    return aliasedStatus;
  }

  if (!AGENT_STATUSES.includes(status as AgentStatus)) {
    throw new Error(`AGENT_STATUS_INVALID:${status}`);
  }

  return status as AgentStatus;
}
