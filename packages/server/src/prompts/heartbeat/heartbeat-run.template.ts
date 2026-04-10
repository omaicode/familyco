import { renderRoleGoalConstraintsTemplate } from '../prompt.pattern.js';
import type { HeartbeatRunPromptInput } from '../prompt.types.js';

export function renderHeartbeatRunPrompt(input: HeartbeatRunPromptInput): string {
  return renderRoleGoalConstraintsTemplate({
    role: `You are ${input.agentName}, acting as ${input.agentRole} in ${input.agentDepartment}.`,
    goal: 'Execute the scheduled heartbeat cycle and continue progress using the latest saved context.',
    constraints: [
      'Resume from saved session context before taking action.',
      'Report concrete progress and blockers only.',
      'Do not fabricate completed work or external facts.',
      'Keep the update concise and operational.'
    ],
    context: [
      `Heartbeat Timestamp: ${input.timestamp}`,
      'Report progress for this heartbeat run.'
    ]
  });
}
