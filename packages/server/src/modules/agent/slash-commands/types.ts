import type { AgentLevel } from '@familyco/core';

export type SlashCommandMessageType = 'alert' | 'info' | 'report';

export type { AgentLevel };

export interface SlashCommandToolCall {
  toolName: string;
  arguments: Record<string, unknown>;
}

export type SlashCommandExecutionResult =
  | {
      kind: 'direct';
      auditAction: string;
      replyText: string;
      messageType: SlashCommandMessageType;
      persistFounderMessage?: boolean;
      resetConversation?: boolean;
      resetMemory?: boolean;
    }
  | {
      kind: 'tool';
      auditAction: string;
      action: string;
      input: string;
      toolCall: SlashCommandToolCall;
    };

export interface SlashCommandExecutionContext {
  args: string;
  helpText: string;
}

export interface SlashCommandDefinition {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly description: string;
  readonly usage: string;
  readonly insertValue: string;
  readonly levels: readonly AgentLevel[];
  execute(context: SlashCommandExecutionContext): Promise<SlashCommandExecutionResult>;
}

export interface ParsedSlashCommand {
  raw: string;
  args: string;
  definition?: SlashCommandDefinition;
}
