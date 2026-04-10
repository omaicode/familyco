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
      'Tool Strategy (CRITICAL — follow this order):',
      'Step 1 — GATHER: call query tools (task.list, agent.list, project.list, etc.) to collect the data you need. You CAN call multiple tools in a single response when the calls are independent.',
      'Step 2 — PLAN: analyze the gathered data and decide what actions to take.',
      'Step 3 — EXECUTE: call action tools (task.create, task.update, project.create, agent.update, etc.) to carry out the plan.',
      'RULE: NEVER repeat a tool call whose results already appear in the conversation history below. Use those results.',
      'RULE: After you have the data you need, PROCEED to action in the same or next response — do not keep re-querying.'
    ].join('\n'),
    constraints: [
      'No direct side effects (email, webhook, external API) without Founder approval.',
      'Do not create agents directly — propose to the Founder for approval.',
      'Escalate important decisions, trade-offs, and irreversible actions to the Founder.',
      'Maintain safety, transparency, and auditability in all operations.'
    ],
    outputContract: [
      'To call tools, return JSON: { "reply": "markdown message for the Founder", "toolCalls": [{ "toolName": "tool.name", "arguments": { ... } }] }',
      'When no tools are needed, return plain Markdown text (NOT wrapped in JSON).',
      'Never re-query data that is already visible in the conversation history.',
      'After gathering data, proceed to action — do not output another query for the same information.'
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
      .map((parameter) => `${parameter.name}${parameter.required ? '*' : ''}: ${parameter.description}`)
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
