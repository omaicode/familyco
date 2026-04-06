import type {
  AgentService,
  ProjectService,
  SettingsService,
  TaskPriority,
  TaskService,
  ToolExecutionInput,
  ToolExecutionResult,
  ToolExecutor
} from '@familyco/core';

import { resolveDefaultProjectId, resolveExecutiveAgentId } from '../modules/shared/defaults.js';

interface DefaultToolExecutorDeps {
  agentService?: AgentService;
  projectService?: ProjectService;
  settingsService?: SettingsService;
  taskService?: TaskService;
}

interface CompanyProfile {
  companyName: string;
  companyMission: string;
  companyDirection: string;
}

interface ChatToolCall {
  toolName: string;
  ok: boolean;
  summary: string;
  output?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

interface ChatToolOutput {
  reply: string;
  toolCalls: ChatToolCall[];
  task?: unknown;
  project?: unknown;
}

export class DefaultToolExecutor implements ToolExecutor {
  constructor(private readonly deps: DefaultToolExecutorDeps = {}) {}

  async execute(input: ToolExecutionInput): Promise<ToolExecutionResult> {
    if (input.toolName === 'chat.respond') {
      return this.handleChatRespond(input.arguments);
    }

    if (input.toolName === 'company.profile.read') {
      return this.handleCompanyProfileRead();
    }

    if (input.toolName === 'task.create') {
      return this.handleTaskCreate(input.arguments);
    }

    if (input.toolName === 'project.create') {
      return this.handleProjectCreate(input.arguments);
    }

    if (input.toolName === 'echo') {
      return {
        ok: true,
        toolName: input.toolName,
        output: {
          echoed: input.arguments
        }
      };
    }

    if (input.toolName === 'task.log') {
      return {
        ok: true,
        toolName: input.toolName,
        output: {
          accepted: true,
          message: String(input.arguments.message ?? 'Task log executed'),
          loggedAt: new Date().toISOString()
        }
      };
    }

    if (input.toolName === 'json.extract') {
      const source = input.arguments.source;
      const path = String(input.arguments.path ?? '').trim();

      if (typeof source !== 'object' || source === null || path.length === 0) {
        return {
          ok: false,
          toolName: input.toolName,
          error: {
            code: 'TOOL_INVALID_ARGUMENTS',
            message: 'json.extract expects arguments.source object and non-empty arguments.path'
          }
        };
      }

      const value = resolveDotPath(source as Record<string, unknown>, path);
      return {
        ok: true,
        toolName: input.toolName,
        output: {
          path,
          value
        }
      };
    }

    if (input.toolName === 'web.search') {
      const query = String(input.arguments.query ?? '').trim();
      if (query.length === 0) {
        return {
          ok: false,
          toolName: input.toolName,
          error: {
            code: 'TOOL_INVALID_ARGUMENTS',
            message: 'web.search expects arguments.query as a non-empty string'
          }
        };
      }

      return {
        ok: true,
        toolName: input.toolName,
        output: {
          query,
          results: []
        }
      };
    }

    throw new Error(`TOOL_NOT_FOUND:${input.toolName}`);
  }

  private async handleChatRespond(argumentsMap: Record<string, unknown>): Promise<ToolExecutionResult> {
    const message = asNonEmptyString(argumentsMap.message);
    if (!message) {
      return invalidArguments('chat.respond', 'chat.respond expects arguments.message as a non-empty string');
    }

    const agentId = asNonEmptyString(argumentsMap.agentId);
    const meta = isRecord(argumentsMap.meta) ? argumentsMap.meta : {};
    const profileResult = await this.handleCompanyProfileRead();
    const profile = toCompanyProfile(profileResult.output);

    const toolCalls: ChatToolCall[] = [];
    let createdProject: unknown;
    let createdTask: unknown;

    if (detectProjectIntent(message)) {
      const projectResult = await this.execute({
        toolName: 'project.create',
        arguments: {
          name: buildProjectName(message),
          description: buildProjectDescription(message, profile),
          ownerAgentId: agentId
        }
      });

      toolCalls.push(summarizeToolCall(projectResult, 'project'));
      if (projectResult.ok) {
        createdProject = projectResult.output;
      }
    }

    if (detectTaskIntent(message)) {
      const taskResult = await this.execute({
        toolName: 'task.create',
        arguments: {
          title: buildTaskTitle(message),
          description: buildTaskDescription(message, profile),
          projectId: asNonEmptyString(meta.projectId) ?? extractEntityId(createdProject),
          assigneeAgentId: agentId,
          createdBy: agentId
        }
      });

      toolCalls.push(summarizeToolCall(taskResult, 'task'));
      if (taskResult.ok) {
        createdTask = taskResult.output;
      }
    }

    return {
      ok: true,
      toolName: 'chat.respond',
      output: {
        reply: buildChatReply({
          profile,
          createdTask,
          createdProject
        }),
        toolCalls,
        task: createdTask,
        project: createdProject
      } satisfies ChatToolOutput
    };
  }

  private async handleCompanyProfileRead(): Promise<ToolExecutionResult> {
    const companyNameSetting = await this.deps.settingsService?.get('company.name');
    const missionSetting = await this.deps.settingsService?.get('company.mission');
    const directionSetting = await this.deps.settingsService?.get('company.direction');

    return {
      ok: true,
      toolName: 'company.profile.read',
      output: {
        companyName: asNonEmptyString(companyNameSetting?.value) ?? 'FamilyCo',
        companyMission: asNonEmptyString(missionSetting?.value) ?? '',
        companyDirection: asNonEmptyString(directionSetting?.value) ?? ''
      } satisfies CompanyProfile
    };
  }

  private async handleTaskCreate(argumentsMap: Record<string, unknown>): Promise<ToolExecutionResult> {
    if (!this.deps.taskService || !this.deps.projectService || !this.deps.settingsService || !this.deps.agentService) {
      return unavailableTool('task.create', 'task.create requires task, project, settings, and agent services');
    }

    const title = asNonEmptyString(argumentsMap.title) ?? 'Executive follow-up';
    const description = asNonEmptyString(argumentsMap.description) ?? title;
    const assigneeAgentId =
      asNonEmptyString(argumentsMap.assigneeAgentId) ??
      (await resolveExecutiveAgentId({
        agentService: this.deps.agentService,
        settingsService: this.deps.settingsService
      }));
    const projectId =
      asNonEmptyString(argumentsMap.projectId) ??
      (await resolveDefaultProjectId({
        agentService: this.deps.agentService,
        projectService: this.deps.projectService,
        settingsService: this.deps.settingsService
      }));

    const task = await this.deps.taskService.createTask({
      title,
      description,
      projectId,
      assigneeAgentId,
      createdBy: asNonEmptyString(argumentsMap.createdBy) ?? assigneeAgentId,
      priority: asTaskPriority(argumentsMap.priority)
    });

    return {
      ok: true,
      toolName: 'task.create',
      output: task
    };
  }

  private async handleProjectCreate(argumentsMap: Record<string, unknown>): Promise<ToolExecutionResult> {
    if (!this.deps.projectService || !this.deps.settingsService || !this.deps.agentService) {
      return unavailableTool('project.create', 'project.create requires project, settings, and agent services');
    }

    const ownerAgentId =
      asNonEmptyString(argumentsMap.ownerAgentId) ??
      (await resolveExecutiveAgentId({
        agentService: this.deps.agentService,
        settingsService: this.deps.settingsService
      }));

    const project = await this.deps.projectService.createProject({
      name: asNonEmptyString(argumentsMap.name) ?? 'Executive Initiative',
      description:
        asNonEmptyString(argumentsMap.description) ??
        'Project created from the executive chat workflow.',
      ownerAgentId
    });

    return {
      ok: true,
      toolName: 'project.create',
      output: project
    };
  }
}

function invalidArguments(toolName: string, message: string): ToolExecutionResult {
  return {
    ok: false,
    toolName,
    error: {
      code: 'TOOL_INVALID_ARGUMENTS',
      message
    }
  };
}

function unavailableTool(toolName: string, message: string): ToolExecutionResult {
  return {
    ok: false,
    toolName,
    error: {
      code: 'TOOL_UNAVAILABLE',
      message
    }
  };
}

function resolveDotPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, source);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : undefined;
}

function asTaskPriority(value: unknown): TaskPriority | undefined {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'urgent'
    ? value
    : undefined;
}

function toCompanyProfile(value: unknown): CompanyProfile {
  if (!isRecord(value)) {
    return {
      companyName: 'FamilyCo',
      companyMission: '',
      companyDirection: ''
    };
  }

  return {
    companyName: asNonEmptyString(value.companyName) ?? 'FamilyCo',
    companyMission: asNonEmptyString(value.companyMission) ?? '',
    companyDirection: asNonEmptyString(value.companyDirection) ?? ''
  };
}

function detectTaskIntent(message: string): boolean {
  return /(create|add|open|track|assign|make|tạo|tao|lập|giao).{0,24}(task|todo|việc|công việc)/i.test(message)
    || /(task|todo|việc|công việc).{0,24}(create|add|open|track|assign|tạo|tao|lập|giao)/i.test(message);
}

function detectProjectIntent(message: string): boolean {
  return /(create|add|open|launch|start|spin up|tạo|tao|lập|mở).{0,24}(project|initiative|workspace|dự án)/i.test(message)
    || /(project|initiative|workspace|dự án).{0,24}(create|add|open|launch|start|tạo|tao|lập|mở)/i.test(message);
}

function buildTaskTitle(message: string): string {
  const subject = trimIntentPrefix(message, /(create|add|open|track|assign|make|tạo|tao|lập|giao)\s+(a\s+)?(task|todo|việc|công việc)\s*(for|to)?\s*/i);
  return clampText(subject.length > 0 ? `Follow up: ${subject}` : 'Executive follow-up', 96);
}

function buildTaskDescription(message: string, profile: CompanyProfile): string {
  const context = [profile.companyMission, profile.companyDirection].filter((value) => value.length > 0).join(' ');
  return context.length > 0 ? `${message}\n\nCompany context: ${context}` : message;
}

function buildProjectName(message: string): string {
  const subject = trimIntentPrefix(message, /(create|add|open|launch|start|spin up|tạo|tao|lập|mở)\s+(a\s+)?(project|initiative|workspace|dự án)\s*(for|to)?\s*/i);
  return clampText(subject.length > 0 ? subject : 'Executive Initiative', 80);
}

function buildProjectDescription(message: string, profile: CompanyProfile): string {
  const companyHint = [profile.companyMission, profile.companyDirection]
    .filter((value) => value.length > 0)
    .join(' ');
  return companyHint.length > 0 ? `${message}\n\nStrategic context: ${companyHint}` : message;
}

function trimIntentPrefix(message: string, pattern: RegExp): string {
  return message.replace(pattern, '').replace(/[.。!]+$/g, '').trim();
}

function clampText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function extractEntityId(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return asNonEmptyString(value.id);
}

function extractEntityLabel(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return asNonEmptyString(value.title) ?? asNonEmptyString(value.name);
}

function summarizeToolCall(result: ToolExecutionResult, entityType: 'task' | 'project'): ChatToolCall {
  if (!result.ok) {
    return {
      toolName: result.toolName,
      ok: false,
      summary: `The ${entityType} tool could not complete the request.`,
      error: result.error
    };
  }

  const label = extractEntityLabel(result.output);
  return {
    toolName: result.toolName,
    ok: true,
    summary: label
      ? `Created ${entityType} “${label}”.`
      : `Created the requested ${entityType}.`,
    output: result.output
  };
}

function buildChatReply(input: {
  profile: CompanyProfile;
  createdTask: unknown;
  createdProject: unknown;
}): string {
  const summaryParts: string[] = [];

  if (input.createdProject) {
    summaryParts.push(
      `I created project “${extractEntityLabel(input.createdProject) ?? 'Executive Initiative'}”.`
    );
  }

  if (input.createdTask) {
    summaryParts.push(
      `I created task “${extractEntityLabel(input.createdTask) ?? 'Executive follow-up'}” in the executive queue.`
    );
  }

  const contextParts = [input.profile.companyMission, input.profile.companyDirection].filter(
    (value) => value.length > 0
  );

  if (summaryParts.length === 0) {
    const guidance = contextParts.length > 0 ? ` Current direction: ${contextParts.join(' ')}` : '';
    return `I kept this in the executive chat lane for ${input.profile.companyName}. If you want tracked execution, ask me explicitly to create a task or project and I will do it through tools.${guidance}`;
  }

  if (contextParts.length > 0) {
    summaryParts.push(`Aligned with ${input.profile.companyName}: ${contextParts.join(' ')}`);
  }

  return summaryParts.join(' ');
}
