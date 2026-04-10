import type { AiAdapterRegistry, SettingsService } from '@familyco/core';

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

interface PlanChatWithProviderInput {
  settingsService?: SettingsService;
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

interface ProviderSettings {
  providerName: AdapterId;
  apiKey: string;
  model: string;
}

export async function planChatWithProvider(
  input: PlanChatWithProviderInput
): Promise<PlannedChatResponse | null> {
  const providerSettings = await readProviderSettings(
    input.settingsService,
    input.agentAdapterId,
    input.agentModel
  );
  if (!providerSettings) {
    return null;
  }

  const systemPrompt = buildSystemPrompt(input.companyProfile, input.tools);
  const userPrompt = buildUserPrompt(input.message, input.conversationHistory ?? []);

  const rawText = await requestPlannerCompletion({
    providerSettings,
    systemPrompt,
    userPrompt,
    adapterRegistry: input.adapterRegistry
  });

  const parsed = parsePlannerResponse(rawText, input.tools);
  return {
    ...parsed,
    providerName: providerSettings.providerName,
    model: providerSettings.model
  };
}

async function readProviderSettings(
  settingsService?: SettingsService,
  agentAdapterId?: string | null,
  agentModel?: string | null
): Promise<ProviderSettings | null> {
  if (!settingsService) {
    return null;
  }

  const overrideAdapterId = agentAdapterId ? asAdapterId(agentAdapterId) : undefined;

  const [providerSetting, globalApiKeySetting, modelSetting] = await Promise.all([
    settingsService.get('provider.name'),
    settingsService.get('provider.apiKey'),
    settingsService.get('provider.defaultModel')
  ]);

  // Resolve adapter: agent override > global setting
  const providerName = overrideAdapterId ?? asAdapterId(providerSetting?.value);
  if (!providerName) {
    return null;
  }

  // Resolve model: agent override > global setting
  const model = (agentModel ? agentModel : null) ?? asNonEmptyString(modelSetting?.value);
  if (!model) {
    return null;
  }

  // Resolve API key: per-adapter key > global fallback
  const perAdapterKeySetting = await settingsService.get(`provider.${providerName}.apiKey`);
  const apiKey =
    asNonEmptyString(perAdapterKeySetting?.value) ??
    asNonEmptyString(globalApiKeySetting?.value);
  if (!apiKey) {
    return null;
  }

  return { providerName, apiKey, model };
}

function asAdapterId(value: unknown): AdapterId | undefined {
  if (value === 'copilot' || value === 'openai' || value === 'claude') {
    return value;
  }

  // Backward compat: old settings stored 'anthropic' or 'google'
  if (value === 'anthropic') return 'claude';

  return undefined;
}

function buildSystemPrompt(companyProfile: CompanyProfile, tools: ToolDefinitionSummary[]): string {
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
    .slice(-12)
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

async function requestPlannerCompletion(input: {
  providerSettings: ProviderSettings;
  systemPrompt: string;
  userPrompt: string;
  adapterRegistry?: AiAdapterRegistry;
}): Promise<string> {
  if (input.adapterRegistry) {
    const adapter = input.adapterRegistry.get(input.providerSettings.providerName);
    if (adapter) {
      return adapter.chat({
        apiKey: input.providerSettings.apiKey,
        model: input.providerSettings.model,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt
      });
    }
  }

  throw new Error(`ADAPTER_NOT_FOUND:${input.providerSettings.providerName}`);
}

function parsePlannerResponse(text: string, tools: ToolDefinitionSummary[]): Omit<PlannedChatResponse, 'providerName' | 'model'> {
  const parsed = tryParseJsonObject(text);
  const availableToolNames = new Set(tools.map((tool) => tool.name));

  if (!isRecord(parsed)) {
    return {
      reply: 'I reviewed the request and kept it in the executive chat lane.',
      toolCalls: []
    };
  }

  const toolCalls = Array.isArray(parsed.toolCalls)
    ? parsed.toolCalls
        .map((entry) => normalizeToolCall(entry, availableToolNames))
        .filter((entry): entry is PlannedToolCall => entry !== null)
    : [];

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
