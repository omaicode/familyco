import { randomUUID } from 'node:crypto';

import {
  type AgentProfile,
  type AgentService,
  type AuditService,
  type EventBus,
  type InboxService,
  type ProjectService,
  type TaskService,
  type Task,
  runAgentLoop
} from '@familyco/core';

import { filterToolsForAgent } from '../modules/agent/chat-engine.service.js';
import type { ChatEngineService } from '../modules/agent/chat-engine.service.js';
import { renderTaskSystemPrompt } from '../prompts/task/task-system.template.js';
import { renderTaskUserPrompt } from '../prompts/task/task-user.template.js';
import type { SkillsService } from '../modules/skills/skills.service.js';
import type { DefaultToolExecutor } from '../tools/default-tool.executor.js';
import type { TaskSessionRepository, TaskSessionCheckpoint, TaskSessionStatus, TaskSessionToolResult } from './task-session.store.js';

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3
};

const ACTIONABLE_STATUSES = new Set(['pending', 'in_progress']);

export interface TaskExecutionResult {
  taskId: string;
  agentId: string;
  status: 'completed' | 'blocked' | 'waiting_for_approval' | 'waiting_for_input' | 'no_tasks' | 'skipped';
  summary: string;
}

export interface BatchTaskExecutionResult {
  agentId: string;
  tasksRun: number;
  results: TaskExecutionResult[];
  // Last result for backward compat with heartbeat
  lastResult: TaskExecutionResult;
}

export interface TaskExecutionCoordinatorOptions {
  chatEngineService: ChatEngineService;
  toolExecutor: DefaultToolExecutor;
  taskService: TaskService;
  projectService: ProjectService;
  auditService: AuditService;
  inboxService: InboxService;
  agentService: AgentService;
  skillsService?: SkillsService;
  sessionStore: TaskSessionRepository;
  eventBus?: EventBus;
  companyName?: string;
}

export class TaskExecutionCoordinator {
  constructor(private readonly options: TaskExecutionCoordinatorOptions) {}

  async executeForAgent(agentId: string): Promise<BatchTaskExecutionResult> {
    const noTasksResult: TaskExecutionResult = {
      taskId: '', agentId, status: 'no_tasks', summary: 'No actionable tasks found'
    };

    const agent = await this.options.agentService.getAgentById(agentId).catch(() => null);
    if (!agent) {
      const skipped: TaskExecutionResult = { taskId: '', agentId, status: 'skipped', summary: 'Agent not found' };
      return { agentId, tasksRun: 0, results: [skipped], lastResult: skipped };
    }

    const results: TaskExecutionResult[] = [];
    const executedTaskIds = new Set<string>();

    // Process all actionable tasks for this agent in priority order.
    // Re-query after each run so status changes from the previous task are reflected.
    while (true) {
      const task = await this.selectNextTask(agentId, executedTaskIds);
      if (!task) {
        break;
      }

      executedTaskIds.add(task.id);
      const result = await this.runTaskForAgent(agent, task);
      results.push(result);

      // Stop batch if the run produced a blocking or skipped outcome
      if (result.status === 'skipped') {
        break;
      }
    }

    if (results.length === 0) {
      return { agentId, tasksRun: 0, results: [noTasksResult], lastResult: noTasksResult };
    }

    const lastResult = results[results.length - 1] ?? noTasksResult;
    return { agentId, tasksRun: results.length, results, lastResult };
  }

  /** Execute a specific task by ID. Used by task.dispatch to run individual tasks concurrently. */
  async executeTask(agentId: string, taskId: string): Promise<BatchTaskExecutionResult> {
    const noTaskResult: TaskExecutionResult = {
      taskId, agentId, status: 'no_tasks', summary: `Task ${taskId} not found or not actionable`
    };

    const agent = await this.options.agentService.getAgentById(agentId).catch(() => null);
    if (!agent) {
      const skipped: TaskExecutionResult = { taskId, agentId, status: 'skipped', summary: 'Agent not found' };
      return { agentId, tasksRun: 0, results: [skipped], lastResult: skipped };
    }

    const task = await this.options.taskService.getTaskWithReadiness(taskId).catch(() => null);
    if (!task) {
      return { agentId, tasksRun: 0, results: [noTaskResult], lastResult: noTaskResult };
    }

    if (!ACTIONABLE_STATUSES.has(task.status)) {
      const skipped: TaskExecutionResult = {
        taskId, agentId, status: 'skipped',
        summary: `Task ${taskId} is not actionable (status: ${task.status})`
      };
      return { agentId, tasksRun: 0, results: [skipped], lastResult: skipped };
    }

    if (!task.readiness.ready) {
      const skipped: TaskExecutionResult = {
        taskId,
        agentId,
        status: 'skipped',
        summary: `Task ${taskId} is not ready: ${task.readiness.blockers.map((blocker) => blocker.message).join(' | ')}`
      };
      return { agentId, tasksRun: 0, results: [skipped], lastResult: skipped };
    }

    const result = await this.runTaskForAgent(agent, task);
    return { agentId, tasksRun: 1, results: [result], lastResult: result };
  }

  async selectNextTask(agentId: string, excludeIds?: Set<string>): Promise<Task | null> {
    const tasks = await this.options.taskService.listTasksWithReadiness({ assigneeAgentId: agentId });
    const actionable = tasks.filter(
      (t) => ACTIONABLE_STATUSES.has(t.status) && !(excludeIds?.has(t.id)) && t.readiness.ready
    );

    if (actionable.length === 0) {
      return null;
    }

    const waiting = await this.filterWaitingTasks(actionable);
    const candidates = actionable.filter((t) => !waiting.has(t.id));

    if (candidates.length === 0) {
      return null;
    }

    return candidates.sort((left, right) => {
      const priorityDiff = (PRIORITY_ORDER[left.priority] ?? 2) - (PRIORITY_ORDER[right.priority] ?? 2);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    })[0] ?? null;
  }

  private async filterWaitingTasks(tasks: Task[]): Promise<Set<string>> {
    const waiting = new Set<string>();

    for (const task of tasks) {
      const session = await this.options.sessionStore.load(task.id);
      if (session?.status === 'waiting_for_approval' || session?.status === 'waiting_for_input') {
        waiting.add(task.id);
      }
    }

    return waiting;
  }

  private async runTaskForAgent(agent: AgentProfile, task: Task): Promise<TaskExecutionResult> {
    const session = await this.loadOrCreateSession(task, agent);

    this.options.eventBus?.emit('agent.run.started', {
      agentId: agent.id,
      agentName: agent.name,
      taskId: task.id,
      sessionId: session.sessionId,
      taskTitle: task.title
    });

    const comments = await this.loadTaskComments(task.id);

    const adapterConfig = await this.options.chatEngineService.getAdapterConfig(
      agent.aiAdapterId,
      agent.aiModel
    );

    if (!adapterConfig) {
      this.options.eventBus?.emit('agent.run.failed', {
        agentId: agent.id,
        agentName: agent.name,
        taskId: task.id,
        sessionId: session.sessionId,
        error: 'No AI adapter configured for agent'
      });
      return {
        taskId: task.id,
        agentId: agent.id,
        status: 'skipped',
        summary: 'No AI adapter configured for agent'
      };
    }

    const adapter = this.options.chatEngineService.getAdapter(adapterConfig.adapterId);
    if (!adapter) {
      this.options.eventBus?.emit('agent.run.failed', {
        agentId: agent.id,
        agentName: agent.name,
        taskId: task.id,
        sessionId: session.sessionId,
        error: `Adapter not found: ${adapterConfig.adapterId}`
      });
      return {
        taskId: task.id,
        agentId: agent.id,
        status: 'skipped',
        summary: `Adapter not found: ${adapterConfig.adapterId}`
      };
    }

    const allTools = this.options.toolExecutor.listToolDefinitions();
    const filteredTools = filterToolsForAgent(allTools, agent.level);
    const skills = await this.resolveSkills(agent);
    const companyName = this.options.companyName ?? 'FamilyCo';

    // Resolve project workspace dir for scoped file tool access
    const project = task.projectId
      ? await this.options.projectService.getProjectById(task.projectId).catch(() => null)
      : null;
    const projectWorkspaceDir = project?.dirPath ?? undefined;

    // Create a per-task executor scoped to the project's workspace directory
    const taskExecutor = projectWorkspaceDir
      ? this.options.toolExecutor.fork(projectWorkspaceDir, agent.id)
      : this.options.toolExecutor.fork(undefined, agent.id);

    const systemPrompt = renderTaskSystemPrompt({
      agentName: agent.name,
      agentRole: agent.role,
      agentDepartment: agent.department,
      agentId: agent.id,
      companyName,
      projectId: project?.id,
      projectName: project?.name,
      projectDescription: project?.description,
      projectOwnerAgentId: project?.ownerAgentId,
      projectParentId: project?.parentProjectId ?? null,
      projectCreatedAt: project?.createdAt?.toISOString(),
      projectUpdatedAt: project?.updatedAt?.toISOString(),
      projectWorkspaceDir,
      skills,
      tools: filteredTools
    });

    const userPrompt = renderTaskUserPrompt({
      taskId: task.id,
      taskTitle: task.title,
      taskDescription: task.description,
      taskStatus: task.status,
      taskPriority: task.priority,
      dependsOnTaskIds: task.dependsOnTaskIds,
      readinessRules: task.readinessRules,
      readiness: await this.options.taskService.evaluateTaskReadinessForTask(task),
      assigneeAgentId: task.assigneeAgentId,
      previousSessionSummary: session.summary || undefined,
      previousToolResults: session.toolResults.length > 0 ? session.toolResults : undefined,
      taskComments: comments
    });

    const toolsUsed: string[] = [];
    let stepCount = 0;

    const loopResult = await runAgentLoop({
      adapter,
      apiKey: adapterConfig.apiKey,
      model: adapterConfig.model,
      systemPrompt,
      userPrompt,
      availableTools: filteredTools,
      maxRounds: 12,
      executeTool: async (toolInput) => {
        stepCount += 1;
        this.options.eventBus?.emit('agent.run.step', {
          agentId: agent.id,
          agentName: agent.name,
          taskId: task.id,
          sessionId: session.sessionId,
          step: stepCount,
          toolName: toolInput.toolName,
          summary: `Calling ${toolInput.toolName}`
        });
        const result = await taskExecutor.execute({
          toolName: toolInput.toolName,
          arguments: toolInput.arguments
        });
        toolsUsed.push(toolInput.toolName);
        return { ok: result.ok, output: result.output, error: result.error };
      }
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.options.eventBus?.emit('agent.run.failed', {
        agentId: agent.id,
        agentName: agent.name,
        taskId: task.id,
        sessionId: session.sessionId,
        error: message
      });
      return { finalReply: `Task execution error: ${message}`, turns: [], totalTurns: 0 };
    });

    const sessionStatus = resolveSessionStatus(toolsUsed);
    const summary = loopResult.finalReply.trim() || buildFallbackSummary(task.title, toolsUsed, sessionStatus);

    const capturedToolResults: TaskSessionToolResult[] = loopResult.turns
      .flatMap((turn) => turn.toolResults)
      .map((r) => ({
        toolName: r.toolName,
        ok: r.ok,
        output: r.ok ? serializeOutput(r.output) : undefined,
        error: !r.ok ? (r.error?.message ?? 'unknown error') : undefined
      }));

    const updatedSession: TaskSessionCheckpoint = {
      ...session,
      status: sessionStatus,
      summary: summary.slice(0, 2_000),
      lastToolNames: toolsUsed,
      toolResults: capturedToolResults,
      checkpointIndex: session.checkpointIndex + 1,
      updatedAt: new Date().toISOString()
    };

    await this.options.sessionStore.save(updatedSession);

    await this.options.auditService.write({
      actorId: agent.id,
      action: 'task.session.checkpoint',
      targetId: task.id,
      payload: {
        sessionId: updatedSession.sessionId,
        checkpointIndex: updatedSession.checkpointIndex,
        status: updatedSession.status,
        toolsUsed,
        summary: updatedSession.summary
      }
    });

    this.options.eventBus?.emit('agent.run.completed', {
      agentId: agent.id,
      agentName: agent.name,
      taskId: task.id,
      sessionId: session.sessionId,
      status: sessionStatus,
      summary: updatedSession.summary.slice(0, 300)
    });

    if (sessionStatus === 'completed') {
      // Re-read the task's current status. The agent is instructed to call task.update-status
      // explicitly. Only auto-set to 'done' as a fallback if the agent left it in 'in_progress'.
      // Never override an explicit 'review', 'blocked', 'done', or other final status the agent set.
      const freshTask = await this.options.taskService.getTask(task.id).catch(() => null);
      if (freshTask?.status === 'in_progress') {
        await this.options.taskService
          .updateTaskStatus(task.id, 'done', {
            source: 'agent',
            actorId: agent.id
          })
          .catch(() => undefined);
      }
    } else if (sessionStatus === 'waiting_for_input') {
      await this.handleInfoEscalation(agent, task, loopResult.finalReply);
    }

    return {
      taskId: task.id,
      agentId: agent.id,
      status: sessionStatus === 'active' ? 'completed' : sessionStatus,
      summary: updatedSession.summary
    };
  }

  private async loadOrCreateSession(task: Task, agent: AgentProfile): Promise<TaskSessionCheckpoint> {
    const existing = await this.options.sessionStore.load(task.id);
    if (existing && existing.agentId === agent.id) {
      return existing;
    }

    const session: TaskSessionCheckpoint = {
      taskId: task.id,
      agentId: agent.id,
      sessionId: randomUUID(),
      checkpointIndex: 0,
      status: 'active',
      summary: '',
      lastToolNames: [],
      toolResults: [],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.options.sessionStore.save(session);
    return session;
  }

  private async loadTaskComments(taskId: string): Promise<Array<{ authorId: string; authorLabel?: string; body: string; createdAt: string }>> {
    const records = await this.options.auditService.list({
      action: 'task.comment.added',
      targetId: taskId,
      limit: 20
    });

    return records
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map((record) => ({
        authorId: record.actorId,
        authorLabel: typeof record.payload?.authorLabel === 'string' ? record.payload.authorLabel : undefined,
        body: typeof record.payload?.body === 'string' ? record.payload.body : '',
        createdAt: record.createdAt.toISOString()
      }));
  }

  private async handleInfoEscalation(agent: AgentProfile, task: Task, agentReply: string): Promise<void> {
    const parentId = agent.parentAgentId ?? 'founder';
    const title = `Needs input: ${task.title}`;
    const body = [
      `Agent **${agent.name}** is waiting for input on task "${task.title}" (ID: ${task.id}).`,
      '',
      agentReply.slice(0, 1_000)
    ].join('\n');

    await this.options.inboxService.createMessage({
      recipientId: parentId,
      senderId: agent.id,
      type: 'info',
      title,
      body,
      payload: { taskId: task.id, agentId: agent.id }
    });
  }

  private async resolveSkills(agent: AgentProfile): Promise<Array<{ id: string; name: string; description: string; path: string }>> {
    if (!this.options.skillsService) {
      return [];
    }

    const skills = await this.options.skillsService.listForAgent({
      level: agent.level,
      id: agent.id,
      name: agent.name
    }).catch(() => null);

    return skills?.map((s) => ({ id: s.id, name: s.name, description: s.description, path: s.path })) ?? [];
  }
}

function resolveSessionStatus(toolsUsed: string[]): TaskSessionStatus {
  if (toolsUsed.includes('approval.request')) {
    return 'waiting_for_approval';
  }

  if (toolsUsed.includes('inbox.send')) {
    return 'waiting_for_input';
  }

  return 'completed';
}

function buildFallbackSummary(taskTitle: string, toolsUsed: string[], status: TaskSessionStatus): string {
  const unique = [...new Set(toolsUsed)];
  const toolList = unique.length > 0 ? unique.join(', ') : 'none';
  return `Session ended without a final reply from the agent. Task: "${taskTitle}". Tools used: ${toolList}. Status: ${status}.`;
}

function serializeOutput(output: unknown): string {
  try {
    const raw = typeof output === 'string' ? output : JSON.stringify(output);
    return raw.slice(0, 800);
  } catch {
    return String(output).slice(0, 800);
  }
}
