import type { Plugin, CreatePluginInput, UpdatePluginInput } from './plugin.types.js';

export interface PluginRepository {
  findById(id: string): Promise<Plugin | null>;
  findAll(): Promise<Plugin[]>;
  findEnabled(): Promise<Plugin[]>;
  findByState(state: string): Promise<Plugin[]>;
  create(input: CreatePluginInput): Promise<Plugin>;
  update(input: UpdatePluginInput): Promise<Plugin>;
  delete(id: string): Promise<void>;
}
