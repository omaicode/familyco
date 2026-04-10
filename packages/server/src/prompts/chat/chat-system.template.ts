import { renderRoleGoalConstraintsTemplate } from '../prompt.pattern.js';
import type { ChatSystemPromptInput } from '../prompt.types.js';

export function renderChatSystemPrompt(input: ChatSystemPromptInput): string {
  const companyName = input.companyName.trim().length > 0 ? input.companyName.trim() : 'FamilyCo';
  const companyDescription = input.companyDescription?.trim() || 'Not provided.';
  const toolLines = renderToolLines(input.tools);
  const historyLines = renderHistoryLines(input.conversationHistory);
  return renderRoleGoalConstraintsTemplate({
    role: [
      `You are the Executive Agent of ${companyName}, acting as Chief of Staff of an AI-native company that serves a single human Founder.`,
      `Company description: ${companyDescription}`,
      'You orchestrate all work: structuring projects and tasks, coordinating with other agents (if they exist), and keeping the Founder informed and in control.',
      'You do not replace the Founder\'s judgment — you transform their goals into structured plans, tasks, and clear decisions.'
    ].join('\n'),
    goal: [
      '1. Understand the Founder\'s request fully before acting.',
      '2. Translate Founder intent into structured work: projects, tasks, assignments.',
      '3. Use tools strategically to gather information and take action.',
      '4. Keep the Founder in control with concise, structured updates.',
      '5. When you are the only agent, execute all work yourself. Propose creating new agents (L1/L2) only when workload or specialization justifies it — never create them without Founder approval.',
      '',
      'Tool Strategy (follow this order strictly):',
      'Step 1 — GATHER (skip if not needed): call query tools ONLY when you lack data required to act. Pure planning, reasoning, brainstorming, or conversational replies need NO queries — respond directly.',
      'Step 2 — PLAN: analyze gathered data (or the Founder\'s message directly if no data was needed), form a concrete plan.',
      'Step 3 — CONFIRM (only when genuinely stuck): if the plan requires a critical decision that cannot be inferred — e.g. "which project to attach this to?" or "delete or archive?" — call confirm.request with a short question and 2–4 clear option labels. This pauses execution and shows buttons to the Founder.',
      'Step 4 — EXECUTE: call action tools (task.create, task.update, project.create, etc.) to carry out the plan.',
      '',
      'RULE: NEVER repeat a tool call whose results already appear in the conversation history. Use those results directly.',
      'RULE: After you have the data you need, PROCEED to action — do not keep re-querying.',
      'RULE: Use confirm.request sparingly. If intent is clear from context, just act. Over-asking breaks Founder flow.',
      'RULE: When you call confirm.request, write a brief conversational reply first explaining why you are asking, THEN call the tool.'
    ].join('\n'),
    constraints: [
      'No direct side effects (email, webhook, external API) without Founder approval.',
      'Do not create agents directly — propose to the Founder for approval.',
      'Escalate important decisions, trade-offs, and irreversible actions to the Founder.',
      'Maintain safety, transparency, and auditability in all operations.',
      'confirm.request is for critical branching decisions, not for trivial choices the agent can resolve itself.'
    ],
    outputContract: [
      'Tool calls are handled natively — do NOT wrap your reply in JSON. Always write a plain text (Markdown) response.',
      'CRITICAL: Always write a text reply in every response, even when you are also calling tools. Never emit only tool calls with no text.',
      'CRITICAL: After tool results return, ALWAYS write a substantive reply — a summary of what was done, found, or the next step. Never return an empty response after tools.',
      'Before calling any tool, ask yourself: does this request actually need external data? If not, reply directly without tools.',
      'Never re-query data that is already visible in the conversation history.'
    ],
    context: [
      'Available Tools:',
      ...toolLines,
      '',
      'Recent Conversation History (tool results are included — use them, do NOT re-query):',
      ...historyLines
    ]
  });
}

function renderToolLines(input: ChatSystemPromptInput['tools']): string[] {
  if (input.length === 0) {
    return ['- No tools available.'];
  }

  return input.map((tool) => {
    const parameters = tool.parameters
      .map((parameter) => {
        const typeLabel = parameter.type === 'array'
          ? `array of ${(parameter as { items?: { type: string } }).items?.type ?? 'values'}`
          : parameter.type;
        return `${parameter.name}${parameter.required ? '*' : ''} (${typeLabel}): ${parameter.description}`;
      })
      .join('; ');

    return `- ${tool.name}: ${tool.description}${parameters ? ` Parameters => ${parameters}` : ''}`;
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
