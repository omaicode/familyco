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
      'Step 1 — Load the full task board for yourself:',
      `  Call task.list with assigneeAgentId="${input.agentId}" (without status filter) to fetch ALL your tasks.`,
      '  Build these groups from the result:',
      '    - actionable: status in_progress or pending',
      '    - blocked: status blocked (for dependency awareness only, do not dispatch)',
      '    - done/cancelled: ignore for execution',
      '',
      'Step 2 — Build project context before ranking:',
      '  For each project that has actionable tasks, call project.read once (project id or exact name).',
      '  Use project details (name, description, createdAt, state) to infer execution phase.',
      '  If project.read fails for a project, continue with available task data.',
      '',
      'Step 3 — Rank actionable tasks with this priority model:',
      '  Apply these rules top-down:',
      '    1. Resume work already in_progress before starting new pending tasks.',
      '    2. Within the same status, prefer lifecycle-gating tasks that unlock the project path.',
      '       Typical early-gate tasks include kickoff, requirements, scope alignment, and technical setup/foundation.',
      '    3. Respect task priority: urgent > high > medium > low.',
      '    4. If still tied, earlier createdAt first.',
      '  IMPORTANT: In a new/simple website project, tasks like "Project Kickoff & Requirements" and',
      '  "Tech Setup" are usually gating tasks and should be dispatched before downstream implementation tasks.',
      '',
      'Step 4 — Decide:',
      '  A) If there are actionable tasks (in_progress or pending):',
      '     - Select up to 5 highest-ranked actionable tasks.',
      `     - Call heartbeat.dispatch with agentId="${input.agentId}" and taskIds as a comma-separated list.`,
      '     - STOP after dispatching. Do not call any other tools.',
      '  B) If there are NO actionable tasks:',
      '     - Call task.log with a brief "No actionable tasks at heartbeat check" note.',
      '     - STOP. Do NOT call heartbeat.dispatch.',
      '',
      'RULES:',
      '  - Do NOT call task.update-status, task.comment.add, or any other task tool during this heartbeat run.',
      '  - You MAY call only: task.list, project.read, heartbeat.dispatch, task.log.',
      '  - Do NOT call heartbeat.dispatch with empty taskIds — skip it and go to task.log instead.',
      '  - Do NOT fabricate tasks or invent work.',
      '  - Do NOT ask for confirmation or describe what you plan to do — just do it.'
    ],
    capabilities: [
      '- task.list — list your assigned tasks',
      '- heartbeat.dispatch — dispatch selected tasks for execution',
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
