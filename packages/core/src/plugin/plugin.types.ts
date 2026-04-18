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
// Plugin tool and skill definitions — exported by plugin entry module
// ---------------------------------------------------------------------------

export interface PluginToolParameter {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly description: string;
}

export interface PluginToolContext {
  readonly pluginId: string;
  readonly agentRunId: string | null;
}

export interface PluginToolResult {
  ok: boolean;
  output?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export interface PluginToolCustomFieldDefinition {
  readonly name: string;
  readonly type: "text" | "number" | "boolean" | "select";
  readonly required: boolean;
  readonly description?: string;
  readonly options?: readonly string[]; // For "select" type, the list of options to choose from
}

export interface PluginToolDefinition {
  /** Short tool name — loader will namespace it as plugin.{pluginId}.{name} */
  readonly name: string;
  readonly description: string;
  readonly parameters: readonly PluginToolParameter[];
  readonly enabledByDefault?: boolean;

  /** Custom fields using for defining additional plugin tool properties likes: API_KEY, TIMEOUT, etc. */
  /** The application will read these fields and show it in the UI as a form for user input and store it to the Setting table */
  readonly customFields?: Readonly<Record<string, PluginToolCustomFieldDefinition>>;

  /** Execute the tool with the given arguments and context */
  execute(args: Record<string, unknown>, ctx: PluginToolContext): Promise<PluginToolResult>;
}

export interface PluginSkillDefinition {
  /** Short skill name — used as id prefix plugin:{pluginId}:{name} */
  readonly name: string;
  readonly description: string;
  /** Full Markdown content injected into the agent's system prompt */
  readonly content: string;
  /** Optional agent level filter (e.g. ['L0', 'L1']). Omit to apply to all levels. */
  readonly applyTo?: readonly string[];
  /** Whether the skill is enabled by default */
  readonly enabledByDefault?: boolean;
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
  // ---------------------------------------------------------------------------
  // Metadata — read by the loader to upsert into DB at discovery time
  // ---------------------------------------------------------------------------
  /** Human-readable plugin name, e.g. "Web Researcher" */
  readonly name: string;
  /** Short description of what this plugin does */
  readonly description: string;
  /** Semver version string */
  readonly version?: string;
  /** Author name or organisation */
  readonly author?: string;
  /** Searchable tags */
  readonly tags?: readonly string[];
  /** Default approval mode for side-effects triggered by this plugin */
  readonly defaultApprovalMode?: ApprovalMode;
  /**
   * When true, this plugin is a built-in default: always active, cannot be disabled by the user.
   * Set via `familyco.default: true` in the plugin's package.json.
   */
  readonly isDefault?: boolean;
  /** Tools this plugin provides — real execute handlers, not stubs */
  readonly tools?: readonly PluginToolDefinition[];
  /** Skills this plugin provides — content injected into agent system prompts */
  readonly skills?: readonly PluginSkillDefinition[];
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

// ---------------------------------------------------------------------------
// PluginRun — execution trace for a single capability invocation
// ---------------------------------------------------------------------------

export type PluginRunState = 'running' | 'completed' | 'failed';

export interface PluginRun {
  readonly id: string;
  readonly pluginId: string;
  readonly agentRunId: string | null;
  /** Capability kind that was invoked */
  readonly capability: PluginCapabilityKind;
  readonly state: PluginRunState;
  readonly inputJson: unknown | null;
  readonly outputJson: unknown | null;
  readonly errorMessage: string | null;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly createdAt: Date;
}

export interface CreatePluginRunInput {
  id: string;
  pluginId: string;
  agentRunId: string | null;
  capability: PluginCapabilityKind;
  inputJson: unknown | null;
}

export interface UpdatePluginRunInput {
  id: string;
  state: PluginRunState;
  outputJson?: unknown | null;
  errorMessage?: string | null;
  finishedAt?: Date;
}
