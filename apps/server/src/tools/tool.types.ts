import type {
  AgentService,
  AgentLevel,
  AiAdapterRegistry,
  ApprovalService,
  AuditService,
  InboxService,
  ProjectService,
  SettingsService,
  TaskService,
  ToolExecutionInput,
  ToolExecutionResult
} from '@familyco/core';
import type { SkillsService } from '../modules/skills/skills.service.js';

export interface DefaultToolExecutorDeps {
  agentService?: AgentService;
  projectService?: ProjectService;
  settingsService?: SettingsService;
  skillsService?: SkillsService;
  taskService?: TaskService;
  adapterRegistry?: AiAdapterRegistry;
  auditService?: AuditService;
  inboxService?: InboxService;
  approvalService?: ApprovalService;
}

export interface ToolParameterDefinition {
  name: string;
  type: string;
  required: boolean;
  description: string;
  items?: { type: string };
}

export interface ToolDefinitionSummary {
  name: string;
  description: string;
  parameters: ToolParameterDefinition[];
}

export interface ServerToolContext extends DefaultToolExecutorDeps {
  executeTool: (input: ToolExecutionInput) => Promise<ToolExecutionResult>;
  listTools: () => ToolDefinitionSummary[];
}

export interface SlashCommandSpec {
  command: string;
  usage?: string;
  label: string;
  description: string;
  insertValue: string;
  levels: readonly AgentLevel[];
  auditAction: string;
  buildArguments(args: string): Record<string, unknown>;
}

export interface ServerToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: readonly ToolParameterDefinition[];
  readonly slashSpec?: SlashCommandSpec;
  execute(argumentsMap: Record<string, unknown>, context: ServerToolContext): Promise<ToolExecutionResult>;
}
