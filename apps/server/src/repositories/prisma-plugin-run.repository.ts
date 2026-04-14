import type { PrismaClient } from '@familyco/db';
import type {
  PluginRun,
  PluginRunRepository,
  CreatePluginRunInput,
  UpdatePluginRunInput,
  PluginCapabilityKind,
  PluginRunState
} from '@familyco/core';

export class PrismaPluginRunRepository implements PluginRunRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreatePluginRunInput): Promise<PluginRun> {
    const now = new Date();
    const row = await this.prisma.pluginRun.create({
      data: {
        id: input.id,
        pluginId: input.pluginId,
        agentRunId: input.agentRunId,
        capability: input.capability,
        state: 'running',
        inputJson: input.inputJson !== null ? JSON.parse(JSON.stringify(input.inputJson)) : undefined,
        startedAt: now
      }
    });
    return toPluginRun(row);
  }

  async update(input: UpdatePluginRunInput): Promise<PluginRun> {
    const data: Record<string, unknown> = { state: input.state };
    if (input.outputJson !== undefined) {
      data.outputJson = input.outputJson !== null ? JSON.parse(JSON.stringify(input.outputJson)) : null;
    }
    if (input.errorMessage !== undefined) data.errorMessage = input.errorMessage;
    if (input.finishedAt !== undefined) data.finishedAt = input.finishedAt;

    const row = await this.prisma.pluginRun.update({
      where: { id: input.id },
      data
    });
    return toPluginRun(row);
  }

  async findByPluginId(pluginId: string, limit = 50): Promise<PluginRun[]> {
    const rows = await this.prisma.pluginRun.findMany({
      where: { pluginId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return rows.map(toPluginRun);
  }
}

function toPluginRun(row: {
  id: string;
  pluginId: string;
  agentRunId: string | null;
  capability: string;
  state: string;
  inputJson: unknown;
  outputJson: unknown;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}): PluginRun {
  return {
    id: row.id,
    pluginId: row.pluginId,
    agentRunId: row.agentRunId,
    capability: row.capability as PluginCapabilityKind,
    state: row.state as PluginRunState,
    inputJson: row.inputJson ?? null,
    outputJson: row.outputJson ?? null,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt
  };
}
