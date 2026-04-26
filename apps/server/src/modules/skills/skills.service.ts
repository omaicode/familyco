import { type SettingsService } from '@familyco/core';
import type { PluginRegistry } from '@familyco/core';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { parseSkillMarkdown } from './skills.parser.js';
import type {
  InvalidSkillItem,
  SkillAgentTarget,
  SkillItem,
  SkillsListResponse,
  SkillsRegistry
} from './skills.types.js';

const SKILLS_REGISTRY_KEY = 'skills.registry';

type SkillCandidate = SkillItem & { applyTo: readonly string[]; defaultEnabled: boolean };

interface SkillCollectionResult {
  items: SkillCandidate[];
  invalidSkills: InvalidSkillItem[];
}

export class SkillsService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly pluginRegistry?: PluginRegistry,
    private readonly skillsRootDir?: string
  ) {}

  async list(): Promise<SkillsListResponse> {
    const registry = await this.getRegistry();
    const discovered = await this.collectAllSkills();

    return {
      items: discovered.items.map((item) => ({ ...item, enabled: isSkillEnabled(item, registry) })),
      invalidSkills: discovered.invalidSkills
    };
  }

  async listForAgent(target: SkillAgentTarget): Promise<SkillItem[]> {
    const registry = await this.getRegistry();
    const discovered = await this.collectAllSkills();

    return discovered.items
      .filter((item) => isSkillEnabled(item, registry))
      .filter((item) => skillAppliesToAgent(item.applyTo, target))
  }

  async getById(id: string): Promise<SkillItem | null> {
    const registry = await this.getRegistry();
    const discovered = await this.collectAllSkills();
    const item = discovered.items.find((s) => s.id === id);
    if (!item) return null;
    return { ...item, enabled: isSkillEnabled(item, registry) };
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

  private async collectAllSkills(): Promise<SkillCollectionResult> {
    const workspaceSkills = await this.collectWorkspaceSkills();
    const pluginSkills = this.collectPluginSkills();

    return {
      items: [...workspaceSkills.items, ...pluginSkills],
      invalidSkills: workspaceSkills.invalidSkills
    };
  }

  private async collectWorkspaceSkills(): Promise<SkillCollectionResult> {
    if (!this.skillsRootDir) {
      return { items: [], invalidSkills: [] };
    }

    let entries: string[];
    try {
      entries = await readdir(this.skillsRootDir, { encoding: 'utf8' });
    } catch (error) {
      if (isNotFoundError(error)) {
        return { items: [], invalidSkills: [] };
      }

      throw error;
    }

    const items: SkillCandidate[] = [];
    const invalidSkills: InvalidSkillItem[] = [];

    for (const entryName of entries) {
      const skillPath = path.join(this.skillsRootDir, entryName, 'SKILL.md');

      try {
        const content = await readFile(skillPath, 'utf8');
        const parsed = parseSkillMarkdown({
          content,
          defaultId: entryName
        });

        items.push({
          id: parsed.id,
          name: parsed.name,
          description: parsed.description,
          version: parsed.version,
          tags: parsed.tags,
          path: skillPath,
          content,
          source: 'local',
          enabled: false,
          defaultEnabled: parsed.defaultEnabled,
          applyTo: parsed.applyTo
        });
      } catch (error) {
        if (isMissingSkillFileError(error)) {
          continue;
        }

        invalidSkills.push({
          id: entryName,
          path: skillPath,
          reason: asErrorMessage(error)
        });
      }
    }

    return {
      items,
      invalidSkills
    };
  }

  /** Collect all skills from enabled plugins in the registry. */
  private collectPluginSkills(): SkillCandidate[] {
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
        enabled: false,
        defaultEnabled: skill.enabledByDefault === true,
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

function isSkillEnabled(
  item: SkillItem & { defaultEnabled: boolean },
  registry: SkillsRegistry
): boolean {
  if (registry.enabled.includes(item.id)) {
    return true;
  }

  if (registry.disabled.includes(item.id)) {
    return false;
  }

  return item.defaultEnabled;
}

function skillAppliesToAgent(applyTo: readonly string[], target: SkillAgentTarget): boolean {
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

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function isMissingSkillFileError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  return error.code === 'ENOENT' || error.code === 'ENOTDIR';
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unknown skill parse error';
}
