import type { QueueService, ToolExecutionInput, ToolExecutionResult, ToolExecutor } from '@familyco/core';

import { agentCreateTool } from './agent-create.tool.js';
import { agentDeleteTool } from './agent-delete.tool.js';
import { agentListTool } from './agent-list.tool.js';
import { agentReadTool } from './agent-read.tool.js';
import { agentUpdateTool } from './agent-update.tool.js';
import { approvalRequestTool } from './approval-request.tool.js';
import { companyProfileReadTool } from './company-profile-read.tool.js';
import { confirmRequestTool } from './confirm-request.tool.js';
import { echoTool } from './echo.tool.js';
import { fileDeleteTool } from './file-delete.tool.js';
import { fileReadTool } from './file-read.tool.js';
import { fileSearchTool } from './file-search.tool.js';
import { fileWriteTool } from './file-write.tool.js';
import { taskDispatchTool } from './task-dispatch.tool.js';
import { inboxSendTool } from './inbox-send.tool.js';
import { jsonExtractTool } from './json-extract.tool.js';
import { projectCreateTool } from './project-create.tool.js';
import { projectDeleteTool } from './project-delete.tool.js';
import { projectListTool } from './project-list.tool.js';
import { projectReadTool } from './project-read.tool.js';
import { projectUpdateTool } from './project-update.tool.js';
import { skillReadTool } from './skill-read.tool.js';
import { taskCommentAddTool } from './task-comment-add.tool.js';
import { taskCreateTool } from './task-create.tool.js';
import { taskDeleteTool } from './task-delete.tool.js';
import { taskListTool } from './task-list.tool.js';
import { taskLogTool } from './task-log.tool.js';
import { taskReadTool } from './task-read.tool.js';
import { taskUpdateStatusTool } from './task-update-status.tool.js';
import { taskUpdateTool } from './task-update.tool.js';
import { toToolSummary } from './tool.helpers.js';
import type { DefaultToolExecutorDeps, ServerToolDefinition, ToolDefinitionSummary } from './tool.types.js';

export const HEARTBEAT_ALLOWED_TOOL_NAMES = new Set([
  'task.list',
  'task.read',
  'task.log',
  'task.dispatch'
]);

export function filterToolDefinitionsByNames(
  tools: ToolDefinitionSummary[],
  allowedToolNames: ReadonlySet<string>
): ToolDefinitionSummary[] {
  return tools.filter((tool) => allowedToolNames.has(tool.name));
}

export class DefaultToolExecutor implements ToolExecutor {
  private readonly tools = new Map<string, ServerToolDefinition>();
  private readonly pluginTools = new Map<string, ServerToolDefinition>();

  constructor(private readonly deps: DefaultToolExecutorDeps = {}) {
    const definitions: ServerToolDefinition[] = [
      companyProfileReadTool,
      skillReadTool,
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
      echoTool,
      taskLogTool,
      jsonExtractTool,
      fileSearchTool,
      fileReadTool,
      fileWriteTool,
      fileDeleteTool,
      confirmRequestTool,
      inboxSendTool,
      approvalRequestTool,
      taskDispatchTool
    ];

    for (const definition of definitions) {
      this.tools.set(definition.name, definition);
    }
  }

  async execute(input: ToolExecutionInput): Promise<ToolExecutionResult> {
    if (!this.isToolAllowed(input.toolName)) {
      return {
        ok: false,
        toolName: input.toolName,
        error: {
          code: 'TOOL_NOT_ALLOWED',
          message: `${input.toolName} is not available in this execution context`
        }
      };
    }

    const tool = this.tools.get(input.toolName) ?? this.pluginTools.get(input.toolName);
    if (!tool) {
      return {
        ok: false,
        toolName: input.toolName,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `${input.toolName} is not registered`
        }
      };
    }

    try {
      return await tool.execute(input.arguments, {
        ...this.deps,
        executeTool: async (nestedInput) => this.execute(nestedInput),
        listTools: () => this.listToolDefinitions()
      });
    } catch (error) {
      return toToolExecutionError(input.toolName, error);
    }
  }

  listToolDefinitions(): ToolDefinitionSummary[] {
    return [...this.tools.values(), ...this.pluginTools.values()]
      .filter((tool) => this.isToolAllowed(tool.name))
      .map((tool) => toToolSummary(tool));
  }

  /** Register tools provided by an enabled plugin. Replaces any previous tools for those names. */
  registerPluginTools(tools: readonly ServerToolDefinition[]): void {
    for (const tool of tools) {
      this.pluginTools.set(tool.name, tool);
    }
  }

  /** Remove all plugin-registered tools (called before re-sync). */
  clearPluginTools(): void {
    this.pluginTools.clear();
  }

  /** Create a copy of this executor scoped to a specific workspace directory. */
  fork(workspaceRoot?: string, agentId?: string): DefaultToolExecutor {
    const forked = new DefaultToolExecutor({
      ...this.deps,
      ...(workspaceRoot ? { workspaceRoot } : {}),
      agentId: agentId ?? this.deps.agentId
    });
    for (const [, tool] of this.pluginTools) {
      forked.pluginTools.set(tool.name, tool);
    }
    return forked;
  }

  /** Create a copy of this executor configured for a heartbeat run (with queueService + agentId context). */
  forkForHeartbeat(queueService: QueueService, agentId: string): DefaultToolExecutor {
    return new DefaultToolExecutor({
      ...this.deps,
      queueService,
      agentId,
      allowedToolNames: HEARTBEAT_ALLOWED_TOOL_NAMES
    });
  }

  private isToolAllowed(toolName: string): boolean {
    return this.deps.allowedToolNames?.has(toolName) ?? true;
  }
}

function toToolExecutionError(toolName: string, error: unknown): ToolExecutionResult {
  if (error instanceof Error) {
    const [rawCode, ...rawMessage] = error.message.split(':');
    const code = rawCode?.trim() || 'TOOL_EXECUTION_FAILED';
    const message = rawMessage.join(':').trim() || error.message || `Tool ${toolName} execution failed`;

    return {
      ok: false,
      toolName,
      error: {
        code,
        message
      }
    };
  }

  return {
    ok: false,
    toolName,
    error: {
      code: 'TOOL_EXECUTION_FAILED',
      message: `Tool ${toolName} execution failed`
    }
  };
}
