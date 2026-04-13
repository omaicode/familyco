import { renderRoleGoalConstraintsTemplate } from '../prompt.pattern.js';
import type { HeartbeatRunPromptInput } from '../prompt.types.js';

export function renderHeartbeatRunPrompt(input: HeartbeatRunPromptInput): string {
  const skillLines = renderSkillLines(input.skills ?? []);

  return renderRoleGoalConstraintsTemplate({
    role: [
      `You are ${input.agentName} (agentId: ${input.agentId}), acting as ${input.agentRole} in ${input.agentDepartment}.`,
      'This is your scheduled heartbeat check. Your job is to identify your assigned tasks and dispatch the ones that need work.'
    ],
    responsibilities: [
      'Follow these steps in order:',
      '',
      'Step 1 — List your tasks:',
      `  Call task.list with assigneeId="${input.agentId}" to see all tasks assigned to you.`,
      '  Focus on tasks with status "in_progress" or "pending" (not "done", "cancelled", or "blocked").',
      '',
      'Step 2 — Prioritize:',
      '  Sort tasks as follows:',
      '    1. Status "in_progress" first (highest priority — resume unfinished work).',
      '    2. Then by priority field: "critical" > "high" > "medium" > "low".',
      '  Select up to 5 tasks to dispatch. Prefer fewer if tasks are complex.',
      '',
      'Step 3 — Dispatch:',
      `  Call heartbeat.dispatch with agentId="${input.agentId}" and a comma-separated list of selected taskIds.`,
      '  Each dispatched task will start running immediately in parallel.',
      '',
      'Step 4 — If no actionable tasks:',
      '  If task.list returns no pending or in_progress tasks, call task.log with a brief "No actionable tasks" note and stop.',
      '',
      'RULES:',
      '  - Do NOT call task.update-status, task.comment.add, or any other task tool during this heartbeat run.',
      '  - Only call task.list and heartbeat.dispatch (and task.log if no tasks).',
      '  - Do NOT fabricate tasks or invent work.',
      '  - Do NOT ask for confirmation or describe what you plan to do — just do it.'
    ],
    capabilities: [
      '- task.list — list your assigned tasks',
      '- heartbeat.dispatch — dispatch selected tasks for execution',
      '- task.log — log a status note (only if no tasks to dispatch)'
    ],
    skills: [
      '- Do not read skills during this heartbeat run.',
      ...skillLines
    ],
    context: [
      `Heartbeat Timestamp: ${input.timestamp}`,
      `Your Agent ID: ${input.agentId}`
    ]
  });
}

function renderSkillLines(input: NonNullable<HeartbeatRunPromptInput['skills']>): string[] {
  if (input.length === 0) {
    return ['- No skills loaded for this agent.'];
  }

  return input.map((skill) => `- ${skill.id} (${skill.name}): ${skill.description} Path => ${skill.path}`);
}
