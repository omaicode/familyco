import type { AgentLevel } from '@familyco/core';

import { agentCreateTool } from '../../tools/agent-create.tool.js';
import { agentDeleteTool } from '../../tools/agent-delete.tool.js';
import { agentListTool } from '../../tools/agent-list.tool.js';
import { agentReadTool } from '../../tools/agent-read.tool.js';
import { agentUpdateTool } from '../../tools/agent-update.tool.js';
import { approvalRequestTool } from '../../tools/approval-request.tool.js';
import { fileDeleteTool } from '../../tools/file-delete.tool.js';
import { fileReadTool } from '../../tools/file-read.tool.js';
import { fileSearchTool } from '../../tools/file-search.tool.js';
import { fileWriteTool } from '../../tools/file-write.tool.js';
import { inboxSendTool } from '../../tools/inbox-send.tool.js';
import { projectCreateTool } from '../../tools/project-create.tool.js';
import { projectDeleteTool } from '../../tools/project-delete.tool.js';
import { projectListTool } from '../../tools/project-list.tool.js';
import { projectReadTool } from '../../tools/project-read.tool.js';
import { projectUpdateTool } from '../../tools/project-update.tool.js';
import { taskCommentAddTool } from '../../tools/task-comment-add.tool.js';
import { taskCreateTool } from '../../tools/task-create.tool.js';
import { taskDeleteTool } from '../../tools/task-delete.tool.js';
import { taskListTool } from '../../tools/task-list.tool.js';
import { taskReadTool } from '../../tools/task-read.tool.js';
import { taskUpdateStatusTool } from '../../tools/task-update-status.tool.js';
import { taskUpdateTool } from '../../tools/task-update.tool.js';
import type { SlashCommandSpec } from '../tools/tool.types.js';

export interface BuiltinSlashResult {
  auditAction: string;
  replyText: string;
  messageType: 'alert' | 'info' | 'report';
  persistFounderMessage?: boolean;
  startNewSession?: boolean;
  resetMemory?: boolean;
}

interface BaseSlashEntry {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly description: string;
  readonly usage: string;
  readonly insertValue: string;
  readonly levels: readonly AgentLevel[];
}

export interface BuiltinSlashEntry extends BaseSlashEntry {
  readonly kind: 'builtin';
  execute(args: string, helpText: string): BuiltinSlashResult;
}

export interface ToolSlashEntry extends BaseSlashEntry {
  readonly kind: 'tool';
  readonly toolName: string;
  readonly auditAction: string;
  buildArguments(args: string): Record<string, unknown>;
}

export type SlashEntry = BuiltinSlashEntry | ToolSlashEntry;

export interface ParsedSlashEntry {
  raw: string;
  args: string;
  entry?: SlashEntry;
}

export class AgentSlashRegistry {
  private readonly entries: readonly SlashEntry[];

  constructor(entries: SlashEntry[]) {
    this.entries = [...entries];
  }

  listAll(): SlashEntry[] {
    return [...this.entries];
  }

  listForLevel(level: AgentLevel): SlashEntry[] {
    return this.entries.filter((entry) => entry.levels.includes(level));
  }

  buildHelpText(level: AgentLevel): string {
    return [
      'Available slash commands:',
      ...this.listForLevel(level).map((entry) => `- \`${entry.usage}\`: ${entry.description}`)
    ].join('\n');
  }

  parse(message: string): ParsedSlashEntry | null {
    const trimmed = message.trim();
    if (!trimmed.startsWith('/')) {
      return null;
    }

    const [raw, ...rest] = trimmed.split(/\s+/);
    const normalized = raw.replace(/^\//, '').toLowerCase();
    const entry = this.entries.find((e) => e.name === normalized || e.aliases.includes(normalized));

    return { raw, args: rest.join(' ').trim(), entry };
  }
}

function toolSpecToEntry(toolName: string, spec: SlashCommandSpec): ToolSlashEntry {
  return {
    kind: 'tool',
    name: spec.command.replace(/^\//, ''),
    aliases: [],
    description: spec.description,
    usage: spec.usage ?? `${spec.command} {desc}`,
    insertValue: spec.insertValue,
    levels: spec.levels,
    toolName,
    auditAction: spec.auditAction,
    buildArguments: spec.buildArguments.bind(spec)
  };
}

const builtinHelp: BuiltinSlashEntry = {
  kind: 'builtin',
  name: 'help',
  aliases: ['h'],
  description: 'Show the list of available chat commands. Alias: `/h`.',
  usage: '/help',
  insertValue: '/help',
  levels: ['L0', 'L1', 'L2'],
  execute(_args, helpText): BuiltinSlashResult {
    return {
      auditAction: 'agent.chat.help',
      replyText: helpText,
      messageType: 'info'
    };
  }
};

const builtinReset: BuiltinSlashEntry = {
  kind: 'builtin',
  name: 'reset',
  aliases: ['new'],
  description: 'Start a new chat session while keeping earlier sessions available. Alias: `/new`.',
  usage: '/reset',
  insertValue: '/reset',
  levels: ['L0', 'L1', 'L2'],
  execute(): BuiltinSlashResult {
    return {
      auditAction: 'agent.chat.reset',
      replyText:
        'Started a new chat session. Earlier sessions remain available in history, and the current working memory was cleared. Use `/help` to see available commands.',
      messageType: 'info',
      persistFounderMessage: false,
      startNewSession: true,
      resetMemory: true
    };
  }
};

let _registryCache: AgentSlashRegistry | undefined;

export function buildAgentSlashRegistry(): AgentSlashRegistry {
  if (_registryCache) {
    return _registryCache;
  }

  const toolEntries: ToolSlashEntry[] = [
    taskCreateTool,
    taskReadTool,
    taskListTool,
    taskUpdateTool,
    taskUpdateStatusTool,
    taskDeleteTool,
    taskCommentAddTool,
    projectCreateTool,
    projectReadTool,
    projectListTool,
    projectUpdateTool,
    projectDeleteTool,
    agentCreateTool,
    agentReadTool,
    agentListTool,
    agentUpdateTool,
    agentDeleteTool,
    fileSearchTool,
    fileReadTool,
    fileWriteTool,
    fileDeleteTool,
    inboxSendTool,
    approvalRequestTool
  ]
    .filter((tool): tool is typeof tool & { slashSpec: SlashCommandSpec } => tool.slashSpec !== undefined)
    .map((tool) => toolSpecToEntry(tool.name, tool.slashSpec));

  _registryCache = new AgentSlashRegistry([builtinHelp, builtinReset, ...toolEntries]);
  return _registryCache;
}
