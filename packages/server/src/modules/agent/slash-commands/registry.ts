import type { AgentLevel } from '@familyco/core';

import type { ParsedSlashCommand, SlashCommandDefinition } from './types.js';

export class SlashCommandRegistry {
  private readonly definitions: readonly SlashCommandDefinition[];

  constructor(definitions: SlashCommandDefinition[]) {
    this.definitions = [...definitions];
  }

  listAll(): SlashCommandDefinition[] {
    return [...this.definitions];
  }

  listForLevel(level: AgentLevel): SlashCommandDefinition[] {
    return this.definitions.filter((definition) => definition.levels.includes(level));
  }

  buildHelpText(level: AgentLevel): string {
    const visible = this.listForLevel(level);
    return [
      'Available slash commands:',
      ...visible.map((definition) => `- \`${definition.usage}\`: ${definition.description}`)
    ].join('\n');
  }

  parse(message: string): ParsedSlashCommand | null {
    const trimmed = message.trim();
    if (!trimmed.startsWith('/')) {
      return null;
    }

    const [raw, ...rest] = trimmed.split(/\s+/);
    const normalized = raw.replace(/^\//, '').toLowerCase();
    const definition = this.definitions.find((entry) => {
      return entry.name === normalized || entry.aliases.includes(normalized);
    });

    return {
      raw,
      args: rest.join(' ').trim(),
      definition
    };
  }
}
