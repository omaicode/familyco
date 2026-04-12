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
      '- Loaded skills are operating guides for this heartbeat, not optional references.',
      '- Before deciding the next action, compare the saved context and current situation against every loaded skill description.',
      '- If a skill matches, read that SKILL.md at the listed path with a file-reading tool before taking action.',
      '- Follow the matched skill workflow and constraints while completing the heartbeat.',
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

  return input.map((skill) => `- ${skill.id} (${skill.name}): ${skill.description} Path => ${skill.path}`);
}
