import type { PluginRepository } from './plugin.repository.js';
import type {
  CreatePluginInput,
  Plugin,
  PluginCapabilityDescriptor,
  PluginCapabilityKind,
  UpdatePluginInput
} from './plugin.types.js';

export class PluginService {
  constructor(private readonly repository: PluginRepository) {}

  async getById(id: string): Promise<Plugin | null> {
    return this.repository.findById(id);
  }

  async getByIdOrThrow(id: string): Promise<Plugin> {
    const plugin = await this.repository.findById(id);
    if (!plugin) {
      throw new Error(`PLUGIN_NOT_FOUND:${id}`);
    }
    return plugin;
  }

  async list(): Promise<Plugin[]> {
    return this.repository.findAll();
  }

  async listEnabled(): Promise<Plugin[]> {
    return this.repository.findEnabled();
  }

  async create(input: CreatePluginInput): Promise<Plugin> {
    return this.repository.create(input);
  }

  async update(input: UpdatePluginInput): Promise<Plugin> {
    await this.getByIdOrThrow(input.id);
    return this.repository.update(input);
  }

  async enable(id: string): Promise<Plugin> {
    const plugin = await this.getByIdOrThrow(id);
    if (plugin.state === 'enabled') {
      return plugin;
    }
    return this.repository.update({ id, state: 'enabled', errorMessage: null });
  }

  async disable(id: string): Promise<Plugin> {
    const plugin = await this.getByIdOrThrow(id);
    if (plugin.state === 'disabled') {
      return plugin;
    }
    return this.repository.update({ id, state: 'disabled' });
  }

  async markError(id: string, errorMessage: string): Promise<Plugin> {
    return this.repository.update({ id, state: 'error', errorMessage });
  }

  async remove(id: string): Promise<void> {
    await this.getByIdOrThrow(id);
    return this.repository.delete(id);
  }

  async getEnabledCapabilities<K extends PluginCapabilityKind>(
    kind: K
  ): Promise<Extract<PluginCapabilityDescriptor, { kind: K }>[]> {
    const plugins = await this.listEnabled();
    const result: Extract<PluginCapabilityDescriptor, { kind: K }>[] = [];
    for (const plugin of plugins) {
      for (const cap of plugin.capabilities) {
        if (cap.kind === kind) {
          result.push(cap as Extract<PluginCapabilityDescriptor, { kind: K }>);
        }
      }
    }
    return result;
  }
}
