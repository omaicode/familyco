import { createAgentSlashCommand } from './create-agent.command.js';
import { createProjectSlashCommand } from './create-project.command.js';
import { createTaskSlashCommand } from './create-task.command.js';
import { helpSlashCommand } from './help.command.js';
import { SlashCommandRegistry } from './registry.js';
import { resetSlashCommand } from './reset.command.js';
import type { ParsedSlashCommand } from './types.js';

export { SlashCommandRegistry } from './registry.js';
export * from './types.js';

export function buildSlashCommandRegistry(): SlashCommandRegistry {
  return new SlashCommandRegistry([
    helpSlashCommand,
    resetSlashCommand,
    createProjectSlashCommand,
    createTaskSlashCommand,
    createAgentSlashCommand
  ]);
}

const defaultRegistry = buildSlashCommandRegistry();

export function listSlashCommands() {
  return defaultRegistry.listAll();
}

export function buildSlashCommandHelp(): string {
  return defaultRegistry.buildHelpText('L0');
}

export function parseSlashCommand(message: string): ParsedSlashCommand | null {
  return defaultRegistry.parse(message);
}
