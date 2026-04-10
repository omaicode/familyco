import type {
  AdapterPlannedToolCall,
  AiAdapterRegistry,
  SettingsService
} from '@familyco/core';
import type { SkillsService } from '../modules/skills/skills.service.js';

import type { CompanyProfile } from './company-profile-read.tool.js';
import { asNonEmptyString, isRecord } from './tool.helpers.js';
import type { ToolDefinitionSummary } from './tool.types.js';

export interface PlannedToolCall {
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface PlannedChatResponse {
  reply: string;
  toolCalls: PlannedToolCall[];
  providerName: string;
  model: string;
}

interface SendChatInput {
  settingsService?: SettingsService;
  skillsService?: SkillsService;
  adapterRegistry?: AiAdapterRegistry;
  /** Override adapter for this specific agent (null = use system default) */
  agentAdapterId?: string | null;
  /** Override model for this specific agent (null = use system default) */
  agentModel?: string | null;
  message: string;
  companyProfile: CompanyProfile;
  tools: ToolDefinitionSummary[];
  conversationHistory?: Array<{
    senderId: string;
    body: string;
    title?: string;
    createdAt?: string;
  }>;
}

type AdapterId = 'copilot' | 'openai' | 'claude';

interface AdapterConfig {
  adapterId: AdapterId;
  apiKey: string;
  model: string;
}

interface EnabledSkillSummary {
  id: string;
  name: string;
  description: string;
}

export async function sendChat(
  input: SendChatInput
): Promise<PlannedChatResponse | null> {
  const adapterConfig = await resolveAdapterConfig(
    input.settingsService,
    input.agentAdapterId,
    input.agentModel
  );
  if (!adapterConfig) {
    return null;
  }

  const enabledSkills = await resolveEnabledSkills(input.settingsService, input.skillsService);
  const systemPrompt = buildSystemPrompt(input.companyProfile, input.tools);
  const userPrompt = buildUserPrompt(input.message, input.conversationHistory ?? []);

  const adapterResponse = await requestAdapterChat({
    adapterConfig,
    systemPrompt,
    userPrompt,
    skills: enabledSkills,
    tools: input.tools,
    adapterRegistry: input.adapterRegistry
  });

  const parsed = parseChatResponse(adapterResponse.content, input.tools, adapterResponse.toolCalls);
  return {
    ...parsed,
    providerName: adapterConfig.adapterId,
    model: adapterConfig.model
  };
}

async function resolveAdapterConfig(
  settingsService?: SettingsService,
  agentAdapterId?: string | null,
  agentModel?: string | null
): Promise<AdapterConfig | null> {
  if (!settingsService) {
    return null;
  }

  const overrideAdapterId = agentAdapterId ? toAdapterId(agentAdapterId) : undefined;

  const [providerSetting, globalApiKeySetting, modelSetting] = await Promise.all([
    settingsService.get('provider.name'),
    settingsService.get('provider.apiKey'),
    settingsService.get('provider.defaultModel')
  ]);

  // Resolve adapter: agent override > global setting
  const adapterId = overrideAdapterId ?? toAdapterId(providerSetting?.value);
  if (!adapterId) {
    return null;
  }

  // Resolve model: agent override > global setting
  const model = (agentModel ? agentModel : null) ?? asNonEmptyString(modelSetting?.value);
  if (!model) {
    return null;
  }

  // Resolve API key: per-adapter key > global fallback
  const perAdapterKeySetting = await settingsService.get(`provider.${adapterId}.apiKey`);
  const apiKey =
    asNonEmptyString(perAdapterKeySetting?.value) ??
    asNonEmptyString(globalApiKeySetting?.value);
  if (!apiKey) {
    return null;
  }

  return { adapterId, apiKey, model };
}

function toAdapterId(value: unknown): AdapterId | undefined {
  if (value === 'copilot' || value === 'openai' || value === 'claude') {
    return value;
  }

  // Backward compat: old settings stored 'anthropic' or 'google'
  if (value === 'anthropic') return 'claude';

  return undefined;
}

function buildSystemPrompt(
  companyProfile: CompanyProfile,
  tools: ToolDefinitionSummary[]
): string {
  const toolDescriptions = tools.map((tool) => {
    const params = tool.parameters
      .map((parameter) => `${parameter.name}${parameter.required ? '*' : ''}: ${parameter.description}`)
      .join('; ');
    return `- ${tool.name}: ${tool.description}${params ? ` Parameters => ${params}` : ''}`;
  }).join('\n');

  return [
    'You are the FamilyCo executive agent.',
    'Decide whether the founder message needs one or more tools. Never guess hidden tools and never invent tool names.',
    'If no tool is needed, return an empty toolCalls array.',
    'If a tool is needed, choose from the provided tool list and include concrete arguments for every required field.',
    'If you do not know a valid agentId or projectId, omit that optional field instead of inventing a database identifier.',
    'Return strict JSON only with this shape:',
    '{"reply":"string","toolCalls":[{"toolName":"string","arguments":{}}]}',
    `Company name: ${companyProfile.companyName}`,
    `Company description: ${companyProfile.companyDescription || 'Not provided.'}`,
    'Available tools:',
    toolDescriptions
  ].join('\n');
}

function buildUserPrompt(
  message: string,
  conversationHistory: Array<{
    senderId: string;
    body: string;
    title?: string;
    createdAt?: string;
  }>
): string {
  const historyLines = conversationHistory
    .map((entry) => {
      const speaker = entry.senderId === 'founder' ? 'Founder' : 'Executive agent';
      const title = entry.title ? `${entry.title}: ` : '';
      const body = compactText(entry.body, 240);
      return `- ${speaker}: ${title}${body}`;
    })
    .join('\n');

  return [
    historyLines.length > 0 ? 'Recent conversation context:' : 'Recent conversation context: none',
    historyLines || '- No prior messages recorded.',
    '',
    'Latest founder message:',
    message,
    '',
    'Return JSON only.'
  ].join('\n');
}

function compactText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxLength - 1, 0)).trimEnd()}…`;
}

async function requestAdapterChat(input: {
  adapterConfig: AdapterConfig;
  systemPrompt: string;
  userPrompt: string;
  skills: EnabledSkillSummary[];
  tools: ToolDefinitionSummary[];
  adapterRegistry?: AiAdapterRegistry;
}): Promise<{ content: string; toolCalls: AdapterPlannedToolCall[] }> {
  if (input.adapterRegistry) {
    const adapter = input.adapterRegistry.get(input.adapterConfig.adapterId);
    if (adapter) {
      const adapterResult = await adapter.chat({
        apiKey: input.adapterConfig.apiKey,
        model: input.adapterConfig.model,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        skills: input.skills,
        tools: mapToolDefinitions(input.tools)
      });
      return {
        content: adapterResult.content,
        toolCalls: adapterResult.toolCalls ?? []
      };
    }
  }

  throw new Error(`ADAPTER_NOT_FOUND:${input.adapterConfig.adapterId}`);
}

async function resolveEnabledSkills(
  settingsService?: SettingsService,
  skillsService?: SkillsService
): Promise<EnabledSkillSummary[]> {
  if (skillsService) {
    const listed = await skillsService.list().catch(() => null);
    if (listed) {
      return listed.items
        .filter((skill) => skill.enabled)
        .map((skill) => ({
          id: skill.id,
          name: skill.name,
          description: skill.description
        }));
    }
  }

  const registry = await readSkillsRegistryFallback(settingsService);
  return registry.map((skillId) => ({
    id: skillId,
    name: skillId,
    description: 'Enabled local skill'
  }));
}

async function readSkillsRegistryFallback(settingsService?: SettingsService): Promise<string[]> {
  if (!settingsService) {
    return [];
  }

  const setting = await settingsService.get('skills.registry');
  if (!isRecord(setting?.value) || !Array.isArray(setting.value.enabled)) {
    return [];
  }

  return setting.value.enabled.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

function parseChatResponse(
  text: string,
  tools: ToolDefinitionSummary[],
  adapterToolCalls: AdapterPlannedToolCall[]
): Omit<PlannedChatResponse, 'providerName' | 'model'> {
  const parsed = tryParseJsonObject(text);
  const availableToolNames = new Set(tools.map((tool) => tool.name));
  const normalizedAdapterToolCalls = adapterToolCalls
    .map((entry) => normalizeAdapterToolCall(entry, availableToolNames))
    .filter((entry): entry is PlannedToolCall => entry !== null);

  if (!isRecord(parsed)) {
    return {
      reply: asNonEmptyString(text) ?? 'I reviewed the request and kept it in the executive chat lane.',
      toolCalls: normalizedAdapterToolCalls
    };
  }

  const parsedToolCalls = Array.isArray(parsed.toolCalls)
    ? parsed.toolCalls
        .map((entry) => normalizeToolCall(entry, availableToolNames))
        .filter((entry): entry is PlannedToolCall => entry !== null)
    : [];

  const toolCalls = parsedToolCalls.length > 0 ? parsedToolCalls : normalizedAdapterToolCalls;

  return {
    reply:
      asNonEmptyString(parsed.reply)
      ?? 'I reviewed the request and kept it in the executive chat lane.',
    toolCalls
  };
}

function normalizeToolCall(
  value: unknown,
  availableToolNames: ReadonlySet<string>
): PlannedToolCall | null {
  if (!isRecord(value)) {
    return null;
  }

  const toolName = asNonEmptyString(value.toolName);
  if (!toolName || !availableToolNames.has(toolName)) {
    return null;
  }

  return {
    toolName,
    arguments: isRecord(value.arguments) ? value.arguments : {}
  };
}

function normalizeAdapterToolCall(
  value: AdapterPlannedToolCall,
  availableToolNames: ReadonlySet<string>
): PlannedToolCall | null {
  if (typeof value.name !== 'string' || value.name.length === 0 || !availableToolNames.has(value.name)) {
    return null;
  }

  return {
    toolName: value.name,
    arguments: isRecord(value.arguments) ? value.arguments : {}
  };
}

function mapToolDefinitions(tools: ToolDefinitionSummary[]): Array<{
  name: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
}> {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters.map((parameter) => ({
      name: parameter.name,
      type: parameter.type,
      required: parameter.required,
      description: parameter.description
    }))
  }));
}

function tryParseJsonObject(text: string): unknown {
  const cleaned = text.trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch?.[1]) {
      try {
        return JSON.parse(fencedMatch[1]);
      } catch {
        return null;
      }
    }

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const slice = cleaned.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(slice);
      } catch {
        return null;
      }
    }

    return null;
  }
}
