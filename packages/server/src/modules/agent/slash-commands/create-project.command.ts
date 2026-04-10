import { buildUsageReply, summarizeSlashDescription } from './helpers.js';
import type { SlashCommandDefinition } from './types.js';

export const createProjectSlashCommand: SlashCommandDefinition = {
  name: 'create-project',
  aliases: [],
  description: 'Open a new project from the description you provide.',
  usage: '/create-project {desc}',
  insertValue: '/create-project ',
  levels: ['L0'],
  async execute({ args, helpText }) {
    if (args.trim().length === 0) {
      return {
        kind: 'direct',
        auditAction: 'agent.chat.create-project.usage',
        replyText: buildUsageReply('Usage: /create-project {desc}', helpText),
        messageType: 'alert'
      };
    }

    return {
      kind: 'tool',
      auditAction: 'agent.chat.create-project',
      action: 'chat.command.create-project',
      input: args,
      toolCall: {
        toolName: 'project.create',
        arguments: {
          name: summarizeSlashDescription(args, 'Executive initiative'),
          description: args
        }
      }
    };
  }
};
