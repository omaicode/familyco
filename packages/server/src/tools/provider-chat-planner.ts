import type { SettingsService } from '@familyco/core';

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
  message: string;
  companyProfile: CompanyProfile;
  tools: ToolDefinitionSummary[];
}

interface ProviderSettings {
  providerName: 'openai' | 'anthropic' | 'google';
  apiKey: string;
  model: string;
}

export async function planChatWithProvider(
  input: PlanChatWithProviderInput
): Promise<PlannedChatResponse | null> {
  const providerSettings = await readProviderSettings(input.settingsService);
  if (!providerSettings) {
    return null;
  }

  const systemPrompt = buildSystemPrompt(input.companyProfile, input.tools);
  const userPrompt = buildUserPrompt(input.message);

  const rawText = await requestPlannerCompletion({
    providerSettings,
    systemPrompt,
    userPrompt
  });

  const parsed = parsePlannerResponse(rawText, input.tools);
  return {
    ...parsed,
    providerName: providerSettings.providerName,
    model: providerSettings.model
  };
}

async function readProviderSettings(settingsService?: SettingsService): Promise<ProviderSettings | null> {
  if (!settingsService) {
    return null;
  }

  const [providerSetting, apiKeySetting, modelSetting] = await Promise.all([
    settingsService.get('provider.name'),
    settingsService.get('provider.apiKey'),
    settingsService.get('provider.defaultModel')
  ]);

  const providerName = asProviderName(providerSetting?.value);
  const apiKey = asNonEmptyString(apiKeySetting?.value);
  const model = asNonEmptyString(modelSetting?.value);

  if (!providerName || !apiKey || !model) {
    return null;
  }

  return {
    providerName,
    apiKey,
    model
  };
}

function asProviderName(value: unknown): ProviderSettings['providerName'] | undefined {
  return value === 'openai' || value === 'anthropic' || value === 'google'
    ? value
    : undefined;
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

function buildUserPrompt(message: string): string {
  return [
    'Founder message:',
    message,
    '',
    'Return JSON only.'
  ].join('\n');
}

async function requestPlannerCompletion(input: {
  providerSettings: ProviderSettings;
  systemPrompt: string;
  userPrompt: string;
}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    if (input.providerSettings.providerName === 'openai') {
      return requestOpenAIPlan(input, controller.signal);
    }

    if (input.providerSettings.providerName === 'anthropic') {
      return requestAnthropicPlan(input, controller.signal);
    }

    return requestGooglePlan(input, controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function requestOpenAIPlan(
  input: {
    providerSettings: ProviderSettings;
    systemPrompt: string;
    userPrompt: string;
  },
  signal: AbortSignal
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${input.providerSettings.apiKey}`
    },
    body: JSON.stringify({
      model: input.providerSettings.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt }
      ]
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(readProviderError('openai', payload));
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('PROVIDER_INVALID_RESPONSE:OpenAI returned an empty planning response');
  }

  return content;
}

async function requestAnthropicPlan(
  input: {
    providerSettings: ProviderSettings;
    systemPrompt: string;
    userPrompt: string;
  },
  signal: AbortSignal
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': input.providerSettings.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: input.providerSettings.model,
      max_tokens: 800,
      temperature: 0.2,
      system: input.systemPrompt,
      messages: [
        {
          role: 'user',
          content: input.userPrompt
        }
      ]
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(readProviderError('anthropic', payload));
  }

  const content = Array.isArray(payload?.content)
    ? payload.content
        .map((part: { text?: string }) => part?.text ?? '')
        .join('\n')
        .trim()
    : '';

  if (content.length === 0) {
    throw new Error('PROVIDER_INVALID_RESPONSE:Anthropic returned an empty planning response');
  }

  return content;
}

async function requestGooglePlan(
  input: {
    providerSettings: ProviderSettings;
    systemPrompt: string;
    userPrompt: string;
  },
  signal: AbortSignal
): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    input.providerSettings.model
  )}:generateContent?key=${encodeURIComponent(input.providerSettings.apiKey)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${input.systemPrompt}\n\n${input.userPrompt}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json'
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(readProviderError('google', payload));
  }

  const content = Array.isArray(payload?.candidates?.[0]?.content?.parts)
    ? payload.candidates[0].content.parts
        .map((part: { text?: string }) => part?.text ?? '')
        .join('\n')
        .trim()
    : '';

  if (content.length === 0) {
    throw new Error('PROVIDER_INVALID_RESPONSE:Google returned an empty planning response');
  }

  return content;
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

function readProviderError(providerName: string, payload: unknown): string {
  if (isRecord(payload)) {
    if (isRecord(payload.error)) {
      const nestedMessage = asNonEmptyString(payload.error.message);
      if (nestedMessage) {
        return `PROVIDER_REQUEST_FAILED:${providerName}:${nestedMessage}`;
      }
    }

    const message = asNonEmptyString(payload.message);
    if (message) {
      return `PROVIDER_REQUEST_FAILED:${providerName}:${message}`;
    }
  }

  return `PROVIDER_REQUEST_FAILED:${providerName}:Unknown provider error`;
}
