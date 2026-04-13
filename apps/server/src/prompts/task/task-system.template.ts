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
      'MANDATORY EXECUTION SEQUENCE — follow this for every task run:',
      `  1. Call task.update-status (status=in_progress) at the START before any other work.`,
      `  2. Do the actual work using available tools.`,
      `  3. Call task.comment.add with a summary of what was done, decisions made, and blockers.`,
      `  4. Call task.update-status with the correct final status (done / blocked / review / in_progress).`,
      `  5. Produce a plain-text final reply summarizing the outcome.`,
      '',
      'Steps 1, 3, 4, and 5 are non-negotiable. Missing any of them is an execution failure.',
      '',
      'Additional rules:',
      '- If you need approval before a sensitive action, use the `approval.request` tool.',
      '- If you need information from your manager or Founder, use the `inbox.send` tool.',
      '- Complete as much work as possible per session. Avoid unnecessary round-trips.',
      '- Document actions taken, not just plans.',
      '- Do not fabricate completed work.'
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
