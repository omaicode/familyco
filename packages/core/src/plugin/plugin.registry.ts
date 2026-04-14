import type {
  Plugin,
  PluginCapabilityDescriptor,
  PluginCapabilityKind,
  PluginModule,
  PluginState
} from './plugin.types.js';

/**
 * In-memory registry of loaded plugins and their capabilities.
 * Lives in core so both server and tests can reference the same contract.
 * Actual discovery and module loading are handled by PluginLoaderService in server.
 */
export class PluginRegistry {
  private readonly plugins = new Map<string, Plugin>();
  private readonly loadedModules = new Map<string, PluginModule>();

  register(plugin: Plugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  unregister(id: string): boolean {
    this.loadedModules.delete(id);
    return this.plugins.delete(id);
  }

  /** Store the dynamically imported module for an enabled plugin. */
  setLoadedModule(id: string, module: PluginModule): void {
    this.loadedModules.set(id, module);
  }

  /** Retrieve the loaded module, if any, for a plugin. */
  getLoadedModule(id: string): PluginModule | undefined {
    return this.loadedModules.get(id);
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
    this.loadedModules.clear();
  }
}
