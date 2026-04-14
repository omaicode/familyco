import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type {
  AiAdapterRegistry,
  AuditService,
  ApprovalMode,
  Plugin,
  PluginCapabilityDescriptor,
  PluginCapabilityKind,
  PluginModule,
  PluginRegistry,
  PluginRepository,
  PluginRunService,
  PluginService,
  PluginToolDefinition,
  CreatePluginInput,
  ToolExecutionResult
} from '@familyco/core';
import type { ServerToolDefinition } from '../../tools/tool.types.js';

/** Shape of the `familyco` field inside a plugin's package.json */
interface FamilyCoPluginManifest {
  plugin: true;
  /** Path to entry module, relative to plugin directory. Default: "src/index.ts" */
  entry?: string;
  /**
   * When true, the plugin is a built-in default: always active and cannot be
   * disabled by the user. Use for first-party plugins shipped with FamilyCo.
   */
  default?: boolean;
}

export interface PluginToolExecutor {
  registerPluginTools(tools: readonly ServerToolDefinition[]): void;
  clearPluginTools(): void;
}

export interface PluginLoaderDeps {
  pluginService: PluginService;
  pluginRegistry: PluginRegistry;
  pluginRepository: PluginRepository;
  auditService: AuditService;
  pluginsRootDir: string;
  /** Optional — when provided, enabled plugin tools are injected into the executor. */
  toolExecutor?: PluginToolExecutor;
  /** Optional — tracks per-capability execution runs. */
  pluginRunService?: PluginRunService;
  /** Optional — when provided, plugin model-provider adapters are registered. */
  adapterRegistry?: AiAdapterRegistry;
}

/**
 * Discovers PLUGIN.md files from the plugins/ directory, syncs state with DB,
 * and populates the in-memory PluginRegistry.
 */
export class PluginLoaderService {
  /** IDs of plugins that are always active and cannot be disabled. */
  private readonly defaultPluginIds = new Set<string>();

  constructor(private readonly deps: PluginLoaderDeps) {}

  /** Returns true when the given plugin id is a built-in default plugin. */
  isDefault(id: string): boolean {
    return this.defaultPluginIds.has(id);
  }

  /**
   * Full discovery scan: find sub-directories that contain a package.json with
   * `familyco.plugin: true`, import the entry module to read plugin metadata,
   * and upsert into DB.
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
      const pkgPath = path.join(pluginDir, 'package.json');
      if (!(await pathExists(pkgPath))) continue;

      const id = normalizeId(entry.name);
      try {
        const pkgContent = await readFile(pkgPath, 'utf8');
        const pkg = JSON.parse(pkgContent) as Record<string, unknown>;

        const familyco = pkg.familyco as FamilyCoPluginManifest | undefined;
        if (!familyco || familyco.plugin !== true) continue;

        const entryRelative = familyco.entry ?? 'src/index.js';
        const entryAbsPath = path.join(pluginDir, entryRelative);

        if (!(await pathExists(entryAbsPath))) {
          errors.push(`${entry.name}: entry not found — ${entryRelative}`);
          continue;
        }

        const mod = await loadPluginModuleFromPath(entryAbsPath);
        if (!mod) {
          errors.push(`${entry.name}: failed to import entry module — ${entryRelative}`);
          continue;
        }

        const version = typeof pkg.version === 'string' ? pkg.version : (mod.version ?? '0.0.0');
        const checksum = computeChecksum(pkgContent);
        const capabilities = deriveCapabilities(mod);

        discoveredIds.add(id);

        const isDefaultPlugin = familyco.default === true || mod.isDefault === true;
        if (isDefaultPlugin) {
          this.defaultPluginIds.add(id);
        }

        const existing = await this.deps.pluginService.getById(id);
        if (existing) {
          if (existing.checksum !== checksum) {
            await this.deps.pluginService.update({
              id,
              name: mod.name,
              description: mod.description,
              version,
              author: mod.author ?? null,
              tags: [...(mod.tags ?? [])],
              entry: entryRelative,
              capabilities,
              checksum,
              errorMessage: null
            });
            await this.deps.auditService.write({
              actorId: 'system',
              action: 'plugin.updated',
              targetId: id,
              payload: { checksum, previousChecksum: existing.checksum }
            });
          }
          // Default plugins must stay enabled even if the DB record drifted.
          if (isDefaultPlugin && existing.state !== 'enabled') {
            await this.deps.pluginService.enable(id);
          }
        } else {
          const input: CreatePluginInput = {
            id,
            name: mod.name,
            description: mod.description,
            version,
            author: mod.author ?? null,
            tags: [...(mod.tags ?? [])],
            path: normalizePath(pluginDir),
            entry: entryRelative,
            capabilities,
            state: isDefaultPlugin ? 'enabled' : 'discovered',
            approvalMode: (mod.defaultApprovalMode ?? 'require_review') as ApprovalMode,
            checksum,
            errorMessage: null
          };
          await this.deps.pluginService.create(input);
          await this.deps.auditService.write({
            actorId: 'system',
            action: 'plugin.discovered',
            targetId: id,
            payload: { name: mod.name, version, isDefault: isDefaultPlugin }
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'DISCOVER_FAILED';
        errors.push(`${entry.name}: ${message}`);
      }
    }

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
   * For each enabled plugin, dynamically imports its entry module to get real
   * tool handlers and skill content. Falls back to PLUGIN.md capability stubs
   * when the module cannot be loaded.
   * Call after enable/disable operations.
   */
  async refreshRegistry(): Promise<void> {
    this.deps.pluginRegistry.clear();
    const allPlugins = await this.deps.pluginService.list();
    for (const plugin of allPlugins) {
      this.deps.pluginRegistry.register(plugin);
    }

    if (!this.deps.toolExecutor) return;

    this.deps.toolExecutor.clearPluginTools();

    const enabledPlugins = allPlugins.filter(
      (p) => p.state === 'enabled' || this.defaultPluginIds.has(p.id)
    );
    const stubs: ServerToolDefinition[] = [];

    for (const plugin of enabledPlugins) {
      const module = await loadPluginModule(plugin);

      if (module) {
        this.deps.pluginRegistry.setLoadedModule(plugin.id, module);
        try {
          await module.onEnable?.({ pluginId: plugin.id, pluginDir: plugin.path });
        } catch {
          // lifecycle hooks are best-effort
        }
        stubs.push(
          ...buildToolStubsFromModule(plugin, module, this.deps.pluginRegistry, this.deps.pluginRunService)
        );
      } else {
        // Fallback: generate stubs from PLUGIN.md capability descriptors
        stubs.push(
          ...buildToolStubsFromCapabilities(plugin, this.deps.pluginRegistry, this.deps.pluginRunService)
        );
      }
    }

    this.deps.toolExecutor.registerPluginTools(stubs);
  }
}

// ---------------------------------------------------------------------------
// Module loader
// ---------------------------------------------------------------------------

async function loadPluginModule(plugin: Plugin): Promise<PluginModule | null> {
  return loadPluginModuleFromPath(path.join(plugin.path, plugin.entry));
}

async function loadPluginModuleFromPath(entryAbsPath: string): Promise<PluginModule | null> {
  const entryUrl = pathToFileURL(entryAbsPath).href;
  try {
    const mod = (await import(entryUrl)) as { default?: PluginModule };
    return mod?.default ?? null;
  } catch {
    return null;
  }
}

/**
 * Derive PluginCapabilityDescriptor[] from a loaded module's tools and skills.
 * This is stored in the DB so the registry can list capabilities without
 * re-importing the module.
 */
function deriveCapabilities(mod: PluginModule): PluginCapabilityDescriptor[] {
  return [
    ...(mod.tools ?? []).map(
      (t): PluginCapabilityDescriptor => ({ kind: 'tool', name: t.name, description: t.description })
    ),
    ...(mod.skills ?? []).map(
      (s): PluginCapabilityDescriptor => ({ kind: 'skill', name: s.name, description: s.description })
    )
  ];
}

// ---------------------------------------------------------------------------
// Tool stub builder — from loaded module (Phase 3.3 npm-style)
// ---------------------------------------------------------------------------

/**
 * Build ServerToolDefinitions from a plugin module's real tool execute handlers.
 */
function buildToolStubsFromModule(
  plugin: Plugin,
  module: PluginModule,
  pluginRegistry: PluginRegistry,
  pluginRunService: PluginRunService | undefined
): ServerToolDefinition[] {
  if (!module.tools?.length) return [];

  return module.tools.map((toolDef) =>
    buildServerToolFromPluginTool(plugin, toolDef, pluginRegistry, pluginRunService)
  );
}

function buildServerToolFromPluginTool(
  plugin: Plugin,
  toolDef: PluginToolDefinition,
  pluginRegistry: PluginRegistry,
  pluginRunService: PluginRunService | undefined
): ServerToolDefinition {
  const toolName = `plugin.${plugin.id}.${toolDef.name}`;
  const description =
    `[Plugin: ${plugin.name}] ${toolDef.description}` +
    (plugin.approvalMode === 'require_review' ? ' (Requires approval before execution.)' : '');

  return {
    name: toolName,
    description,
    parameters: toolDef.parameters as ServerToolDefinition['parameters'],
    async execute(argumentsMap, _context): Promise<ToolExecutionResult> {
      const current = pluginRegistry.get(plugin.id);
      if (!current || current.state !== 'enabled') {
        return {
          ok: false,
          toolName,
          error: {
            code: 'PLUGIN_DISABLED',
            message: `Plugin "${plugin.name}" is not enabled. Enable it in the Plugins page before using its capabilities.`
          }
        };
      }

      let runId: string | null = null;
      if (pluginRunService) {
        try {
          const run = await pluginRunService.start({
            pluginId: plugin.id,
            agentRunId: null,
            capability: 'tool',
            inputJson: argumentsMap
          });
          runId = run.id;
        } catch {
          // best-effort
        }
      }

      let result: ToolExecutionResult;
      try {
        const pluginResult = await toolDef.execute(argumentsMap, {
          pluginId: plugin.id,
          agentRunId: null
        });
        result = { ok: pluginResult.ok, toolName, output: pluginResult.output, error: pluginResult.error };
      } catch (err) {
        result = {
          ok: false,
          toolName,
          error: {
            code: 'PLUGIN_TOOL_ERROR',
            message: err instanceof Error ? err.message : 'Plugin tool execution failed'
          }
        };
      }

      if (pluginRunService && runId) {
        try {
          if (result.ok) {
            await pluginRunService.complete(runId, result.output);
          } else {
            await pluginRunService.fail(runId, result.error?.message ?? 'Unknown error');
          }
        } catch {
          // best-effort
        }
      }

      return result;
    }
  };
}

// ---------------------------------------------------------------------------
// Fallback stub builder — from PLUGIN.md capability descriptors
// ---------------------------------------------------------------------------

function buildToolStubsFromCapabilities(
  plugin: Plugin,
  pluginRegistry: PluginRegistry,
  pluginRunService: PluginRunService | undefined
): ServerToolDefinition[] {
  return plugin.capabilities
    .map((cap) => buildFallbackStub(plugin, cap, pluginRegistry, pluginRunService))
    .filter((s): s is ServerToolDefinition => s !== null);
}

function buildFallbackStub(
  plugin: Plugin,
  cap: PluginCapabilityDescriptor,
  pluginRegistry: PluginRegistry,
  pluginRunService: PluginRunService | undefined
): ServerToolDefinition | null {
  const kind = cap.kind as PluginCapabilityKind;
  if (kind === 'skill' || kind === 'model-provider') return null;

  const toolName = `plugin.${plugin.id}.${cap.name}`;
  const description =
    `[Plugin: ${plugin.name}] ${cap.description}` +
    (plugin.approvalMode === 'require_review' ? ' (Requires approval before execution.)' : '');

  const parameters =
    kind === 'web-search'
      ? [{ name: 'query', type: 'string', required: true, description: 'Search query string.' }]
      : kind === 'web-fetch'
        ? [{ name: 'url', type: 'string', required: true, description: 'URL to fetch content from.' }]
        : [{ name: 'input', type: 'string', required: false, description: 'Tool input as JSON string.' }];

  return {
    name: toolName,
    description,
    parameters,
    async execute(argumentsMap, _context): Promise<ToolExecutionResult> {
      const current = pluginRegistry.get(plugin.id);
      if (!current || current.state !== 'enabled') {
        return {
          ok: false,
          toolName,
          error: {
            code: 'PLUGIN_DISABLED',
            message: `Plugin "${plugin.name}" is not enabled. Enable it from the Plugins page before using its capabilities.`
          }
        };
      }

      let runId: string | null = null;
      if (pluginRunService) {
        try {
          const run = await pluginRunService.start({
            pluginId: plugin.id,
            agentRunId: null,
            capability: kind,
            inputJson: argumentsMap
          });
          runId = run.id;
        } catch {
          // best-effort
        }
      }

      let result: ToolExecutionResult;

      if (kind === 'web-search') {
        const query = typeof argumentsMap.query === 'string' ? argumentsMap.query.trim() : '';
        result = query
          ? { ok: true, toolName, output: { query, results: [], note: 'Load plugin module to execute real search.' } }
          : { ok: false, toolName, error: { code: 'INVALID_ARGUMENTS', message: 'web-search requires a non-empty query.' } };
      } else if (kind === 'web-fetch') {
        const url = typeof argumentsMap.url === 'string' ? argumentsMap.url.trim() : '';
        result = url
          ? { ok: true, toolName, output: { url, content: null, note: 'Load plugin module to execute real fetch.' } }
          : { ok: false, toolName, error: { code: 'INVALID_ARGUMENTS', message: 'web-fetch requires a non-empty url.' } };
      } else {
        result = {
          ok: true,
          toolName,
          output: { pluginId: plugin.id, capability: cap.name, note: 'Plugin module not loaded.', input: argumentsMap }
        };
      }

      if (pluginRunService && runId) {
        try {
          if (result.ok) {
            await pluginRunService.complete(runId, result.output);
          } else {
            await pluginRunService.fail(runId, result.error?.message ?? 'Unknown error');
          }
        } catch {
          // best-effort
        }
      }

      return result;
    }
  };
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
