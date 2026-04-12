import { type SettingsService } from '@familyco/core';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { parseSkillMarkdown } from './skills.parser.js';
import type {
  DiscoveredSkillItem,
  InvalidSkillItem,
  SkillAgentTarget,
  SkillItem,
  SkillsListResponse,
  SkillsRegistry
} from './skills.types.js';

const SKILLS_REGISTRY_KEY = 'skills.registry';

export class SkillsService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly skillsRootDir: string
  ) {}

  async list(): Promise<SkillsListResponse> {
    const discovered = await this.discover();
    const registry = await this.getRegistry();

    return {
      items: discovered.items.map((item) => toSkillItem(item, isSkillEnabled(item, registry))),
      invalidSkills: discovered.invalidSkills
    };
  }

  async listForAgent(target: SkillAgentTarget): Promise<SkillItem[]> {
    const discovered = await this.discover();
    const registry = await this.getRegistry();

    return discovered.items
      .filter((item) => isSkillEnabled(item, registry))
      .filter((item) => appliesToAgent(item, target))
      .map((item) => toSkillItem(item, true));
  }

  async getById(id: string): Promise<SkillItem | null> {
    const normalizedId = normalizeSkillId(id);
    const discovered = await this.discover();
    const registry = await this.getRegistry();
    const existing = discovered.items.find((item) => item.id === normalizedId);
    return existing ? toSkillItem(existing, isSkillEnabled(existing, registry)) : null;
  }

  async enable(id: string): Promise<SkillItem> {
    const normalizedId = normalizeSkillId(id);
    const existing = await this.getById(normalizedId);
    if (!existing) {
      throw new Error(`SKILL_NOT_FOUND:${normalizedId}`);
    }

    const registry = await this.getRegistry();
    registry.enabled = Array.from(new Set([...registry.enabled, normalizedId]));
    registry.disabled = registry.disabled.filter((item) => item !== normalizedId);

    await this.setRegistry(registry);
    return { ...existing, enabled: true };
  }

  async disable(id: string): Promise<SkillItem> {
    const normalizedId = normalizeSkillId(id);
    const existing = await this.getById(normalizedId);
    if (!existing) {
      throw new Error(`SKILL_NOT_FOUND:${normalizedId}`);
    }

    const registry = await this.getRegistry();
    registry.enabled = registry.enabled.filter((item) => item !== normalizedId);
    registry.disabled = Array.from(new Set([...registry.disabled, normalizedId]));
    await this.setRegistry(registry);
    return { ...existing, enabled: false };
  }

  private async discover(): Promise<{ items: DiscoveredSkillItem[]; invalidSkills: InvalidSkillItem[] }> {
    if (!(await pathExists(this.skillsRootDir))) {
      return {
        items: [],
        invalidSkills: []
      };
    }

    const entries = await readdir(this.skillsRootDir, { withFileTypes: true });
    const items: DiscoveredSkillItem[] = [];
    const invalidSkills: InvalidSkillItem[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const defaultId = normalizeSkillId(entry.name);
      const skillFilePath = path.join(this.skillsRootDir, entry.name, 'SKILL.md');
      if (!(await pathExists(skillFilePath))) {
        continue;
      }

      try {
        const content = await readFile(skillFilePath, 'utf8');
        const metadata = parseSkillMarkdown({ content, defaultId });
        items.push({
          id: metadata.id,
          name: metadata.name,
          description: metadata.description,
          version: metadata.version,
          tags: metadata.tags,
          path: normalizePath(skillFilePath),
          source: 'local',
          defaultEnabled: metadata.defaultEnabled,
          applyTo: metadata.applyTo
        });
      } catch (error) {
        invalidSkills.push({
          id: defaultId,
          path: normalizePath(skillFilePath),
          reason: error instanceof Error ? error.message : 'SKILL_PARSE_FAILED'
        });
      }
    }

    items.sort((a, b) => a.name.localeCompare(b.name));
    invalidSkills.sort((a, b) => a.id.localeCompare(b.id));

    return { items, invalidSkills };
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

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
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
        .map((item) => normalizeSkillId(item))
        .filter((item) => item.length > 0)
    )
  );
}

function toSkillItem(item: DiscoveredSkillItem, enabled: boolean): SkillItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    version: item.version,
    tags: item.tags,
    path: item.path,
    source: item.source,
    enabled
  };
}

function isSkillEnabled(item: DiscoveredSkillItem, registry: SkillsRegistry): boolean {
  return (item.defaultEnabled || registry.enabled.includes(item.id)) && !registry.disabled.includes(item.id);
}

function appliesToAgent(item: DiscoveredSkillItem, target: SkillAgentTarget): boolean {
  if (item.applyTo.length === 0) {
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

  const scope = new Set(item.applyTo.map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0));
  return candidates.some((candidate) => scope.has(candidate));
}

function normalizeSkillId(id: string): string {
  return id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_ ]+/g, '')
    .replace(/[_\s]+/g, '-');
}

function normalizePath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}
