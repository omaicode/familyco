import type { AgentLevel, ToolExecutionResult } from '@familyco/core';

import { publishChatChunk } from '../modules/agent/agent-chat-stream-broker.js';
import { buildAgentSlashRegistry } from '../modules/agent/agent-chat.registry.js';
import type { ToolSlashEntry } from '../modules/agent/agent-chat.registry.js';
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
  toolCalls?: ConversationHistoryToolCall[];
}

interface ConversationHistoryToolCall {
  toolName: string;
  ok: boolean;
  summary: string;
  outputJson?: string;
  error?: {
    code?: string;
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

const MAX_PLANNED_TOOL_ROUNDS = 3;

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
    const allTools = context.listTools().filter((tool) => tool.name !== 'chat.respond');
    const requestedToolCalls = readExplicitToolCalls(argumentsMap);
    const conversationHistory = readConversationHistory(argumentsMap);
    const streamRequestId = readStreamRequestId(argumentsMap);

    // Look up per-agent AI overrides when agentId is provided
    const agentId = asNonEmptyString(argumentsMap.agentId);
    let agentAdapterId: string | null = null;
    let agentModel: string | null = null;
    let agentLevel: AgentLevel = 'L0';
    if (agentId && context.agentService) {
      const agentProfile = await context.agentService.getAgentById(agentId).catch(() => null);
      agentAdapterId = agentProfile?.aiAdapterId ?? null;
      agentModel = agentProfile?.aiModel ?? null;
      agentLevel = agentProfile?.level ?? 'L0';
    }
    const availableTools = filterToolsForAgent(allTools, agentLevel);
    const toolCalls: ChatToolCall[] = [];
    let createdTask: unknown | null = null;
    let createdProject: unknown | null = null;
    let plannedReply: string | null = null;

    if (requestedToolCalls.length > 0) {
      const executionResult = await executeToolCallQueue({
        toolCallQueue: requestedToolCalls,
        executeTool: context.executeTool
      });
      toolCalls.push(...executionResult.toolCalls);
      createdTask = executionResult.createdTask;
      createdProject = executionResult.createdProject;
    } else {
      let rollingHistory = [...conversationHistory];

      for (let round = 0; round < MAX_PLANNED_TOOL_ROUNDS; round += 1) {
        const plannedResponse = await sendChat({
          settingsService: context.settingsService,
          skillsService: context.skillsService,
          adapterRegistry: context.adapterRegistry,
          agentAdapterId,
          agentModel,
          message,
          companyProfile: profile,
          tools: availableTools,
          conversationHistory: rollingHistory,
          onChunk: streamRequestId
            ? (chunk) => publishChatChunk(streamRequestId, chunk)
            : undefined
        }).catch(() => null);

        if (!plannedResponse) {
          break;
        }

        if (plannedResponse.reply.trim().length > 0) {
          plannedReply = plannedResponse.reply;
        }

        const toolCallQueue = resolveToolCallQueue({
          requestedToolCalls: [],
          plannedToolCalls: plannedResponse.toolCalls
        });

        if (toolCallQueue.length === 0) {
          break;
        }

        const executionResult = await executeToolCallQueue({
          toolCallQueue,
          executeTool: context.executeTool
        });

        toolCalls.push(...executionResult.toolCalls);
        if (executionResult.createdTask) {
          createdTask = executionResult.createdTask;
        }
        if (executionResult.createdProject) {
          createdProject = executionResult.createdProject;
        }

        rollingHistory = appendToolExecutionHistory(
          rollingHistory,
          plannedResponse.reply,
          executionResult.toolCalls
        );
      }
    }

    return {
      ok: true,
      toolName: 'chat.respond',
      output: {
        reply: buildChatReply({
          profile,
          toolCalls,
          plannedReply
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

export function parseConversationHistory(value: unknown): ConversationHistoryEntry[] {
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
    createdAt: asNonEmptyString(value.createdAt),
    ...(Array.isArray(value.toolCalls)
      ? {
          toolCalls: parseConversationHistoryToolCalls(value.toolCalls)
        }
      : {})
  };
}

function parseConversationHistoryToolCalls(value: unknown[]): ConversationHistoryToolCall[] {
  return value
    .map((entry) => parseConversationHistoryToolCall(entry))
    .filter((entry): entry is ConversationHistoryToolCall => entry !== null);
}

function parseConversationHistoryToolCall(value: unknown): ConversationHistoryToolCall | null {
  if (!isRecord(value)) {
    return null;
  }

  const toolName = asNonEmptyString(value.toolName);
  const summary = asNonEmptyString(value.summary);
  if (!toolName || typeof value.ok !== 'boolean' || !summary) {
    return null;
  }

  const errorMessage = isRecord(value.error) ? asNonEmptyString(value.error.message) : undefined;
  const errorCode = isRecord(value.error) ? asNonEmptyString(value.error.code) : undefined;
  const outputJson = readOutputJson(value);
  const error = errorMessage
    ? {
        message: errorMessage,
        ...(errorCode ? { code: errorCode } : {})
      }
    : undefined;

  return {
    toolName,
    ok: value.ok,
    summary,
    ...(outputJson ? { outputJson } : {}),
    ...(error ? { error } : {})
  };
}

function readOutputJson(value: Record<string, unknown>): string | undefined {
  const direct = asNonEmptyString(value.outputJson);
  if (direct) {
    return direct;
  }

  if (!('output' in value)) {
    return undefined;
  }

  try {
    const serialized = JSON.stringify(value.output);
    if (!serialized || serialized.length === 0) {
      return undefined;
    }

    return serialized.length > 2_000
      ? `${serialized.slice(0, 1_999).trimEnd()}…`
      : serialized;
  } catch {
    return undefined;
  }
}

function readStreamRequestId(argumentsMap: Record<string, unknown>): string | undefined {
  if (!isRecord(argumentsMap.meta)) {
    return undefined;
  }

  return asNonEmptyString(argumentsMap.meta.streamRequestId);
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

async function executeToolCallQueue(input: {
  toolCallQueue: ExplicitToolCall[];
  executeTool: (value: { toolName: string; arguments: Record<string, unknown> }) => Promise<ToolExecutionResult>;
}): Promise<{ toolCalls: ChatToolCall[]; createdTask: unknown | null; createdProject: unknown | null; }> {
  const toolCalls: ChatToolCall[] = [];
  let createdTask: unknown | null = null;
  let createdProject: unknown | null = null;

  for (const requestedToolCall of input.toolCallQueue) {
    if (requestedToolCall.toolName === 'chat.respond') {
      continue;
    }

    const result = await input.executeTool({
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

  return { toolCalls, createdTask, createdProject };
}

function appendToolExecutionHistory(
  history: ConversationHistoryEntry[],
  plannedReply: string,
  toolCalls: ChatToolCall[]
): ConversationHistoryEntry[] {
  if (toolCalls.length === 0) {
    return history;
  }

  const summaryBody = toolCalls.map((toolCall) => toolCall.summary).join(' ');
  const body = plannedReply.trim().length > 0
    ? `${plannedReply}\n\n${summaryBody}`.trim()
    : summaryBody;

  return [
    ...history,
    {
      senderId: 'executive',
      body,
      toolCalls: toolCalls.map((toolCall) => {
        const outputJson = toolCall.output !== undefined ? serializeToolOutput(toolCall.output) : undefined;
        return {
          toolName: toolCall.toolName,
          ok: toolCall.ok,
          summary: toolCall.summary,
          ...(outputJson ? { outputJson } : {}),
          ...(toolCall.error ? { error: toolCall.error } : {})
        };
      })
    }
  ];
}

function serializeToolOutput(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    if (!serialized || serialized.length === 0) {
      return '';
    }

    return serialized.length > 2_000
      ? `${serialized.slice(0, 1_999).trimEnd()}…`
      : serialized;
  } catch {
    return '';
  }
}

function buildChatReply(input: {
  profile: CompanyProfile;
  toolCalls: ChatToolCall[];
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

  return `I recorded your message for ${input.profile.companyName}. I can continue with a direct discussion, or execute actions only when you ask me to.`;
}

function filterToolsForAgent(tools: ToolDefinitionSummary[], level: AgentLevel): ToolDefinitionSummary[] {
  const registry = buildAgentSlashRegistry();
  const allowedToolNames = new Set(
    registry
      .listForLevel(level)
      .filter((entry): entry is ToolSlashEntry => entry.kind === 'tool')
      .map((entry) => entry.toolName)
  );

  return tools.filter((tool) => allowedToolNames.has(tool.name));
}

export function resolveToolCallQueue(input: {
  requestedToolCalls: ExplicitToolCall[];
  plannedToolCalls: ExplicitToolCall[];
}): ExplicitToolCall[] {
  if (input.requestedToolCalls.length > 0) {
    return input.requestedToolCalls;
  }

  return input.plannedToolCalls;
}
