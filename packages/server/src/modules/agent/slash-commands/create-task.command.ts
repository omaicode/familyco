import { buildUsageReply, summarizeSlashDescription } from './helpers.js';
import type { SlashCommandDefinition } from './types.js';

export const createTaskSlashCommand: SlashCommandDefinition = {
  name: 'create-task',
  aliases: [],
  description: 'Create a new task from the description you provide.',
  usage: '/create-task {desc}',
  async execute({ args, helpText }) {
    if (args.trim().length === 0) {
      return {
        kind: 'direct',
        auditAction: 'agent.chat.create-task.usage',
        replyText: buildUsageReply('Usage: /create-task {desc}', helpText),
        messageType: 'alert'
      };
    }

    return {
      kind: 'tool',
      auditAction: 'agent.chat.create-task',
      action: 'chat.command.create-task',
      input: args,
      toolCall: {
        toolName: 'task.create',
        arguments: {
          title: summarizeSlashDescription(args, 'Executive follow-up'),
          description: args
        }
      }
    };
  }
};
