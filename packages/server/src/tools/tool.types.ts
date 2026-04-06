import type {
  AgentService,
  ProjectService,
  SettingsService,
  TaskService,
  ToolExecutionInput,
  ToolExecutionResult
} from '@familyco/core';

export interface DefaultToolExecutorDeps {
  agentService?: AgentService;
  projectService?: ProjectService;
  settingsService?: SettingsService;
  taskService?: TaskService;
}

export interface ToolParameterDefinition {
  name: string;
  type: string;
  required: boolean;
  description: string;
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

export interface ServerToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: readonly ToolParameterDefinition[];
  execute(argumentsMap: Record<string, unknown>, context: ServerToolContext): Promise<ToolExecutionResult>;
}
