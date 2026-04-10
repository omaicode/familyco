import type {
  AgentDeleteResult,
  AgentLevel,
  AgentProfile,
  AgentRepository,
  AgentStatus,
  CreateAgentInput,
  UpdateAgentInput
} from '@familyco/core';
import type { PrismaClient } from '../db/prisma/client.js';

const AGENT_LEVELS: AgentLevel[] = ['L0', 'L1', 'L2'];
const AGENT_STATUSES: AgentStatus[] = ['active', 'idle', 'running', 'error', 'paused', 'terminated'];
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

  async deleteCascade(id: string): Promise<AgentDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const root = await tx.agent.findUnique({ where: { id } });
      if (!root) {
        throw new Error(`AGENT_NOT_FOUND:${id}`);
      }

      const deletedAgentIds = new Set<string>();
      let agentFrontier = [id];
      while (agentFrontier.length > 0) {
        agentFrontier.forEach((agentId) => deletedAgentIds.add(agentId));
        const children = await tx.agent.findMany({
          where: { parentAgentId: { in: agentFrontier } },
          select: { id: true }
        });
        agentFrontier = children
          .map((child) => child.id)
          .filter((agentId) => !deletedAgentIds.has(agentId));
      }

      const deletedProjectIds = new Set<string>();
      const rootProjects = await tx.project.findMany({
        where: {
          ownerAgentId: { in: Array.from(deletedAgentIds) }
        },
        select: { id: true }
      });
      rootProjects.forEach((project) => deletedProjectIds.add(project.id));
      let projectFrontier = Array.from(deletedProjectIds);
      while (projectFrontier.length > 0) {
        const children = await tx.project.findMany({
          where: {
            parentProjectId: { in: projectFrontier }
          },
          select: { id: true }
        });
        projectFrontier = [];
        for (const child of children) {
          if (!deletedProjectIds.has(child.id)) {
            deletedProjectIds.add(child.id);
            projectFrontier.push(child.id);
          }
        }
      }

      const deletedTaskIds = await tx.task.findMany({
        where: {
          OR: [
            { createdBy: { in: Array.from(deletedAgentIds) } },
            { assigneeAgentId: { in: Array.from(deletedAgentIds) } },
            { projectId: { in: Array.from(deletedProjectIds) } }
          ]
        },
        select: { id: true }
      }).then((tasks) => tasks.map((task) => task.id));

      if (deletedTaskIds.length > 0) {
        await tx.task.deleteMany({
          where: { id: { in: deletedTaskIds } }
        });
      }

      const deletedApprovalIds = await tx.approvalRequest.findMany({
        where: {
          actorId: { in: Array.from(deletedAgentIds) }
        },
        select: { id: true }
      }).then((approvals) => approvals.map((approval) => approval.id));

      if (deletedApprovalIds.length > 0) {
        await tx.approvalRequest.deleteMany({
          where: {
            id: { in: deletedApprovalIds }
          }
        });
      }

      const remainingProjects = new Set(deletedProjectIds);
      while (remainingProjects.size > 0) {
        const projectRows = await tx.project.findMany({
          where: { id: { in: Array.from(remainingProjects) } },
          select: { id: true, parentProjectId: true }
        });
        const parentIds = new Set(
          projectRows.map((project) => project.parentProjectId).filter((value): value is string => Boolean(value))
        );
        const leafIds = projectRows.filter((project) => !parentIds.has(project.id)).map((project) => project.id);
        if (leafIds.length === 0) {
          throw new Error('PROJECT_DELETE_CASCADE_FAILED');
        }

        await tx.project.deleteMany({
          where: { id: { in: leafIds } }
        });
        leafIds.forEach((projectId) => remainingProjects.delete(projectId));
      }

      const remainingAgents = new Set(deletedAgentIds);
      while (remainingAgents.size > 0) {
        const agentRows = await tx.agent.findMany({
          where: { id: { in: Array.from(remainingAgents) } },
          select: { id: true, parentAgentId: true }
        });
        const parentIds = new Set(
          agentRows.map((agent) => agent.parentAgentId).filter((value): value is string => Boolean(value))
        );
        const leafIds = agentRows.filter((agent) => !parentIds.has(agent.id)).map((agent) => agent.id);
        if (leafIds.length === 0) {
          throw new Error('AGENT_DELETE_CASCADE_FAILED');
        }

        await tx.agent.deleteMany({
          where: { id: { in: leafIds } }
        });
        leafIds.forEach((agentId) => remainingAgents.delete(agentId));
      }

      return {
        deletedAgentIds: Array.from(deletedAgentIds),
        deletedProjectIds: Array.from(deletedProjectIds),
        deletedTaskIds,
        deletedApprovalIds
      };
    });
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
