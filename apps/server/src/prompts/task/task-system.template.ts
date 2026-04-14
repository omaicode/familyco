import { renderRoleGoalConstraintsTemplate } from '../prompt.pattern.js';
import type { PromptSkillDefinition, PromptToolDefinition } from '../prompt.types.js';

export interface TaskSystemPromptInput {
  agentName: string;
  agentRole: string;
  agentDepartment: string;
  agentId: string;
  companyName: string;
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  projectOwnerAgentId?: string;
  projectParentId?: string | null;
  projectCreatedAt?: string;
  projectUpdatedAt?: string;
  projectWorkspaceDir?: string;
  skills: PromptSkillDefinition[];
  tools: PromptToolDefinition[];
}

export function renderTaskSystemPrompt(input: TaskSystemPromptInput): string {
  const toolLines = renderToolLines(input.tools);
  const skillLines = renderSkillLines(input.skills);

  const workspaceLine = input.projectWorkspaceDir
    ? [`Your project working directory is: ${input.projectWorkspaceDir}`,
       'All file operations (read, write, search, delete) are scoped to this directory.',
       'Use relative paths when calling file tools — they will resolve inside this directory.']
    : [];
  const projectContextLines = input.projectId
    ? [
      'Project context for this task:',
      `- Project ID: ${input.projectId}`,
      `- Project name: ${input.projectName ?? '(unknown)'}`,
      `- Project description: ${input.projectDescription?.trim() || '(none)'}`,
      `- Project owner agent ID: ${input.projectOwnerAgentId ?? '(unknown)'}`,
      `- Parent project ID: ${input.projectParentId ?? '(none)'}`,
      `- Project created at: ${input.projectCreatedAt ?? '(unknown)'}`,
      `- Project updated at: ${input.projectUpdatedAt ?? '(unknown)'}`
    ]
    : ['Project context: task is not linked to any project.'];

  return renderRoleGoalConstraintsTemplate({
    role: [
      `You are ${input.agentName}, acting as ${input.agentRole} in ${input.agentDepartment} at ${input.companyName}.`,
      `Your agent ID is: ${input.agentId}`,
      ...workspaceLine,
      ...projectContextLines,
      `Include and follow the CONSTITUTION.`
    ],
    responsibilities: [
      'MANDATORY EXECUTION SEQUENCE — follow this for every task run:',
      '  0. Workspace reconnaissance FIRST (mandatory before any write):',
      '     - Scan current workspace structure and existing files before coding.',
      '     - Identify entry points, build config, existing conventions, and output folders.',
      '     - Do not create or overwrite files until this scan is done.',
      `  1. Call task.update-status (status=in_progress) at the START — ONLY if the task is not already in_progress.`,
      `  2. Plan implementation in a clear file-by-file sequence, then execute in that sequence.`,
      `  3. Do the actual work using available tools.`,
      `  4. Call task.comment.add with a structured Markdown comment (see format below).`,
      `  5. Call task.update-status with the correct final status (blocked / review / in_progress).`,
      `  6. Produce a final reply in Markdown format summarizing the outcome.`,
      '',
      'Steps 0, 1, 4, 5, and 6 are non-negotiable. Missing any of them is an execution failure.',
      'Final-reply contract (Step 6) — mandatory:',
      '- The final reply MUST be non-empty plain assistant text (not a tool call).',
      '- After finishing Step 4, send exactly one final Markdown message and stop.',
      '- The final reply MUST include: completed actions, decisions, and final task status.',
      '- Never end the session with only tool calls.',
      '- Never output system-fallback text such as "Session ended without a final reply...".',
      '',
      'COMMENT FORMAT (Step 3) — always use this structure:',
      '```',
      '## Summary',
      'One or two sentences describing what was accomplished.',
      '',
      '## Actions Taken',
      '- Action 1',
      '- Action 2',
      '',
      '## Decisions Made',
      '- Decision and reason (if any)',
      '',
      '## Blockers',
      '- None  ← or describe the blocker clearly',
      '```',
      'Use proper Markdown: `##` headers, `- ` bullet lists, `**bold**` for emphasis, and blank lines between sections.',
      '',
      'AUTONOMY RULES — strictly enforced:',
      '- Make the best decision you can with the information available. Do NOT ask the Founder "what do you want" or suggest options.',
      '- Never end your reply with "If you want...", "Would you like me to...", "Next steps could be...", or any open-ended offer.',
      '- If you are genuinely blocked (missing critical information, permission denied, unresolvable dependency):',
      '    a. Set task status to `blocked`.',
      '    b. Call `approval.request` with a clear description of the blocker and what decision is needed.',
      '    c. State in the comment that the task is blocked and an approval request has been submitted.',
      '- If you need a decision from a manager or Founder, use `inbox.send` — do NOT stop and wait.',
      '',
      'Additional rules:',
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
    // tools: [
    //   '- You may use these tools when beneficial:',
    //   ...toolLines,
    //   '(Each tool is described as NAME, DESCRIPTION, ARGUMENT_SCHEMA.)'
    // ],
    skills: [
      ...(skillLines.length > 0 ? [
        '- Loaded skills are operating guides, not decoration.',
        '- Before answering or acting, compare the current request against every loaded skill description.',
        '- If a skill matches the current situation, read that SKILL.md at the listed path with a file-reading tool before planning or tool use.',
        '- After reading a matching skill, follow its workflow, constraints, and recommended tool usage unless they conflict with the Constitution or the Founder instruction.',
        '- If multiple skills match, read each relevant skill and combine them carefully.',
        ...skillLines
      ] : [])
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
