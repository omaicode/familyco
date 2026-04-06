import type { SlashCommandDefinition } from './types.js';

export const helpSlashCommand: SlashCommandDefinition = {
  name: 'help',
  aliases: ['h'],
  description: 'Show the list of available chat commands. Alias: `/h`.',
  usage: '/help',
  async execute({ helpText }) {
    return {
      kind: 'direct',
      auditAction: 'agent.chat.help',
      replyText: helpText,
      messageType: 'info'
    };
  }
};
