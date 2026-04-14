import type {
  Plugin,
  PluginCapabilityDescriptor,
  PluginCapabilityKind,
  PluginState
} from './plugin.types.js';

/**
 * In-memory registry of loaded plugins and their capabilities.
 * Lives in core so both server and tests can reference the same contract.
 * Actual discovery and module loading are handled by PluginLoaderService in server.
 */
export class PluginRegistry {
  private readonly plugins = new Map<string, Plugin>();

  register(plugin: Plugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  unregister(id: string): boolean {
    return this.plugins.delete(id);
  }

  get(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  list(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  listEnabled(): Plugin[] {
    return this.list().filter((p) => p.state === 'enabled');
  }

  listByState(state: PluginState): Plugin[] {
    return this.list().filter((p) => p.state === state);
  }

  /** Return all capability descriptors of a given kind across enabled plugins. */
  getCapabilities<K extends PluginCapabilityKind>(
    kind: K
  ): Extract<PluginCapabilityDescriptor, { kind: K }>[] {
    const result: Extract<PluginCapabilityDescriptor, { kind: K }>[] = [];
    for (const plugin of this.listEnabled()) {
      for (const cap of plugin.capabilities) {
        if (cap.kind === kind) {
          result.push(cap as Extract<PluginCapabilityDescriptor, { kind: K }>);
        }
      }
    }
    return result;
  }

  clear(): void {
    this.plugins.clear();
  }
}
