interface PromptTemplateInput {
  role: string;
  goal: string;
  constraints: string[];
  outputContract?: string[];
  context?: string[];
}

export function renderRoleGoalConstraintsTemplate(input: PromptTemplateInput): string {
  const sections: string[] = [
    'Role:',
    input.role,
    '',
    'Goal:',
    input.goal,
    '',
    'Constraints:',
    ...input.constraints.map((constraint) => `- ${constraint}`)
  ];

  if (input.outputContract && input.outputContract.length > 0) {
    sections.push('', 'Output Contract:', ...input.outputContract.map((item) => `- ${item}`));
  }

  if (input.context && input.context.length > 0) {
    sections.push('', 'Context:', ...input.context);
  }

  return sections.join('\n');
}
