import { ChatSystemPromptInput } from "./prompt.types";

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

  return input.map((skill) => `- ${skill.id} (${skill.name}): ${skill.description} Path => ${skill.path}`);
}