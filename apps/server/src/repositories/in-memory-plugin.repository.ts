import type {
  Plugin,
  PluginCapabilityDescriptor,
  PluginRepository,
  CreatePluginInput,
  UpdatePluginInput
} from '@familyco/core';

export class InMemoryPluginRepository implements PluginRepository {
  private readonly store = new Map<string, Plugin>();

  async findById(id: string): Promise<Plugin | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<Plugin[]> {
    return Array.from(this.store.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async findEnabled(): Promise<Plugin[]> {
    return (await this.findAll()).filter((p) => p.state === 'enabled');
  }

  async findByState(state: string): Promise<Plugin[]> {
    return (await this.findAll()).filter((p) => p.state === state);
  }

  async create(input: CreatePluginInput): Promise<Plugin> {
    const now = new Date();
    const plugin: Plugin = {
      id: input.id,
      name: input.name,
      description: input.description,
      version: input.version,
      author: input.author,
      tags: [...input.tags],
      path: input.path,
      entry: input.entry,
      capabilities: [...input.capabilities],
      state: input.state,
      approvalMode: input.approvalMode,
      checksum: input.checksum,
      errorMessage: input.errorMessage,
      discoveredAt: now,
      updatedAt: now
    };
    this.store.set(plugin.id, plugin);
    return plugin;
  }

  async update(input: UpdatePluginInput): Promise<Plugin> {
    const existing = this.store.get(input.id);
    if (!existing) {
      throw new Error(`PLUGIN_NOT_FOUND:${input.id}`);
    }

    const updated: Plugin = {
      ...existing,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.version !== undefined ? { version: input.version } : {}),
      ...(input.author !== undefined ? { author: input.author } : {}),
      ...(input.tags !== undefined ? { tags: [...input.tags] } : {}),
      ...(input.entry !== undefined ? { entry: input.entry } : {}),
      ...(input.capabilities !== undefined ? { capabilities: [...input.capabilities] } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.approvalMode !== undefined ? { approvalMode: input.approvalMode } : {}),
      ...(input.checksum !== undefined ? { checksum: input.checksum } : {}),
      ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
      updatedAt: new Date()
    };

    this.store.set(input.id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
