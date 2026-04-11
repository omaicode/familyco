import { renderRoleGoalConstraintsTemplate } from '../prompt.pattern.js';
import type { HeartbeatRunPromptInput } from '../prompt.types.js';

export function renderHeartbeatRunPrompt(input: HeartbeatRunPromptInput): string {
  const skillLines = renderSkillLines(input.skills ?? []);

  return renderRoleGoalConstraintsTemplate({
    role: [`You are ${input.agentName}, acting as ${input.agentRole} in ${input.agentDepartment}.`],
    responsibilities: [
      'Execute the scheduled heartbeat cycle and continue progress using the latest saved context.',
      'Resume from saved session context before taking action.',
      'Report concrete progress and blockers only.',
      'Do not fabricate completed work or external facts.',
      'Keep the update concise and operational.'
    ],
    capabilities: [
      '- You can access the latest saved session context, including previous progress and tool results.',
      '- You can report progress and blockers based on actual completed work since the last heartbeat.',
      '- You cannot access real-time information or fabricate progress.'
    ],
    skills: [
      '- You may use these built-in skills as operating guidance for this heartbeat:',
      ...skillLines
    ],
    context: [
      `Heartbeat Timestamp: ${input.timestamp}`,
      'Report progress for this heartbeat run.'
    ]
  });
}

function renderSkillLines(input: NonNullable<HeartbeatRunPromptInput['skills']>): string[] {
  if (input.length === 0) {
    return ['- No skills loaded for this agent.'];
  }

  return input.map((skill) => `- ${skill.id}: ${skill.description} Path => ${skill.path}`);
}
