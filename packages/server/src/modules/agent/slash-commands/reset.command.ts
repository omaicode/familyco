import type { SlashCommandDefinition } from './types.js';

export const resetSlashCommand: SlashCommandDefinition = {
  name: 'reset',
  aliases: ['new'],
  description: 'Clear the current chat history and start a fresh session. Alias: `/new`.',
  usage: '/reset',
  async execute() {
    return {
      kind: 'direct',
      auditAction: 'agent.chat.reset',
      replyText:
        'Started a new chat. Previous conversation history and working memory were cleared. Use `/help` to see the available chat commands.',
      messageType: 'info',
      persistFounderMessage: false,
      resetConversation: true,
      resetMemory: true
    };
  }
};
