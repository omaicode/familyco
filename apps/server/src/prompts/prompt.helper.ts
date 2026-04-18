import { ChatSystemPromptInput } from "./prompt.types.js";

export function renderToolLines(input: ChatSystemPromptInput['tools']): string[] {
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

export function renderSkillLines(input: ChatSystemPromptInput['skills']): string[] {
  if (input.length === 0) {
    return ['- No skills loaded for this agent.'];
  }

  return input.map((skill) => `- ${skill.id} (${skill.name}): ${skill.description} Reference => ${skill.path}`);
}

export function renderHistoryLines(history: ChatSystemPromptInput['conversationHistory']): string[] {
  if (history.length === 0) {
    return ['- No prior messages recorded.'];
  }

  const lines: string[] = [];

  for (const entry of history) {
    const speaker = entry.senderId === 'founder' ? 'Founder' : 'Executive agent';
    const body = compactText(entry.body, 240);
    lines.push(`- ${speaker}: ${body}`);

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

export function compactText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(maxLength - 1, 0)).trimEnd()}…`;
}