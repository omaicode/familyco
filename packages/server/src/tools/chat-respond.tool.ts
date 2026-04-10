import type { ToolExecutionResult } from '@familyco/core';

import type { CompanyProfile } from './company-profile-read.tool.js';
import { sendChat } from './chat.js';
import { asNonEmptyString, extractEntityLabel, invalidArguments, isRecord } from './tool.helpers.js';
import type { ServerToolDefinition, ToolDefinitionSummary } from './tool.types.js';

interface ExplicitToolCall {
  toolName: string;
  arguments: Record<string, unknown>;
}

interface ChatToolCall {
  toolName: string;
  ok: boolean;
  summary: string;
  output?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

interface ConversationHistoryEntry {
  senderId: string;
  body: string;
  title?: string;
  createdAt?: string;
}

interface ChatToolOutput {
  reply: string;
  toolCalls: ChatToolCall[];
  task?: unknown;
  project?: unknown;
  availableTools: ToolDefinitionSummary[];
}

export const chatRespondTool: ServerToolDefinition = {
  name: 'chat.respond',
  description:
    'Compose a streaming-friendly executive reply. When a provider is configured, the agent decides whether to call tools and what arguments to pass by reasoning over the tool metadata.',
  parameters: [
    {
      name: 'message',
      type: 'string',
      required: true,
      description: 'Founder message that needs a conversational reply.'
    },
    {
      name: 'agentId',
      type: 'string',
      required: false,
      description: 'Current executive agent id handling the conversation.'
    },
    {
      name: 'meta',
      type: 'object',
      required: false,
      description:
        'Optional chat context such as projectId, taskId, or explicit toolCall/toolCalls selected by the agent with concrete arguments.'
    },
    {
      name: 'conversationHistory',
      type: 'array',
      required: false,
      description: 'Recent founder↔executive messages used as memory context for the current conversation.'
    }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    const message = asNonEmptyString(argumentsMap.message);
    if (!message) {
      return invalidArguments('chat.respond', 'chat.respond expects arguments.message as a non-empty string');
    }

    const profileResult = await context.executeTool({
      toolName: 'company.profile.read',
      arguments: {}
    });
    const profile = toCompanyProfile(profileResult.output);
    const availableTools = context.listTools().filter((tool) => tool.name !== 'chat.respond');
    const requestedToolCalls = readExplicitToolCalls(argumentsMap);
    const conversationHistory = readConversationHistory(argumentsMap);

    // Look up per-agent AI overrides when agentId is provided
    const agentId = asNonEmptyString(argumentsMap.agentId);
    let agentAdapterId: string | null = null;
    let agentModel: string | null = null;
    if (agentId && context.agentService) {
      const agentProfile = await context.agentService.getAgentById(agentId).catch(() => null);
      agentAdapterId = agentProfile?.aiAdapterId ?? null;
      agentModel = agentProfile?.aiModel ?? null;
    }

    const plannedResponse =
      requestedToolCalls.length > 0
        ? null
        : await sendChat({
            settingsService: context.settingsService,
            skillsService: context.skillsService,
            adapterRegistry: context.adapterRegistry,
            agentAdapterId,
            agentModel,
            message,
            companyProfile: profile,
            tools: availableTools,
            conversationHistory
          }).catch(() => null);
    const toolCallQueue = requestedToolCalls.length > 0 ? requestedToolCalls : plannedResponse?.toolCalls ?? [];
    const toolCalls: ChatToolCall[] = [];
    let createdTask: unknown | null = null;
    let createdProject: unknown | null = null;

    for (const requestedToolCall of toolCallQueue) {
      if (requestedToolCall.toolName === 'chat.respond') {
        continue;
      }

      const result = await context.executeTool({
        toolName: requestedToolCall.toolName,
        arguments: requestedToolCall.arguments
      });
      const summary = toToolCallSummary(result);
      toolCalls.push(summary);

      if (requestedToolCall.toolName === 'task.create' && result.ok) {
        createdTask = result.output ?? null;
      }

      if (requestedToolCall.toolName === 'project.create' && result.ok) {
        createdProject = result.output ?? null;
      }
    }

    return {
      ok: true,
      toolName: 'chat.respond',
      output: {
        reply: buildChatReply({
          profile,
          toolCalls,
          availableTools,
          plannedReply: plannedResponse?.reply ?? null
        }),
        toolCalls,
        task: createdTask,
        project: createdProject,
        availableTools
      } satisfies ChatToolOutput
    };
  }
};

function readExplicitToolCalls(argumentsMap: Record<string, unknown>): ExplicitToolCall[] {
  const directCalls = parseToolCallList(argumentsMap.toolCalls);
  if (directCalls.length > 0) {
    return directCalls;
  }

  const directSingle = parseToolCall(argumentsMap.toolCall);
  if (directSingle) {
    return [directSingle];
  }

  if (!isRecord(argumentsMap.meta)) {
    return [];
  }

  const metaCalls = parseToolCallList(argumentsMap.meta.toolCalls);
  if (metaCalls.length > 0) {
    return metaCalls;
  }

  const metaSingle = parseToolCall(argumentsMap.meta.toolCall);
  return metaSingle ? [metaSingle] : [];
}

function parseToolCallList(value: unknown): ExplicitToolCall[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => parseToolCall(entry))
    .filter((entry): entry is ExplicitToolCall => entry !== null);
}

function parseToolCall(value: unknown): ExplicitToolCall | null {
  if (!isRecord(value)) {
    return null;
  }

  const toolName = asNonEmptyString(value.toolName);
  if (!toolName) {
    return null;
  }

  return {
    toolName,
    arguments: isRecord(value.arguments) ? value.arguments : {}
  };
}

function readConversationHistory(argumentsMap: Record<string, unknown>): ConversationHistoryEntry[] {
  const directHistory = parseConversationHistory(argumentsMap.conversationHistory);
  if (directHistory.length > 0) {
    return directHistory;
  }

  if (!isRecord(argumentsMap.meta)) {
    return [];
  }

  return parseConversationHistory(argumentsMap.meta.conversationHistory);
}

function parseConversationHistory(value: unknown): ConversationHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => parseConversationEntry(entry))
    .filter((entry): entry is ConversationHistoryEntry => entry !== null);
}

function parseConversationEntry(value: unknown): ConversationHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const senderId = asNonEmptyString(value.senderId);
  const body = asNonEmptyString(value.body);
  if (!senderId || !body) {
    return null;
  }

  return {
    senderId,
    body,
    title: asNonEmptyString(value.title),
    createdAt: asNonEmptyString(value.createdAt)
  };
}

function toCompanyProfile(value: unknown): CompanyProfile {
  if (!isRecord(value)) {
    return {
      companyName: 'FamilyCo',
      companyDescription: ''
    };
  }

  return {
    companyName: asNonEmptyString(value.companyName) ?? 'FamilyCo',
    companyDescription: asNonEmptyString(value.companyDescription) ?? ''
  };
}

function toToolCallSummary(result: ToolExecutionResult): ChatToolCall {
  if (!result.ok) {
    return {
      toolName: result.toolName,
      ok: false,
      summary: result.error?.message ?? `The tool ${result.toolName} could not complete the request.`,
      error: result.error
    };
  }

  const label = extractEntityLabel(result.output);
  return {
    toolName: result.toolName,
    ok: true,
    summary: label ? `Executed ${result.toolName} for “${label}”.` : `Executed ${result.toolName}.`,
    output: result.output
  };
}

function buildChatReply(input: {
  profile: CompanyProfile;
  toolCalls: ChatToolCall[];
  availableTools: ToolDefinitionSummary[];
  plannedReply: string | null;
}): string {
  if (input.toolCalls.length === 0 && input.plannedReply) {
    return input.plannedReply;
  }

  if (input.toolCalls.length > 0) {
    const executedSummary = input.toolCalls.map((toolCall) => toolCall.summary).join(' ');
    if (input.plannedReply && input.plannedReply !== executedSummary) {
      return `${input.plannedReply} ${executedSummary}`.trim();
    }

    return executedSummary;
  }

  const descriptionText = input.profile.companyDescription.length > 0
    ? ` Company description: ${input.profile.companyDescription}`
    : '';
  const suggestedTools = input.availableTools
    .filter((tool) => tool.name === 'task.create' || tool.name === 'project.create')
    .map((tool) => formatToolSignature(tool))
    .join('; ');

  const suggestionLine = suggestedTools.length > 0
    ? ` When the agent decides to act, it should explicitly choose one of these tools and pass the needed parameters: ${suggestedTools}.`
    : '';

  return `I recorded your message for ${input.profile.companyName}. No tool was called automatically.${suggestionLine}${descriptionText}`;
}

function formatToolSignature(tool: ToolDefinitionSummary): string {
  const signature = tool.parameters
    .filter((parameter) => parameter.required)
    .map((parameter) => parameter.name)
    .join(', ');

  return signature.length > 0 ? `${tool.name}(${signature})` : `${tool.name}()`;
}
