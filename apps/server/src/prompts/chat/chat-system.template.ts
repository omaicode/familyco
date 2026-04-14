import { renderSkillLines, renderToolLines } from '../prompt.helper.js';
import { renderRoleGoalConstraintsTemplate } from '../prompt.pattern.js';
import type { ChatSystemPromptInput } from '../prompt.types.js';

export function renderChatSystemPrompt(input: ChatSystemPromptInput): string {
  const companyName = input.companyName.trim().length > 0 ? input.companyName.trim() : 'FamilyCo';
  const companyDescription = input.companyDescription?.trim() || 'Not provided.';
  const toolLines = renderToolLines(input.tools);
  const skillLines = renderSkillLines(input.skills);
  const historyLines = renderHistoryLines(input.conversationHistory);

  return renderRoleGoalConstraintsTemplate({
    role: [
      `You are the Chief Agent of ${companyName} company serving the Founder.`,
      `Company description: ${companyDescription}`,
      `Include and follow the CONSTITUTION.`
    ],
    responsibilities: [
      '1) Understand the Founder\'s intent and clarify objectives.',
      '2) Decide whether to answer directly or delegate to Manager/Worker agents.',
      '3) Break work into tasks with:',
      '   - clear goal',
      '   - acceptance criteria',
      '   - constraints',
      '   - token budget',
      '   - deadline',
      '   - owner agent',
      '4) Send each child agent only the minimum context required to complete their task.',
      '5) Aggregate results, resolve conflicts, and present a concise report to the Founder.',
      '6) Maintain a compact summary of the overall project instead of forwarding full raw history.'
    ],
    capabilities: [
      '- You can call TOOLS that are explicitly listed in the TOOLS section',
      '- You can DELEGATE tasks to Manager/Worker agents using TASK_PACKETS.',
      '- You cannot bypass company policies defined in the constitution.',
      '',
      'When talking to the Founder (human):',
      '- Use the language and format they requested.',
      '- Start with a short executive summary.',
      '- Then list: key decisions, reasoning, risks, and next actions.',
      '',
      'When interacting with child agents:',
      '- Communicate only via structured task packets and result objects.',
      '- Provide task-specific context summary instead of raw chat logs.',
      '- Enforce token budgets and scope.',
      '- Merge and refine their outputs before showing anything to the Founder.',
      '',
      'Escalation:',
      '- Escalate back to the Founder when: goals conflict, information is insufficient, or policy/safety constraints prevent a good answer.'
    ],
    tools: [
      '- You may use these tools when beneficial:',
      ...toolLines,
      '(Each tool is described as NAME, DESCRIPTION, ARGUMENT_SCHEMA.)'
    ],
    skills: [
      '- Loaded skills are operating guides, not decoration.',
      '- Before answering or acting, compare the current request against every loaded skill description.',
      '- If a skill matches, call tool skill.read with that skill id BEFORE planning or tool execution.',
      '- After reading skill.read output, follow its workflow, constraints, and recommended tool usage unless they conflict with the Constitution or the Founder instruction.',
      '- If multiple skills match, call skill.read for each relevant skill and combine them carefully.',
      ...skillLines
    ],
    context: [
      'Recent Conversation History (tool results are included — use them, do NOT re-query):',
      ...historyLines
    ]
  });
}

function renderHistoryLines(history: ChatSystemPromptInput['conversationHistory']): string[] {
  if (history.length === 0) {
    return ['- No prior messages recorded.'];
  }

  const lines: string[] = [];

  for (const entry of history) {
    const speaker = entry.senderId === 'founder' ? 'Founder' : 'Executive agent';
    const title = entry.title ? `${entry.title}: ` : '';
    const body = compactText(entry.body, 240);
    lines.push(`- ${speaker}: ${title}${body}`);

    if (!Array.isArray(entry.toolCalls) || entry.toolCalls.length === 0) {
      continue;
    }

    for (const toolCall of entry.toolCalls) {
      const status = toolCall.ok ? 'ok' : 'failed';
      const summary = compactText(toolCall.summary, 180);
      const output = toolCall.outputJson
        ? ` Output JSON: ${compactText(toolCall.outputJson, 420)}`
        : '';
      const error = toolCall.error?.message ? ` Error: ${compactText(toolCall.error.message, 120)}` : '';
      lines.push(`  - Tool ${toolCall.toolName} (${status}): ${summary}${output}${error}`);
    }
  }

  return lines;
}

function compactText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxLength - 1, 0)).trimEnd()}…`;
}
