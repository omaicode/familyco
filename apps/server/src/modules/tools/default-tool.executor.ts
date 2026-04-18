import type { QueueService, ToolExecutionInput, ToolExecutionResult, ToolExecutor } from '@familyco/core';

import { agentCreateTool } from '../../tools/agent-create.tool.js';
import { agentDeleteTool } from '../../tools/agent-delete.tool.js';
import { agentListTool } from '../../tools/agent-list.tool.js';
import { agentReadTool } from '../../tools/agent-read.tool.js';
import { agentUpdateTool } from '../../tools/agent-update.tool.js';
import { approvalRequestTool } from '../../tools/approval-request.tool.js';
import { companyProfileReadTool } from '../../tools/company-profile-read.tool.js';
import { confirmRequestTool } from '../../tools/confirm-request.tool.js';
import { echoTool } from '../../tools/echo.tool.js';
import { fileDeleteTool } from '../../tools/file-delete.tool.js';
import { fileReadTool } from '../../tools/file-read.tool.js';
import { fileSearchTool } from '../../tools/file-search.tool.js';
import { fileWriteTool } from '../../tools/file-write.tool.js';
import { taskDispatchTool } from '../../tools/task-dispatch.tool.js';
import { inboxSendTool } from '../../tools/inbox-send.tool.js';
import { jsonExtractTool } from '../../tools/json-extract.tool.js';
import { projectCreateTool } from '../../tools/project-create.tool.js';
import { projectDeleteTool } from '../../tools/project-delete.tool.js';
import { projectListTool } from '../../tools/project-list.tool.js';
import { projectReadTool } from '../../tools/project-read.tool.js';
import { projectUpdateTool } from '../../tools/project-update.tool.js';
import { skillReadTool } from '../../tools/skill-read.tool.js';
import { taskCommentAddTool } from '../../tools/task-comment-add.tool.js';
import { taskCreateTool } from '../../tools/task-create.tool.js';
import { taskDeleteTool } from '../../tools/task-delete.tool.js';
import { taskListTool } from '../../tools/task-list.tool.js';
import { taskLogTool } from '../../tools/task-log.tool.js';
import { taskReadTool } from '../../tools/task-read.tool.js';
import { taskUpdateStatusTool } from '../../tools/task-update-status.tool.js';
import { taskUpdateTool } from '../../tools/task-update.tool.js';
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
  private readonly disabledPluginToolNames = new Set<string>();

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

    if (this.isPluginToolDisabled(input.toolName)) {
      return {
        ok: false,
        toolName: input.toolName,
        error: {
          code: 'TOOL_DISABLED',
          message: `${input.toolName} is disabled`
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

  listToolDefinitions(options?: { includeDisabledPluginTools?: boolean }): ToolDefinitionSummary[] {
    const includeDisabledPluginTools = options?.includeDisabledPluginTools ?? false;

    return [...this.tools.values(), ...this.pluginTools.values()]
      .filter((tool) => this.isToolAllowed(tool.name))
      .filter((tool) => includeDisabledPluginTools || !this.isPluginToolDisabled(tool.name))
      .map((tool) => toToolSummary(tool));
  }

  /** Set disabled plugin tool names from persisted registry policy. */
  setDisabledPluginTools(toolNames: readonly string[]): void {
    this.disabledPluginToolNames.clear();
    for (const toolName of toolNames) {
      if (isPluginToolName(toolName)) {
        this.disabledPluginToolNames.add(toolName);
      }
    }
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
    forked.setDisabledPluginTools(Array.from(this.disabledPluginToolNames));
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

  private isPluginToolDisabled(toolName: string): boolean {
    return this.disabledPluginToolNames.has(toolName);
  }
}

function isPluginToolName(toolName: string): boolean {
  return toolName.startsWith('plugin.');
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
