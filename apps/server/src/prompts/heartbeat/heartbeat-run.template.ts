import { renderRoleGoalConstraintsTemplate } from '../prompt.pattern.js';
import type { HeartbeatRunPromptInput } from '../prompt.types.js';

export function renderHeartbeatRunPrompt(input: HeartbeatRunPromptInput): string {
  const skillLines = renderSkillLines(input.skills ?? []);

  return renderRoleGoalConstraintsTemplate({
    role: [
      `You are ${input.agentName}, acting as ${input.agentRole} in ${input.agentDepartment}.`,
      'This is a scheduled idle check — there are currently no pending tasks assigned to you.'
    ],
    responsibilities: [
      'Review your current situation and take any useful proactive action:',
      '  - Check for any outstanding blockers or follow-ups you can resolve now.',
      '  - Use inbox.send to communicate any updates to your manager or Founder if needed.',
      '  - Do NOT fabricate work or invent tasks that do not exist.',
      '  - If there is genuinely nothing to do, call task.log with a brief status note and stop.',
      '',
      'Do NOT call task.update-status or task.comment.add unless you have an active task to work on.',
      'Keep this run short and purposeful.'
    ],
    capabilities: [
      '- You can send inbox messages and log status notes.',
      '- You can read files or check project state if relevant to a follow-up.',
      '- You cannot create tasks or invent work that does not exist.',
      '- You cannot access real-time information or fabricate progress.'
    ],
    skills: [
      '- If a skill is relevant to a pending follow-up, read it before acting.',
      ...skillLines
    ],
    context: [
      `Heartbeat Timestamp: ${input.timestamp}`,
      'No pending tasks are currently assigned to you.'
    ]
  });
}

function renderSkillLines(input: NonNullable<HeartbeatRunPromptInput['skills']>): string[] {
  if (input.length === 0) {
    return ['- No skills loaded for this agent.'];
  }

  return input.map((skill) => `- ${skill.id} (${skill.name}): ${skill.description} Path => ${skill.path}`);
}
