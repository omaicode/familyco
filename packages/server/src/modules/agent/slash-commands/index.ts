import { createProjectSlashCommand } from './create-project.command.js';
import { createTaskSlashCommand } from './create-task.command.js';
import { helpSlashCommand } from './help.command.js';
import { resetSlashCommand } from './reset.command.js';
import type { ParsedSlashCommand, SlashCommandDefinition } from './types.js';

const slashCommandDefinitions: SlashCommandDefinition[] = [
  helpSlashCommand,
  resetSlashCommand,
  createProjectSlashCommand,
  createTaskSlashCommand
];

export function listSlashCommands(): SlashCommandDefinition[] {
  return [...slashCommandDefinitions];
}

export function buildSlashCommandHelp(): string {
  return [
    'Available slash commands:',
    ...slashCommandDefinitions.map((definition) => `- \`${definition.usage}\`: ${definition.description}`)
  ].join('\n');
}

export function parseSlashCommand(message: string): ParsedSlashCommand | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const [raw, ...rest] = trimmed.split(/\s+/);
  const normalized = raw.replace(/^\//, '').toLowerCase();
  const definition = slashCommandDefinitions.find((entry) => {
    return entry.name === normalized || entry.aliases.includes(normalized);
  });

  return {
    raw,
    args: rest.join(' ').trim(),
    definition
  };
}

export * from './types.js';
