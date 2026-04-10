import type { ToolExecutionInput, ToolExecutionResult, ToolExecutor } from '@familyco/core';

import { agentCreateTool } from './agent-create.tool.js';
import { agentDeleteTool } from './agent-delete.tool.js';
import { agentUpdateTool } from './agent-update.tool.js';
import { chatRespondTool } from './chat-respond.tool.js';
import { companyProfileReadTool } from './company-profile-read.tool.js';
import { echoTool } from './echo.tool.js';
import { jsonExtractTool } from './json-extract.tool.js';
import { projectCreateTool } from './project-create.tool.js';
import { projectDeleteTool } from './project-delete.tool.js';
import { projectUpdateTool } from './project-update.tool.js';
import { taskCreateTool } from './task-create.tool.js';
import { taskDeleteTool } from './task-delete.tool.js';
import { taskLogTool } from './task-log.tool.js';
import { taskUpdateStatusTool } from './task-update-status.tool.js';
import { taskUpdateTool } from './task-update.tool.js';
import { toToolSummary } from './tool.helpers.js';
import type { DefaultToolExecutorDeps, ServerToolDefinition, ToolDefinitionSummary } from './tool.types.js';
import { webSearchTool } from './web-search.tool.js';

export class DefaultToolExecutor implements ToolExecutor {
  private readonly tools = new Map<string, ServerToolDefinition>();

  constructor(private readonly deps: DefaultToolExecutorDeps = {}) {
    const definitions: ServerToolDefinition[] = [
      chatRespondTool,
      companyProfileReadTool,
      taskCreateTool,
      taskUpdateTool,
      taskUpdateStatusTool,
      taskDeleteTool,
      projectCreateTool,
      projectUpdateTool,
      projectDeleteTool,
      agentCreateTool,
      agentUpdateTool,
      agentDeleteTool,
      echoTool,
      taskLogTool,
      jsonExtractTool,
      webSearchTool
    ];

    for (const definition of definitions) {
      this.tools.set(definition.name, definition);
    }
  }

  async execute(input: ToolExecutionInput): Promise<ToolExecutionResult> {
    const tool = this.tools.get(input.toolName);
    if (!tool) {
      throw new Error(`TOOL_NOT_FOUND:${input.toolName}`);
    }

    return tool.execute(input.arguments, {
      ...this.deps,
      executeTool: async (nestedInput) => this.execute(nestedInput),
      listTools: () => this.listToolDefinitions()
    });
  }

  listToolDefinitions(): ToolDefinitionSummary[] {
    return [...this.tools.values()].map((tool) => toToolSummary(tool));
  }
}
