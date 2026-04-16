import { getConstitutionPrompt } from "./base/consitution.js";

interface PromptTemplateInput {
  role: string[];
  responsibilities?: string[];
  capabilities: string[];
  tools?: string[];
  skills?: string[];
  context?: string[];
}

export function renderRoleGoalConstraintsTemplate(input: PromptTemplateInput): string {
  const sections: string[] = [
    'Constitution',
    ...getConstitutionPrompt(),
    '',
    'Role:',
    ...(input.role || []),
    '',
    'Responsibilities:',
    ...(input.responsibilities || []),
    '',
    'Capabilities and limitations:',
    ...input.capabilities,
    '',
    ...(input.tools && input.tools.length > 0 ? ['TOOLS:', ...input.tools] : []),
    '',
    ...(input.skills && input.skills.length > 0 ? ['Skills:', ...input.skills] : [])
  ];

  if (input.context && input.context.length > 0) {
    sections.push('', 'Context:', ...input.context);
  }

  return sections.join('\n');
}
