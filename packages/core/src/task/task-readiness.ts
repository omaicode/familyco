import type {
  Task,
  TaskReadinessBlocker,
  TaskReadinessEvaluation,
  TaskReadinessRule,
  TaskStatus
} from './task.entity.js';

const TASK_COMPLETED_STATUS: TaskStatus = 'done';

export function normalizeTaskDependencyIds(taskIds: string[] | undefined): string[] {
  if (!Array.isArray(taskIds)) {
    return [];
  }

  return [...new Set(taskIds.map((taskId) => taskId.trim()).filter((taskId) => taskId.length > 0))];
}

export function normalizeTaskReadinessRules(rules: TaskReadinessRule[] | undefined): TaskReadinessRule[] {
  if (!Array.isArray(rules)) {
    return [];
  }

  const normalizedRules: TaskReadinessRule[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    const normalized = normalizeTaskReadinessRule(rule);
    const signature = JSON.stringify(normalized);
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    normalizedRules.push(normalized);
  }

  return normalizedRules;
}

export function normalizeTaskReadinessRule(rule: TaskReadinessRule): TaskReadinessRule {
  if (rule.type !== 'task_status') {
    throw new Error(`TASK_READINESS_RULE_UNSUPPORTED:${String((rule as { type?: unknown }).type ?? 'unknown')}`);
  }

  const taskId = rule.taskId.trim();
  if (taskId.length === 0) {
    throw new Error('TASK_READINESS_RULE_TASK_ID_REQUIRED');
  }

  if (!isTaskStatus(rule.status)) {
    throw new Error(`TASK_READINESS_RULE_STATUS_INVALID:${String(rule.status)}`);
  }

  const description = rule.description?.trim();

  return {
    type: 'task_status',
    taskId,
    status: rule.status,
    ...(description ? { description } : {})
  };
}

export function evaluateTaskReadiness(input: {
  task: Task;
  relatedTasks: Iterable<Task>;
}): TaskReadinessEvaluation {
  const taskIndex = new Map<string, Task>();
  for (const relatedTask of input.relatedTasks) {
    taskIndex.set(relatedTask.id, relatedTask);
  }

  taskIndex.set(input.task.id, input.task);

  const blockers: TaskReadinessBlocker[] = [];

  for (const dependencyId of input.task.dependsOnTaskIds) {
    if (dependencyId === input.task.id) {
      blockers.push({
        code: 'DEPENDENCY_CYCLE',
        message: `Task ${input.task.id} cannot depend on itself.`,
        taskId: dependencyId
      });
      continue;
    }

    const dependency = taskIndex.get(dependencyId);
    if (!dependency) {
      blockers.push({
        code: 'DEPENDENCY_MISSING',
        message: `Dependency task ${dependencyId} was not found.`,
        taskId: dependencyId
      });
      continue;
    }

    if (dependency.status !== TASK_COMPLETED_STATUS) {
      blockers.push({
        code: 'DEPENDENCY_NOT_DONE',
        message: `Dependency task ${dependencyId} is ${dependency.status}; expected ${TASK_COMPLETED_STATUS}.`,
        taskId: dependencyId,
        currentStatus: dependency.status,
        requiredStatus: TASK_COMPLETED_STATUS
      });
    }
  }

  for (const rule of input.task.readinessRules) {
    if (rule.type !== 'task_status') {
      blockers.push({
        code: 'RULE_UNSUPPORTED',
        message: `Readiness rule type ${String((rule as { type?: unknown }).type ?? 'unknown')} is not supported.`,
        ruleType: String((rule as { type?: unknown }).type ?? 'unknown')
      });
      continue;
    }

    if (rule.taskId === input.task.id) {
      blockers.push({
        code: 'RULE_CYCLE',
        message: `Readiness rule cannot target the same task ${input.task.id}.`,
        taskId: rule.taskId,
        ruleType: rule.type,
        requiredStatus: rule.status
      });
      continue;
    }

    const referencedTask = taskIndex.get(rule.taskId);
    if (!referencedTask) {
      blockers.push({
        code: 'RULE_TASK_MISSING',
        message: `Readiness rule references missing task ${rule.taskId}.`,
        taskId: rule.taskId,
        ruleType: rule.type,
        requiredStatus: rule.status
      });
      continue;
    }

    if (referencedTask.status !== rule.status) {
      blockers.push({
        code: 'RULE_STATUS_MISMATCH',
        message: `Readiness rule expects task ${rule.taskId} to be ${rule.status}, but it is ${referencedTask.status}.`,
        taskId: rule.taskId,
        ruleType: rule.type,
        currentStatus: referencedTask.status,
        requiredStatus: rule.status
      });
    }
  }

  return {
    ready: blockers.length === 0,
    blockers,
    checkedDependencyCount: input.task.dependsOnTaskIds.length,
    checkedRuleCount: input.task.readinessRules.length
  };
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    value === 'pending'
    || value === 'in_progress'
    || value === 'review'
    || value === 'done'
    || value === 'blocked'
    || value === 'cancelled'
  );
}
