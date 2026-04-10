import { type SettingsService } from '@familyco/core';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { parseSkillMarkdown } from './skills.parser.js';
import type { InvalidSkillItem, SkillItem, SkillsListResponse, SkillsRegistry } from './skills.types.js';

const SKILLS_REGISTRY_KEY = 'skills.registry';

export class SkillsService {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly skillsRootDir: string
  ) {}

  async list(): Promise<SkillsListResponse> {
    const discovered = await this.discover();
    const registry = await this.getRegistry();
    const enabledSet = new Set(registry.enabled);

    return {
      items: discovered.items.map((item) => ({ ...item, enabled: enabledSet.has(item.id) })),
      invalidSkills: discovered.invalidSkills
    };
  }

  async getById(id: string): Promise<SkillItem | null> {
    const normalizedId = normalizeSkillId(id);
    const listed = await this.list();
    return listed.items.find((item) => item.id === normalizedId) ?? null;
  }

  async enable(id: string): Promise<SkillItem> {
    const normalizedId = normalizeSkillId(id);
    const existing = await this.getById(normalizedId);
    if (!existing) {
      throw new Error(`SKILL_NOT_FOUND:${normalizedId}`);
    }

    const registry = await this.getRegistry();
    if (!registry.enabled.includes(normalizedId)) {
      registry.enabled.push(normalizedId);
    }

    await this.setRegistry(registry.enabled);
    return { ...existing, enabled: true };
  }

  async disable(id: string): Promise<SkillItem> {
    const normalizedId = normalizeSkillId(id);
    const existing = await this.getById(normalizedId);
    if (!existing) {
      throw new Error(`SKILL_NOT_FOUND:${normalizedId}`);
    }

    const registry = await this.getRegistry();
    const nextEnabled = registry.enabled.filter((item) => item !== normalizedId);
    await this.setRegistry(nextEnabled);
    return { ...existing, enabled: false };
  }

  private async discover(): Promise<{ items: SkillItem[]; invalidSkills: InvalidSkillItem[] }> {
    if (!(await pathExists(this.skillsRootDir))) {
      return {
        items: [],
        invalidSkills: []
      };
    }

    const entries = await readdir(this.skillsRootDir, { withFileTypes: true });
    const items: SkillItem[] = [];
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
          path: normalizePath(path.relative(process.cwd(), skillFilePath)),
          source: 'local',
          enabled: false
        });
      } catch (error) {
        invalidSkills.push({
          id: defaultId,
          path: normalizePath(path.relative(process.cwd(), skillFilePath)),
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
        updatedAt: new Date(0).toISOString()
      };
    }

    const enabled = Array.from(
      new Set(
        value.enabled
          .filter((item) => typeof item === 'string')
          .map((item) => normalizeSkillId(item))
          .filter((item) => item.length > 0)
      )
    );

    return {
      enabled,
      updatedAt: value.updatedAt
    };
  }

  private async setRegistry(enabled: string[]): Promise<void> {
    const payload: SkillsRegistry = {
      enabled: Array.from(new Set(enabled.map((item) => normalizeSkillId(item)).filter((item) => item.length > 0))),
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
  updatedAt: string;
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return Array.isArray(payload.enabled) && typeof payload.updatedAt === 'string';
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

