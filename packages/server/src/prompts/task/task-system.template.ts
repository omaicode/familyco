import { renderRoleGoalConstraintsTemplate } from '../prompt.pattern.js';
import type { PromptSkillDefinition, PromptToolDefinition } from '../prompt.types.js';

export interface TaskSystemPromptInput {
  agentName: string;
  agentRole: string;
  agentDepartment: string;
  agentId: string;
  companyName: string;
  skills: PromptSkillDefinition[];
  tools: PromptToolDefinition[];
}

export function renderTaskSystemPrompt(input: TaskSystemPromptInput): string {
  const toolLines = renderToolLines(input.tools);
  const skillLines = renderSkillLines(input.skills);

  return renderRoleGoalConstraintsTemplate({
    role: [
      `You are ${input.agentName}, acting as ${input.agentRole} in ${input.agentDepartment} at ${input.companyName}.`,
      `Your agent ID is: ${input.agentId}`
    ],
    responsibilities: [
      'Work on the assigned task described below using available tools.',
      'Update the task status (in_progress, review, done, blocked) as work progresses.',
      'Add task comments to document progress, decisions, and blockers.',
      'If you need approval before a sensitive action, use the approval.request tool.',
      'If you need information from your manager or Founder, use the inbox.send tool.',
      'Complete as much work as you can before stopping. Avoid unnecessary round-trips.',
      'Be precise and action-oriented. Document actions taken, not just plans.'
    ],
    capabilities: [
      '- You can read and update tasks, projects, and agents.',
      '- You can add comments to tasks to document progress.',
      '- You can send inbox messages to other agents or the Founder.',
      '- You can request approvals when needed.',
      '- You can read files and use skills as operating guides.',
      '- You cannot take actions outside the available tools.',
      '- You cannot invent facts or fabricate completed work.'
    ],
    tools: toolLines,
    skills: [
      '- Loaded skills are operating guides for this task, not optional references.',
      '- Before taking action, compare the current task against every loaded skill description.',
      '- If a skill matches, read that SKILL.md at the listed path with the file.read tool before planning.',
      '- Follow the matched skill workflow and constraints while completing the task.',
      ...skillLines
    ]
  });
}

function renderToolLines(tools: PromptToolDefinition[]): string[] {
  if (tools.length === 0) {
    return ['- No tools available.'];
  }

  return tools.map((tool) => {
    const params = tool.parameters
      .map((p) => `${p.name}${p.required ? '' : '?'}: ${p.type}`)
      .join(', ');
    return `- ${tool.name}(${params}): ${tool.description}`;
  });
}

function renderSkillLines(skills: PromptSkillDefinition[]): string[] {
  if (skills.length === 0) {
    return ['- No skills loaded for this agent.'];
  }

  return skills.map((s) => `- ${s.id} (${s.name}): ${s.description} Path => ${s.path}`);
}
