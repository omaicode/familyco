import { createAgentSlashCommand } from './create-agent.command.js';
import { createProjectSlashCommand } from './create-project.command.js';
import { createTaskSlashCommand } from './create-task.command.js';
import { helpSlashCommand } from './help.command.js';
import { SlashCommandRegistry } from './registry.js';
import { resetSlashCommand } from './reset.command.js';

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
