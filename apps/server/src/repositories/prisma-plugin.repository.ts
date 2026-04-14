import { Prisma, type PrismaClient } from '@familyco/db';
import type {
  Plugin,
  PluginCapabilityDescriptor,
  PluginRepository,
  PluginState,
  CreatePluginInput,
  UpdatePluginInput
} from '@familyco/core';
import type { ApprovalMode } from '@familyco/core';

export class PrismaPluginRepository implements PluginRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Plugin | null> {
    const row = await this.prisma.plugin.findUnique({ where: { id } });
    return row ? toPlugin(row) : null;
  }

  async findAll(): Promise<Plugin[]> {
    const rows = await this.prisma.plugin.findMany({ orderBy: { name: 'asc' } });
    return rows.map(toPlugin);
  }

  async findEnabled(): Promise<Plugin[]> {
    const rows = await this.prisma.plugin.findMany({
      where: { state: 'enabled' },
      orderBy: { name: 'asc' }
    });
    return rows.map(toPlugin);
  }

  async findByState(state: string): Promise<Plugin[]> {
    const rows = await this.prisma.plugin.findMany({
      where: { state },
      orderBy: { name: 'asc' }
    });
    return rows.map(toPlugin);
  }

  async create(input: CreatePluginInput): Promise<Plugin> {
    const row = await this.prisma.plugin.create({
      data: {
        id: input.id,
        name: input.name,
        description: input.description,
        version: input.version,
        author: input.author,
        tags: JSON.parse(JSON.stringify(input.tags)) as Prisma.InputJsonValue,
        path: input.path,
        entry: input.entry,
        capabilities: JSON.parse(JSON.stringify(input.capabilities)) as Prisma.InputJsonValue,
        state: input.state,
        approvalMode: input.approvalMode,
        checksum: input.checksum,
        errorMessage: input.errorMessage
      }
    });
    return toPlugin(row);
  }

  async update(input: UpdatePluginInput): Promise<Plugin> {
    const data: Record<string, unknown> = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.version !== undefined) data.version = input.version;
    if (input.author !== undefined) data.author = input.author;
    if (input.tags !== undefined) data.tags = JSON.parse(JSON.stringify(input.tags));
    if (input.entry !== undefined) data.entry = input.entry;
    if (input.capabilities !== undefined) data.capabilities = JSON.parse(JSON.stringify(input.capabilities));
    if (input.state !== undefined) data.state = input.state;
    if (input.approvalMode !== undefined) data.approvalMode = input.approvalMode;
    if (input.checksum !== undefined) data.checksum = input.checksum;
    if (input.errorMessage !== undefined) data.errorMessage = input.errorMessage;

    const row = await this.prisma.plugin.update({
      where: { id: input.id },
      data
    });
    return toPlugin(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.plugin.delete({ where: { id } });
  }
}

function toPlugin(row: {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string | null;
  tags: unknown;
  path: string;
  entry: string;
  capabilities: unknown;
  state: string;
  approvalMode: string;
  checksum: string;
  errorMessage: string | null;
  discoveredAt: Date;
  updatedAt: Date;
}): Plugin {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    version: row.version,
    author: row.author,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    path: row.path,
    entry: row.entry,
    capabilities: Array.isArray(row.capabilities)
      ? (row.capabilities as PluginCapabilityDescriptor[])
      : [],
    state: row.state as PluginState,
    approvalMode: row.approvalMode as ApprovalMode,
    checksum: row.checksum,
    errorMessage: row.errorMessage,
    discoveredAt: row.discoveredAt,
    updatedAt: row.updatedAt
  };
}
