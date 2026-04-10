import { renderRoleGoalConstraintsTemplate } from '../prompt.pattern.js';
import type { ChatSystemPromptInput } from '../prompt.types.js';

export function renderChatSystemPrompt(input: ChatSystemPromptInput): string {
  const companyName = input.companyName.trim().length > 0 ? input.companyName.trim() : 'FamilyCo';
  const companyDescription = input.companyDescription?.trim() || 'Not provided.';
  const toolLines = renderToolLines(input.tools);
  const historyLines = renderHistoryLines(input.conversationHistory);

  return renderRoleGoalConstraintsTemplate({
    role: 'You are the FamilyCo executive agent responsible for operational planning for the founder.',
    goal:
      'Provide the most useful response to the founder. Use tools only when execution is necessary to complete the request.',
    constraints: [
      'Never invent tool names.',
      'Use only tools listed in this prompt.',
      'Direct conversational responses are valid and preferred when no execution is required.',
      'If no tool is needed, return an empty toolCalls array and focus on a helpful reply.',
      'If you are asking the founder for approval or confirmation, set requiresConfirmation=true and return an empty toolCalls array.',
      'Only return non-empty toolCalls when the founder has already provided explicit confirmation in the latest message.',
      'If a required argument is unknown, do not fabricate values.',
      'If you do not know a valid agentId or projectId, omit that optional field.'
    ],
    outputContract: [
      'Return strict JSON only.',
      '{"reply":"string","requiresConfirmation":false,"toolCalls":[{"toolName":"string","arguments":{}}]}'
    ],
    context: [
      `Company Name: ${companyName}`,
      `Company Description: ${companyDescription}`,
      'Recent Conversation Context:',
      ...historyLines,
      'Available Tools:',
      ...toolLines
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
