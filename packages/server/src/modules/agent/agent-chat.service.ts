import { randomUUID } from 'node:crypto';

import type { AgentLoopEvent, AgentService } from '@familyco/core';

import { buildAgentSlashRegistry } from './agent-chat.registry.js';
import type { ParsedSlashEntry } from './agent-chat.registry.js';
import type { ChatEngineResult } from './chat-engine.service.js';
import type {
  AgentModuleDeps,
  ChatRequestBody,
  ChatSocketClient,
  ProcessedChatResult
} from './agent.types.js';
import {
  buildProcessedChatResult,
  chunkReply,
  createDirectChatReply,
  createEphemeralFounderMessage,
  createFounderMessage,
  resolveSocketClient,
  sendSocketEvent,
  streamReply,
  toConversationHistoryEntry,
  toErrorMessage
} from './agent-chat.helpers.js';

export { chunkReply, resolveSocketClient, sendSocketEvent, toErrorMessage } from './agent-chat.helpers.js';

export async function handleSocketChatMessage(input: {
  raw: string;
  socket: ChatSocketClient;
  agentId: string;
  deps: AgentModuleDeps;
  actorId: string;
}): Promise<void> {
  try {
    const body = JSON.parse(input.raw) as ChatRequestBody;
    const requestId = randomUUID();

    sendSocketEvent(input.socket, 'chat.started', {
      requestId,
      agentId: input.agentId,
      startedAt: new Date().toISOString()
    });

    let chunkIndex = 0;

    const result = await processAgentChat({
      agentId: input.agentId,
      body,
      deps: input.deps,
      actorId: input.actorId,
      onEvent: (event) => {
        if (event.type === 'chunk') {
          sendSocketEvent(input.socket, 'chat.chunk', { requestId, index: chunkIndex, chunk: event.text });
          chunkIndex += 1;
        } else if (event.type === 'tool_start') {
          sendSocketEvent(input.socket, 'chat.tool.start', { requestId, toolName: event.toolName });
        } else if (event.type === 'tool_result') {
          sendSocketEvent(input.socket, 'chat.tool.complete', {
            requestId,
            toolName: event.toolName,
            ok: event.ok,
            ...(event.output ? { output: event.output } : {})
          });
        }
      }
    });

    for (const toolCall of result.toolCalls) {
      sendSocketEvent(input.socket, 'chat.tool.used', { requestId, ...toolCall });
    }

    if (chunkIndex === 0) {
      await streamReply(input.socket, requestId, result.replyMessage.body);
    }

    sendSocketEvent(input.socket, 'chat.completed', {
      requestId,
      founderMessage: result.founderMessage,
      replyMessage: result.replyMessage,
      reply: result.reply,
      task: result.task,
      project: result.project,
      toolCalls: result.toolCalls
    });
  } catch (error) {
    sendSocketEvent(input.socket, 'chat.error', { message: toErrorMessage(error) });
  }
}

export async function processAgentChat(input: {
  agentId: string;
  body: ChatRequestBody;
  deps: AgentModuleDeps;
  actorId: string;
  onEvent?: (event: AgentLoopEvent) => void;
}): Promise<ProcessedChatResult> {
  const agent = await input.deps.agentService.getAgentById(input.agentId);
  const registry = buildAgentSlashRegistry();
  const parsedCommand = registry.parse(input.body.message);

  if (parsedCommand) {
    return runSlashCommand({
      agent,
      body: input.body,
      deps: input.deps,
      actorId: input.actorId,
      parsedCommand,
      onEvent: input.onEvent
    });
  }

  const founderMessage = await createFounderMessage({
    agentId: agent.id,
    body: input.body.message,
    meta: isRecord(input.body.meta) ? input.body.meta : null,
    slashCommand: null,
    inboxService: input.deps.inboxService
  });

  const [conversationHistory, profileResult] = await Promise.all([
    input.deps.inboxService.listConversation(agent.id, 12),
    input.deps.toolExecutor.execute({ toolName: 'company.profile.read', arguments: {} }).catch(() => null)
  ]);

  const companyProfile = toCompanyProfile(profileResult?.output);
  const allTools = input.deps.listTools();

  const engineResult = await input.deps.chatEngineService.run({
    agentAdapterId: agent.aiAdapterId ?? null,
    agentModel: agent.aiModel ?? null,
    agentLevel: agent.level,
    message: input.body.message,
    companyProfile,
    conversationHistory: conversationHistory.map(toConversationHistoryEntry),
    availableTools: allTools,
    onEvent: input.onEvent,
    executeTool: (toolInput) => input.deps.toolExecutor.execute(toolInput)
  });

  return buildProcessedChatResult({
    agent,
    founderMessage,
    engineResult,
    inboxService: input.deps.inboxService,
    auditService: input.deps.auditService,
    actorId: input.actorId,
    auditAction: 'agent.chat'
  });
}

async function runSlashCommand(input: {
  agent: Awaited<ReturnType<AgentService['getAgentById']>>;
  body: ChatRequestBody;
  deps: AgentModuleDeps;
  actorId: string;
  parsedCommand: Exclude<ParsedSlashEntry, null>;
  onEvent?: (event: AgentLoopEvent) => void;
}): Promise<ProcessedChatResult> {
  const registry = buildAgentSlashRegistry();
  const helpText = registry.buildHelpText(input.agent.level);
  const { entry } = input.parsedCommand;

  if (!entry) {
    const founderMessage = await createFounderMessage({
      agentId: input.agent.id,
      body: input.body.message,
      meta: null,
      slashCommand: 'unknown',
      inboxService: input.deps.inboxService
    });

    return createDirectChatReply({
      agent: input.agent,
      founderMessage,
      inboxService: input.deps.inboxService,
      auditService: input.deps.auditService,
      actorId: input.actorId,
      auditAction: 'agent.chat.command.invalid',
      replyText: `Unknown command \`${input.parsedCommand.raw}\`.\n\n${helpText}`,
      messageType: 'alert'
    });
  }

  if (entry.kind === 'tool') {
    const { args } = input.parsedCommand;

    if (args.trim().length === 0) {
      const founderMessage = await createFounderMessage({
        agentId: input.agent.id,
        body: input.body.message,
        meta: null,
        slashCommand: entry.name,
        inboxService: input.deps.inboxService
      });

      return createDirectChatReply({
        agent: input.agent,
        founderMessage,
        inboxService: input.deps.inboxService,
        auditService: input.deps.auditService,
        actorId: input.actorId,
        auditAction: entry.auditAction + '.usage',
        replyText: `Usage: ${entry.usage}\n\n${helpText}`,
        messageType: 'alert'
      });
    }

    const founderMessage = await createFounderMessage({
      agentId: input.agent.id,
      body: input.body.message,
      meta: null,
      slashCommand: entry.name,
      inboxService: input.deps.inboxService
    });

    const toolResult = await input.deps.toolExecutor.execute({
      toolName: entry.toolName,
      arguments: entry.buildArguments(args)
    });

    const engineResult: ChatEngineResult = {
      reply: toolResult.ok
        ? 'Executed ' + entry.toolName + '.' 
        : (toolResult.error?.message ?? entry.toolName + ' failed.'),
      toolCalls: [{
        toolName: toolResult.toolName,
        ok: toolResult.ok,
        summary: toolResult.ok
          ? 'Executed ' + entry.toolName + '.'
          : (toolResult.error?.message ?? entry.toolName + ' failed.'),
        output: toolResult.output,
        error: toolResult.error
      }],
      task: entry.toolName === 'task.create' && toolResult.ok ? toolResult.output ?? null : null,
      project: entry.toolName === 'project.create' && toolResult.ok ? toolResult.output ?? null : null
    };

    return buildProcessedChatResult({
      agent: input.agent,
      founderMessage,
      engineResult,
      inboxService: input.deps.inboxService,
      auditService: input.deps.auditService,
      actorId: input.actorId,
      auditAction: entry.auditAction
    });
  }

  const builtinResult = entry.execute(input.parsedCommand.args, helpText);

  if (builtinResult.resetConversation) {
    await input.deps.inboxService.clearConversation(input.agent.id);
  }

  if (builtinResult.resetMemory) {
    await input.deps.agentRunner.clearMemory(input.agent.id);
  }

  const founderMessage = builtinResult.persistFounderMessage === false
    ? createEphemeralFounderMessage(input.agent.id, input.body.message)
    : await createFounderMessage({
        agentId: input.agent.id,
        body: input.body.message,
        meta: null,
        slashCommand: entry.name,
        inboxService: input.deps.inboxService
      });

  return createDirectChatReply({
    agent: input.agent,
    founderMessage,
    inboxService: input.deps.inboxService,
    auditService: input.deps.auditService,
    actorId: input.actorId,
    auditAction: builtinResult.auditAction,
    replyText: builtinResult.replyText,
    messageType: builtinResult.messageType
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toCompanyProfile(value: unknown): { companyName: string; companyDescription: string } {
  if (!isRecord(value)) {
    return { companyName: 'FamilyCo', companyDescription: '' };
  }

  return {
    companyName: typeof value.companyName === 'string' && value.companyName.trim().length > 0
      ? value.companyName
      : 'FamilyCo',
    companyDescription: typeof value.companyDescription === 'string' ? value.companyDescription : ''
  };
}
