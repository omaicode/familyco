import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type {
  AuditService,
  Plugin,
  PluginRegistry,
  PluginRepository,
  PluginService,
  CreatePluginInput
} from '@familyco/core';

import { parsePluginMarkdown } from './plugin.parser.js';

export interface PluginLoaderDeps {
  pluginService: PluginService;
  pluginRegistry: PluginRegistry;
  pluginRepository: PluginRepository;
  auditService: AuditService;
  pluginsRootDir: string;
}

/**
 * Discovers PLUGIN.md files from the plugins/ directory, syncs state with DB,
 * and populates the in-memory PluginRegistry.
 */
export class PluginLoaderService {
  constructor(private readonly deps: PluginLoaderDeps) {}

  /**
   * Full discovery scan: find PLUGIN.md files, parse manifests, upsert into
   * DB, and populate the in-memory registry with enabled plugins.
   */
  async discover(): Promise<{ discovered: number; enabled: number; errors: string[] }> {
    const errors: string[] = [];
    const rootDir = this.deps.pluginsRootDir;

    if (!(await pathExists(rootDir))) {
      return { discovered: 0, enabled: 0, errors: [] };
    }

    const entries = await readdir(rootDir, { withFileTypes: true });
    const discoveredIds = new Set<string>();

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginDir = path.join(rootDir, entry.name);
      const manifestPath = path.join(pluginDir, 'PLUGIN.md');
      if (!(await pathExists(manifestPath))) continue;

      const defaultId = normalizeId(entry.name);
      try {
        const content = await readFile(manifestPath, 'utf8');
        const manifest = parsePluginMarkdown({ content, defaultId });
        const checksum = computeChecksum(content);

        discoveredIds.add(manifest.id);

        const existing = await this.deps.pluginService.getById(manifest.id);
        if (existing) {
          // Update metadata if checksum changed
          if (existing.checksum !== checksum) {
            await this.deps.pluginService.update({
              id: manifest.id,
              name: manifest.name,
              description: manifest.description,
              version: manifest.version,
              author: manifest.author ?? null,
              tags: manifest.tags as string[],
              entry: manifest.entry,
              capabilities: manifest.capabilities as Plugin['capabilities'],
              checksum,
              errorMessage: null
            });
            await this.deps.auditService.write({
              actorId: 'system',
              action: 'plugin.updated',
              targetId: manifest.id,
              payload: { checksum, previousChecksum: existing.checksum }
            });
          }
        } else {
          const input: CreatePluginInput = {
            id: manifest.id,
            name: manifest.name,
            description: manifest.description,
            version: manifest.version,
            author: manifest.author ?? null,
            tags: manifest.tags as string[],
            path: normalizePath(pluginDir),
            entry: manifest.entry,
            capabilities: manifest.capabilities as Plugin['capabilities'],
            state: 'discovered',
            approvalMode: manifest.defaultApprovalMode,
            checksum,
            errorMessage: null
          };
          await this.deps.pluginService.create(input);
          await this.deps.auditService.write({
            actorId: 'system',
            action: 'plugin.discovered',
            targetId: manifest.id,
            payload: { name: manifest.name, version: manifest.version }
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'PLUGIN_PARSE_FAILED';
        errors.push(`${entry.name}: ${message}`);
      }
    }

    // Populate registry from DB (respects enable/disable decisions)
    await this.refreshRegistry();

    const allPlugins = await this.deps.pluginService.list();
    const enabledPlugins = allPlugins.filter((p) => p.state === 'enabled');

    return {
      discovered: discoveredIds.size,
      enabled: enabledPlugins.length,
      errors
    };
  }

  /**
   * Reload the in-memory registry from persisted plugin data.
   * Call after enable/disable operations.
   */
  async refreshRegistry(): Promise<void> {
    this.deps.pluginRegistry.clear();
    const allPlugins = await this.deps.pluginService.list();
    for (const plugin of allPlugins) {
      this.deps.pluginRegistry.register(plugin);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function computeChecksum(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
}

function normalizeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-_ ]+/g, '').replace(/[_\s]+/g, '-');
}

function normalizePath(absolutePath: string): string {
  return absolutePath.split(path.sep).join('/');
}
