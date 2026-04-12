import type { PrismaClient } from '@familyco/db';
import type {
  AgentRun,
  AgentRunListQuery,
  AgentRunRepository,
  CreateAgentRunInput,
  UpdateAgentRunStateInput
} from '@familyco/core';

export class PrismaAgentRunRepository implements AgentRunRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateAgentRunInput): Promise<AgentRun> {
    const run = await this.prisma.agentRun.create({
      data: {
        companyId: input.companyId,
        rootAgentId: input.rootAgentId,
        parentRunId: input.parentRunId ?? null,
        triggerType: input.triggerType,
        state: input.state ?? 'queued',
        inputSummary: input.inputSummary,
        linkedProjectId: input.linkedProjectId ?? null,
        linkedTaskId: input.linkedTaskId ?? null
      }
    });

    return mapRun(run);
  }

  async updateState(id: string, input: UpdateAgentRunStateInput): Promise<AgentRun> {
    const now = new Date();
    const shouldFinish = input.state === 'completed' || input.state === 'failed' || input.state === 'cancelled';
    const shouldStart = input.state === 'planning' || input.state === 'executing';

    const run = await this.prisma.agentRun.update({
      where: { id },
      data: {
        state: input.state,
        outputSummary: input.outputSummary,
        startedAt: shouldStart ? now : undefined,
        finishedAt: shouldFinish ? now : null
      }
    });

    return mapRun(run);
  }

  async getById(id: string): Promise<AgentRun | null> {
    const run = await this.prisma.agentRun.findUnique({ where: { id } });
    return run ? mapRun(run) : null;
  }

  async list(query: AgentRunListQuery = {}): Promise<AgentRun[]> {
    const runs = await this.prisma.agentRun.findMany({
      where: {
        rootAgentId: query.rootAgentId,
        state: query.state,
        triggerType: query.triggerType,
        createdAt: {
          gte: query.from,
          lte: query.to
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: query.offset,
      take: query.limit
    });

    return runs.map(mapRun);
  }
}

function mapRun(run: {
  id: string;
  companyId: string | null;
  rootAgentId: string;
  parentRunId: string | null;
  triggerType: string;
  state: string;
  inputSummary: string;
  outputSummary: string | null;
  linkedProjectId: string | null;
  linkedTaskId: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AgentRun {
  return {
    id: run.id,
    companyId: run.companyId ?? undefined,
    rootAgentId: run.rootAgentId,
    parentRunId: run.parentRunId,
    triggerType: run.triggerType as AgentRun['triggerType'],
    state: run.state as AgentRun['state'],
    inputSummary: run.inputSummary,
    outputSummary: run.outputSummary,
    linkedProjectId: run.linkedProjectId,
    linkedTaskId: run.linkedTaskId,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt
  };
}
