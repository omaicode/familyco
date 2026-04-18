import { type SettingsService } from '@familyco/core';
import type { PluginRegistry } from '@familyco/core';

import type {
  SkillAgentTarget,
  SkillItem,
  SkillsListResponse,
  SkillsRegistry
} from './skills.types.js';

const SKILLS_REGISTRY_KEY = 'skills.registry';

export class SkillsService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly pluginRegistry?: PluginRegistry
  ) {}

  async list(): Promise<SkillsListResponse> {
    const registry = await this.getRegistry();
    const items = this.collectPluginSkills();

    return {
      items: items.map((item) => ({ ...item, enabled: !registry.disabled.includes(item.id) })),
      invalidSkills: []
    };
  }

  async listForAgent(target: SkillAgentTarget): Promise<SkillItem[]> {
    const registry = await this.getRegistry();

    return this.collectPluginSkills()
      .filter((item) => !registry.disabled.includes(item.id))
      .filter((item) => pluginSkillAppliesToAgent(item.applyTo, target))
  }

  async getById(id: string): Promise<SkillItem | null> {
    const registry = await this.getRegistry();
    const item = this.collectPluginSkills().find((s) => s.id === id);
    if (!item) return null;
    return { ...item, enabled: !registry.disabled.includes(item.id) };
  }

  async enable(id: string): Promise<SkillItem> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`SKILL_NOT_FOUND:${id}`);
    }

    const registry = await this.getRegistry();
    registry.disabled = registry.disabled.filter((d) => d !== id);
    registry.enabled = Array.from(new Set([...registry.enabled, id]));

    await this.setRegistry(registry);
    return { ...existing, enabled: true };
  }

  async disable(id: string): Promise<SkillItem> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`SKILL_NOT_FOUND:${id}`);
    }

    const registry = await this.getRegistry();
    registry.enabled = registry.enabled.filter((e) => e !== id);
    registry.disabled = Array.from(new Set([...registry.disabled, id]));

    await this.setRegistry(registry);
    return { ...existing, enabled: false };
  }

  /** Collect all skills from enabled plugins in the registry. */
  private collectPluginSkills(): Array<SkillItem & { applyTo: readonly string[] }> {
    if (!this.pluginRegistry) return [];

    return this.pluginRegistry.listEnabled().flatMap((plugin) => {
      const mod = this.pluginRegistry!.getLoadedModule(plugin.id);
      if (!mod?.skills?.length) return [];
      return mod.skills.map((skill) => ({
        id: `plugin:${plugin.id}:${skill.name}`,
        name: skill.name,
        description: skill.description,
        version: null,
        tags: [],
        path: `[plugin:${plugin.id}]`,
        content: skill.content,
        source: 'local' as const,
        enabled: skill.enabledByDefault ?? false,
        applyTo: skill.applyTo ?? []
      }));
    });
  }

  private async getRegistry(): Promise<SkillsRegistry> {
    const setting = await this.settingsService.get(SKILLS_REGISTRY_KEY);
    const value = setting?.value;

    if (!isRegistryPayload(value)) {
        return {
          enabled: [],
          disabled: [],
          updatedAt: new Date(0).toISOString()
        };
      }

      const enabled = normalizeRegistryList(value.enabled);
      const disabled = normalizeRegistryList(value.disabled);

      return {
        enabled,
        disabled,
        updatedAt: value.updatedAt
      };
  }

  private async setRegistry(registry: SkillsRegistry): Promise<void> {
    const payload: SkillsRegistry = {
      enabled: normalizeRegistryList(registry.enabled),
      disabled: normalizeRegistryList(registry.disabled),
      updatedAt: new Date().toISOString()
    };

    await this.settingsService.upsert({
      key: SKILLS_REGISTRY_KEY,
      value: payload
    });
  }
}

function isRegistryPayload(
  value: unknown
): value is {
  enabled: unknown[];
  disabled?: unknown[];
  updatedAt: string;
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return Array.isArray(payload.enabled) && typeof payload.updatedAt === 'string';
}

function normalizeRegistryList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .filter((item) => item.trim().length > 0)
    )
  );
}

function pluginSkillAppliesToAgent(applyTo: readonly string[], target: SkillAgentTarget): boolean {
  if (applyTo.length === 0) {
    return true;
  }

  const candidates = [
    target.level?.trim().toLowerCase(),
    target.id?.trim().toLowerCase(),
    target.name?.trim().toLowerCase()
  ].filter((value): value is string => Boolean(value));

  if (candidates.length === 0) {
    return false;
  }

  const scope = new Set(applyTo.map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0));
  return candidates.some((candidate) => scope.has(candidate));
}
