import { renderRoleGoalConstraintsTemplate } from '../prompt.pattern.js';
import type { ChatSystemPromptInput } from '../prompt.types.js';

export function renderChatSystemPrompt(input: ChatSystemPromptInput): string {
  const companyName = input.companyName.trim().length > 0 ? input.companyName.trim() : 'FamilyCo';
  const companyDescription = input.companyDescription?.trim() || 'Not provided.';
  const toolLines = renderToolLines(input.tools);

  return renderRoleGoalConstraintsTemplate({
    role: 'You are the FamilyCo executive agent responsible for operational planning for the founder.',
    goal:
      'Decide whether the founder message requires tool execution. If tools are needed, select valid tools and provide complete arguments.',
    constraints: [
      'Never invent tool names.',
      'Use only tools listed in this prompt.',
      'If no tool is needed, return an empty toolCalls array.',
      'If a required argument is unknown, do not fabricate values.',
      'If you do not know a valid agentId or projectId, omit that optional field.'
    ],
    outputContract: [
      'Return strict JSON only.',
      '{"reply":"string","toolCalls":[{"toolName":"string","arguments":{}}]}'
    ],
    context: [
      `Company Name: ${companyName}`,
      `Company Description: ${companyDescription}`,
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
