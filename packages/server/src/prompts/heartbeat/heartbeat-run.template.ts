import { renderRoleGoalConstraintsTemplate } from '../prompt.pattern.js';
import type { HeartbeatRunPromptInput } from '../prompt.types.js';

export function renderHeartbeatRunPrompt(input: HeartbeatRunPromptInput): string {
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
    context: [
      `Heartbeat Timestamp: ${input.timestamp}`,
      'Report progress for this heartbeat run.'
    ]
  });
}
