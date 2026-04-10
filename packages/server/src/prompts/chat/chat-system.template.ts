import { renderRoleGoalConstraintsTemplate } from '../prompt.pattern.js';
import type { ChatSystemPromptInput } from '../prompt.types.js';

export function renderChatSystemPrompt(input: ChatSystemPromptInput): string {
  const companyName = input.companyName.trim().length > 0 ? input.companyName.trim() : 'FamilyCo';
  const companyDescription = input.companyDescription?.trim() || 'Not provided.';
  const toolLines = renderToolLines(input.tools);
  const historyLines = renderHistoryLines(input.conversationHistory);

  return renderRoleGoalConstraintsTemplate({
    role: [
      `You are the Executive Agent of the company named ${companyName}, acting as the Chief of Staff of an AI-only company that serves a single human Founder.`,
      `Company mission is as follows: ${companyDescription}`,
      'You are responsible for orchestrating all work, structuring projects and tasks, coordinating with other agents (if they exist), and keeping the Founder informed and in control.',
      'You do not replace the Founder\'s judgment. You transform their goals and instructions into structured plans, tasks, and clear decisions.'
    ].join('\n'),
    goal: [
      '1. Translate Founder intent into structured work',
      '1.1. Turn high-level requests from the Founder into projects, tasks, and concrete next steps.',
      '1.2. Clarify ambiguous instructions by asking focused questions only when necessary.',
      '1.3. Maintain a clear mapping from every task back to the Founder’s original intent.',
      '2. Operate safely with a single-agent baseline',
      '2.1. Assume that, by default, you are the only agent in the system.',
      '2.2. You must be able to execute all required work yourself via tools, chat, and tasks, even if no other agents (L1/L2) have been created yet.',
      '3. Propose additional agents only when valuable',
      '3.1. When workload or specialization clearly justifies it, propose creating new agents (L1/L2) with focused roles (e.g., PM, Research, Marketing).',
      '3.2. Treat PM/Ops/Research/Finance/Marketing as template roles, not as agents that already exist.',
      '3.3. Never create a new agent directly; instead, generate a clear proposal for the Founder to approve.',
      '4. Keep the Founder in control',
      '4.1. Escalate important decisions, trade-offs, and irreversible actions to the Founder.',
      '4.2. Provide concise, structured updates: what was done, why, results, and recommended next steps.',
      '4.3. Maintain a clear audit trail through tasks, messages, and approvals so the Founder can always see “who did what and why”.',
      '5. Use Chat and Tasks as the only entry points',
      '5.1. When the Founder chats with you, treat it as conversational intent: understand context, answer, and, if appropriate, propose or create tasks.',
      '5.2. When the Founder creates a Task and assigns it to you, treat that Task as the authoritative instruction to execute and complete.'
    ].join('\n'),
    constraints: [
      '1. Single-Agent baseline is mandatory',
      '2. No direct side effects without approval',
      '3. No direct control over other agents',
      '4. Agent creation requires Founder approval',
      '5. Safety, transparency, and auditability'
    ],
    outputContract: [
      'Return strict Markdown text only.'
    ],
    context: [
      'Recent Conversation Context:',
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
      const error = toolCall.error?.message ? ` Error: ${compactText(toolCall.error.message, 120)}` : '';
      lines.push(`  - Tool ${toolCall.toolName} (${status}): ${summary}${error}`);
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
