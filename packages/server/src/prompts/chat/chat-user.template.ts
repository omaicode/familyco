import { renderRoleGoalConstraintsTemplate } from '../prompt.pattern.js';
import type { ChatUserPromptInput } from '../prompt.types.js';

export function renderChatUserPrompt(input: ChatUserPromptInput): string {
  const historyLines = input.conversationHistory
    .map((entry) => {
      const speaker = entry.senderId === 'founder' ? 'Founder' : 'Executive agent';
      const title = entry.title ? `${entry.title}: ` : '';
      const body = compactText(entry.body, 240);
      return `- ${speaker}: ${title}${body}`;
    })
    .join('\n');

  return renderRoleGoalConstraintsTemplate({
    role: 'You are preparing the current planning turn based on founder conversation context.',
    goal: 'Analyze the latest founder message and produce the JSON response defined in the system prompt.',
    constraints: [
      'Do not force tool usage when a direct response is sufficient.',
      'Use recent conversation context when it helps disambiguate intent.',
      'Prioritize the latest founder message.',
      'Return JSON only.'
    ],
    context: [
      historyLines.length > 0 ? 'Recent conversation context:' : 'Recent conversation context: none',
      historyLines || '- No prior messages recorded.',
      '',
      'Latest founder message:',
      input.message
    ]
  });
}

function compactText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxLength - 1, 0)).trimEnd()}…`;
}
