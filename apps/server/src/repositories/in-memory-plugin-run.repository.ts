import type {
  PluginRun,
  PluginRunRepository,
  CreatePluginRunInput,
  UpdatePluginRunInput,
  PluginCapabilityKind,
  PluginRunState
} from '@familyco/core';

export class InMemoryPluginRunRepository implements PluginRunRepository {
  private readonly store = new Map<string, PluginRun>();

  async create(input: CreatePluginRunInput): Promise<PluginRun> {
    const now = new Date();
    const run: PluginRun = {
      id: input.id,
      pluginId: input.pluginId,
      agentRunId: input.agentRunId,
      capability: input.capability,
      state: 'running',
      inputJson: input.inputJson,
      outputJson: null,
      errorMessage: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now
    };
    this.store.set(run.id, run);
    return run;
  }

  async update(input: UpdatePluginRunInput): Promise<PluginRun> {
    const existing = this.store.get(input.id);
    if (!existing) {
      throw new Error(`PLUGIN_RUN_NOT_FOUND:${input.id}`);
    }
    const updated: PluginRun = {
      ...existing,
      state: input.state,
      outputJson: input.outputJson !== undefined ? input.outputJson : existing.outputJson,
      errorMessage: input.errorMessage !== undefined ? input.errorMessage : existing.errorMessage,
      finishedAt: input.finishedAt ?? existing.finishedAt
    };
    this.store.set(updated.id, updated);
    return updated;
  }

  async findByPluginId(pluginId: string, limit = 50): Promise<PluginRun[]> {
    return Array.from(this.store.values())
      .filter((r) => r.pluginId === pluginId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
