import type { ToolExecutionResult } from '@familyco/core';

import type { CompanyProfile } from './company-profile-read.tool.js';
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
    'Compose a streaming-friendly executive reply. It never guesses tool usage from regex or text intent; it only runs tools that are explicitly chosen and fully parameterized by the agent.',
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

    const toolCalls: ChatToolCall[] = [];
    let createdTask: unknown | null = null;
    let createdProject: unknown | null = null;

    for (const requestedToolCall of requestedToolCalls) {
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
          message,
          toolCalls,
          availableTools
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
  message: string;
  toolCalls: ChatToolCall[];
  availableTools: ToolDefinitionSummary[];
}): string {
  const descriptionText = input.profile.companyDescription.length > 0
    ? ` Company description: ${input.profile.companyDescription}`
    : '';

  if (input.toolCalls.length === 0) {
    const suggestedTools = input.availableTools
      .filter((tool) => tool.name === 'task.create' || tool.name === 'project.create')
      .map((tool) => formatToolSignature(tool))
      .join('; ');

    const suggestionLine = suggestedTools.length > 0
      ? ` When the agent decides to act, it should explicitly choose one of these tools and pass the needed parameters: ${suggestedTools}.`
      : '';

    return `I recorded your message for ${input.profile.companyName}. No tool was called automatically.${suggestionLine}${descriptionText}`;
  }

  return `${input.toolCalls.map((toolCall) => toolCall.summary).join(' ')}${descriptionText}`;
}

function formatToolSignature(tool: ToolDefinitionSummary): string {
  const signature = tool.parameters
    .filter((parameter) => parameter.required)
    .map((parameter) => parameter.name)
    .join(', ');

  return signature.length > 0 ? `${tool.name}(${signature})` : `${tool.name}()`;
}
