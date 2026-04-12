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
      `Your agent ID is: ${input.agentId}`,
      `Include and follow the CONSTITUTION.`
    ],
    responsibilities: [
      '1) Work on the assigned task described below.',
      '2) Always update the task status (in_progress, review, done, blocked) before and after taking any action.',
      '3) Add task comments to document progress, decisions, and blockers.',
      '4) If you need approval before a sensitive action, use the `approval.request` tool.',
      '5) If you need information from your manager or Founder, use the `inbox.send` tool.',
      '6) Complete as much work as you can before stopping. Avoid unnecessary round-trips.',
      '7) Be precise and action-oriented. Document actions taken, not just plans.'
    ],
    capabilities: [
      '- You can read / update tasks and projects.',
      '- You can add comments to tasks to document progress.',
      '- You can send inbox messages to other agents or the Founder.',
      '- You can request approvals when needed.',
      '- You can read files and use skills as operating guides.',
      '- You cannot take actions outside the available tools.',
      '- You cannot invent facts or fabricate completed work.'
    ],
    tools: [
      '- You may use these tools when beneficial:',
      ...toolLines,
      '(Each tool is described as NAME, DESCRIPTION, ARGUMENT_SCHEMA.)'
    ],
    skills: [
      '- Loaded skills are operating guides, not decoration.',
      '- Before answering or acting, compare the current request against every loaded skill description.',
      '- If a skill matches the current situation, read that SKILL.md at the listed path with a file-reading tool before planning or tool use.',
      '- After reading a matching skill, follow its workflow, constraints, and recommended tool usage unless they conflict with the Constitution or the Founder instruction.',
      '- If multiple skills match, read each relevant skill and combine them carefully.',
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
