import { buildUsageReply, summarizeSlashDescription } from './helpers.js';
import type { SlashCommandDefinition } from './types.js';

export const createAgentSlashCommand: SlashCommandDefinition = {
  name: 'create-agent',
  aliases: [],
  description: 'Spin up a new agent with a name, role, and department.',
  usage: '/create-agent {name} as {role} in {department}',
  insertValue: '/create-agent ',
  levels: ['L0'],
  async execute({ args, helpText }) {
    if (args.trim().length === 0) {
      return {
        kind: 'direct',
        auditAction: 'agent.chat.create-agent.usage',
        replyText: buildUsageReply(
          'Usage: /create-agent {description}  e.g. `/create-agent Marketing Manager for the marketing department`',
          helpText
        ),
        messageType: 'alert'
      };
    }

    return {
      kind: 'tool',
      auditAction: 'agent.chat.create-agent',
      action: 'chat.command.create-agent',
      input: args,
      toolCall: {
        toolName: 'agent.create',
        arguments: {
          name: summarizeSlashDescription(args, 'New Agent'),
          role: summarizeSlashDescription(args, 'Agent'),
          department: 'General'
        }
      }
    };
  }
};
