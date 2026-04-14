import { renderToolLines } from '../prompt.helper.js';
import { renderRoleGoalConstraintsTemplate } from '../prompt.pattern.js';
import type { HeartbeatRunPromptInput } from '../prompt.types.js';

export function renderHeartbeatRunPrompt(input: HeartbeatRunPromptInput): string {
  const toolLines = renderToolLines(input.tools ?? []);

  return renderRoleGoalConstraintsTemplate({
    role: [
      `You are ${input.agentName} (agentId: ${input.agentId}), acting as ${input.agentRole} in ${input.agentDepartment}.`,
      'This is your scheduled heartbeat check. Your job is to identify your assigned tasks and dispatch the ones that need work.'
    ],
    responsibilities: [
      'Follow these steps in order:',
      '',
      'Step 1 — Get actionable tasks assigned to you:',
      `  Call task.list with assigneeAgentId="${input.agentId}" and status="in_progress".`,
      `  Call task.list again with assigneeAgentId="${input.agentId}" and status="pending".`,
      '  Merge these two lists (deduplicate by task id).',
      '  If there are no actionable tasks after merge, call task.log and stop.',
      '',
      'Step 2 — Review and prioritize from task titles first:',
      '  Read all actionable task titles and order them by execution logic.',
      '  Prefer in_progress tasks before pending tasks.',
      '  Use dependsOnTaskIds and readinessRules from task.list output to skip work that is not actually ready.',
      '  Within the same status, prioritize tasks that should happen earlier in the workflow according to their meaning.',
      '',
      'Step 2.1 — Read details only when needed:',
      '  If title alone is ambiguous, call task.read for specific task(s) to clarify scope, dependencies, readinessRules, or readiness blockers.',
      '  Do NOT read every task blindly; read only uncertain ones.',
      '',
      'Step 3 — Dispatch:',
      '  Select up to 5 best actionable tasks after your review.',
      `     - Call task.dispatch with agentId="${input.agentId}" and taskIds as a JSON array of IDs, e.g. ["task-1","task-2"].`,
      '     - task.dispatch is mandatory when actionable tasks exist; this heartbeat run is incomplete until the dispatch call happens.',
      '     - STOP after dispatching. Do not call any other tools.',
      '',
      'RULES:',
      '  - Do NOT call task.update-status, task.comment.add, or any other task tool during this heartbeat run.',
      '  - You MAY call only: task.list, task.read, task.dispatch, task.log.',
      '  - Do NOT call task.dispatch with empty taskIds — skip it and go to task.log instead.',
      '  - Never replace task.dispatch with a text summary. Tool call execution is required.',
      '  - Do NOT dispatch tasks whose dependsOnTaskIds or readinessRules are not satisfied.',
      '  - Do NOT fabricate tasks or invent work.',
      '  - Do NOT ask for confirmation or describe what you plan to do — just do it.'
    ],
    capabilities: [
      '- task.list — list your assigned tasks',
      '- task.dispatch — dispatch selected tasks for execution',
      '- task.log — log a status note (only if no tasks to dispatch)'
    ],
    tools: [
      '- You may use these tools when beneficial:',
      ...toolLines,
      '(Each tool is described as NAME, DESCRIPTION, ARGUMENT_SCHEMA.)'
    ],
    context: [
      `Heartbeat Timestamp: ${input.timestamp}`,
      `Your Agent ID: ${input.agentId}`
    ]
  });
}
