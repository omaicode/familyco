import type { ApprovalMode } from '../approval/approval.entity.js';

// ---------------------------------------------------------------------------
// Capability kinds supported in V1
// ---------------------------------------------------------------------------

export type PluginCapabilityKind =
  | 'tool'
  | 'skill'
  | 'model-provider'
  | 'web-fetch'
  | 'web-search';

// ---------------------------------------------------------------------------
// Per-capability descriptors — declared by plugin manifest
// ---------------------------------------------------------------------------

export interface PluginToolDescriptor {
  readonly kind: 'tool';
  /** Dot-separated tool name (e.g. "github.pr.list") */
  readonly name: string;
  readonly description: string;
}

export interface PluginSkillDescriptor {
  readonly kind: 'skill';
  readonly name: string;
  readonly description: string;
}

export interface PluginModelProviderDescriptor {
  readonly kind: 'model-provider';
  /** Adapter id that will be registered in AiAdapterRegistry */
  readonly adapterId: string;
  readonly name: string;
  readonly description: string;
}

export interface PluginWebFetchDescriptor {
  readonly kind: 'web-fetch';
  readonly name: string;
  readonly description: string;
}

export interface PluginWebSearchDescriptor {
  readonly kind: 'web-search';
  readonly name: string;
  readonly description: string;
}

export type PluginCapabilityDescriptor =
  | PluginToolDescriptor
  | PluginSkillDescriptor
  | PluginModelProviderDescriptor
  | PluginWebFetchDescriptor
  | PluginWebSearchDescriptor;

// ---------------------------------------------------------------------------
// Plugin manifest — parsed from PLUGIN.md frontmatter
// ---------------------------------------------------------------------------

export interface PluginManifest {
  /** Unique slug derived from directory name */
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly author?: string;
  readonly tags: readonly string[];
  /** Entry module path relative to plugin directory */
  readonly entry: string;
  /** Capabilities declared by the plugin */
  readonly capabilities: readonly PluginCapabilityDescriptor[];
  /** Default approval mode for side-effects triggered by plugin capabilities */
  readonly defaultApprovalMode: ApprovalMode;
}

// ---------------------------------------------------------------------------
// Plugin entity — runtime + persisted state
// ---------------------------------------------------------------------------

export type PluginState = 'discovered' | 'enabled' | 'disabled' | 'error';

export interface Plugin {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly author: string | null;
  readonly tags: readonly string[];
  readonly path: string;
  readonly entry: string;
  readonly capabilities: readonly PluginCapabilityDescriptor[];
  readonly state: PluginState;
  readonly approvalMode: ApprovalMode;
  readonly checksum: string;
  readonly errorMessage: string | null;
  readonly discoveredAt: Date;
  readonly updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Plugin lifecycle hooks — implemented by plugin entry module
// ---------------------------------------------------------------------------

export interface PluginContext {
  /** Plugin's own id */
  readonly pluginId: string;
  /** Absolute path to plugin directory */
  readonly pluginDir: string;
}

export interface PluginModule {
  /** Called once when the plugin is loaded and registered */
  onRegister?(ctx: PluginContext): Promise<void> | void;
  /** Called when the plugin transitions to enabled */
  onEnable?(ctx: PluginContext): Promise<void> | void;
  /** Called when the plugin transitions to disabled */
  onDisable?(ctx: PluginContext): Promise<void> | void;
  /** Called when the plugin is unloaded */
  onUnregister?(ctx: PluginContext): Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Mutation inputs for service / repository
// ---------------------------------------------------------------------------

export interface CreatePluginInput {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string | null;
  tags: readonly string[];
  path: string;
  entry: string;
  capabilities: readonly PluginCapabilityDescriptor[];
  state: PluginState;
  approvalMode: ApprovalMode;
  checksum: string;
  errorMessage: string | null;
}

export interface UpdatePluginInput {
  id: string;
  name?: string;
  description?: string;
  version?: string;
  author?: string | null;
  tags?: readonly string[];
  entry?: string;
  capabilities?: readonly PluginCapabilityDescriptor[];
  state?: PluginState;
  approvalMode?: ApprovalMode;
  checksum?: string;
  errorMessage?: string | null;
}
