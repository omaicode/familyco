import type {
  AgentService,
  ApprovalService,
  AuditService,
  ProjectService,
  Task,
  TaskService
} from '@familyco/core';
import type { FastifyInstance } from 'fastify';

import { requireMinimumLevel } from '../../plugins/rbac.plugin.js';
import { dashboardSidebarCountsSchema, dashboardSummaryQuerySchema } from './dashboard.schema.js';

export interface DashboardModuleDeps {
  agentService: AgentService;
  approvalService: ApprovalService;
  auditService: AuditService;
  projectService: ProjectService;
  taskService: TaskService;
}

export function registerDashboardController(app: FastifyInstance, deps: DashboardModuleDeps): void {
  app.get('/dashboard/sidebar-counts', async (request) => {
    requireMinimumLevel(request, 'L1');

    const [agents, projects, tasks, approvals] = await Promise.all([
      deps.agentService.listAgents(),
      deps.projectService.listProjects(),
      deps.taskService.listTasks(),
      deps.approvalService.listApprovalRequests()
    ]);

    return dashboardSidebarCountsSchema.parse({
      agents: agents.length,
      projects: projects.length,
      tasks: tasks.length,
      pendingApprovals: approvals.filter((approval) => approval.status === 'pending').length
    });
  });

  app.get('/dashboard/summary', async (request) => {
    requireMinimumLevel(request, 'L1');
    const query = dashboardSummaryQuerySchema.parse(request.query);

    const agents = await deps.agentService.listAgents();
    const approvals = await deps.approvalService.listApprovalRequests();
    const projects = query.projectId
      ? [{ id: query.projectId }]
      : await deps.projectService.listProjects().then((items) => items.map((item) => ({ id: item.id })));

    const tasksByProject = await Promise.all(projects.map(async (project) => deps.taskService.listProjectTasks(project.id)));
    const tasks = tasksByProject.flat();

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const blockedTasks = tasks.filter((task) => task.status === 'blocked');
    const doneLast24h = tasks.filter(
      (task) => task.status === 'done' && task.updatedAt.getTime() >= oneDayAgo
    );
    const pendingApprovals = approvals.filter((approval) => approval.status === 'pending');
    const decidedApprovals = approvals.filter((approval) => approval.status !== 'pending');

    const approvalLatencyMinutes =
      decidedApprovals.length === 0
        ? 0
        : Math.round(
            decidedApprovals.reduce((sum, approval) => {
              const latency = approval.updatedAt.getTime() - approval.createdAt.getTime();
              return sum + latency / 60000;
            }, 0) / decidedApprovals.length
          );

    const recentTasks = byRecent(tasks).slice(0, 8);

    const recentAudit = await deps.auditService.list({ limit: 25 });
    const engineAudit = recentAudit.filter((record) => record.action.startsWith('engine.'));

    return {
      metrics: {
        activeAgents: agents.filter((agent) => agent.status === 'active').length,
        tasksToday: tasks.length,
        blockedTasks: blockedTasks.length,
        blockedRatio: tasks.length === 0 ? 0 : Number((blockedTasks.length / tasks.length).toFixed(2)),
        pendingApprovals: pendingApprovals.length,
        approvalLatencyMinutes,
        throughputDoneLast24h: doneLast24h.length,
        tokenUsageToday: sumTokenUsage(engineAudit)
      },
      recentTasks: recentTasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        projectId: task.projectId,
        updatedAt: task.updatedAt
      })),
      pendingApprovals: pendingApprovals.slice(0, 8),
      latestAudit: recentAudit.slice(0, 12)
    };
  });
}

function byRecent(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

function sumTokenUsage(records: Array<{ payload?: Record<string, unknown> }>): number {
  return records.reduce((sum, record) => {
    const tokenUsage = record.payload?.tokenUsage;
    if (typeof tokenUsage === 'number') {
      return sum + tokenUsage;
    }

    return sum;
  }, 0);
}
