import { randomUUID } from 'node:crypto';

import type { PluginRunRepository } from './plugin.repository.js';
import type {
  CreatePluginRunInput,
  PluginCapabilityKind,
  PluginRun,
  PluginRunState
} from './plugin.types.js';

export interface StartPluginRunInput {
  pluginId: string;
  agentRunId: string | null;
  capability: PluginCapabilityKind;
  inputJson: unknown | null;
}

export class PluginRunService {
  constructor(private readonly repository: PluginRunRepository) {}

  async start(input: StartPluginRunInput): Promise<PluginRun> {
    const createInput: CreatePluginRunInput = {
      id: randomUUID(),
      pluginId: input.pluginId,
      agentRunId: input.agentRunId,
      capability: input.capability,
      inputJson: input.inputJson
    };
    return this.repository.create(createInput);
  }

  async complete(runId: string, outputJson: unknown): Promise<PluginRun> {
    return this.repository.update({
      id: runId,
      state: 'completed' as PluginRunState,
      outputJson,
      finishedAt: new Date()
    });
  }

  async fail(runId: string, errorMessage: string): Promise<PluginRun> {
    return this.repository.update({
      id: runId,
      state: 'failed' as PluginRunState,
      errorMessage,
      finishedAt: new Date()
    });
  }

  async listForPlugin(pluginId: string, limit = 50): Promise<PluginRun[]> {
    return this.repository.findByPluginId(pluginId, limit);
  }
}
