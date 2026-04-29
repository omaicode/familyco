import { renderHistoryLines, renderSkillLines, renderToolLines } from '../prompt.helper.js';
import { renderRoleGoalConstraintsTemplate } from '../prompt.pattern.js';
import type { ChatSystemPromptInput } from '../prompt.types.js';

export function renderCronSystemPrompt(input: ChatSystemPromptInput): string {
  const companyName = input.companyName.trim().length > 0 ? input.companyName.trim() : 'FamilyCo';
  const companyDescription = input.companyDescription?.trim() || 'Not provided.';
  const toolLines = renderToolLines(input.tools);
  const skillLines = renderSkillLines(input.skills);
  const historyLines = renderHistoryLines(input.conversationHistory);

  return renderRoleGoalConstraintsTemplate({
    role: [
      `You are the Chief Agent of ${companyName} company serving the Founder.`,
      `Company description: ${companyDescription}`,
      'This run is triggered by a CRON schedule. Execute the scheduled request directly.',
      'Include and follow the CONSTITUTION.'
    ],
    responsibilities: [
      '1) Execute the scheduled request in this run and return the result.',
      '2) Keep responses concise, factual, and operational.',
      '3) Use tools only when needed to complete the scheduled task.',
      '4) Preserve continuity within the existing chat session context.'
    ],
    capabilities: [
      '- You can call TOOLS that are explicitly listed in the TOOLS section.',
      '- This is an execution run, not a scheduling/planning turn.',
      '- Do NOT create or update cron jobs in cron-triggered runs.',
      '- You cannot bypass company policies defined in the constitution.',
      '',
      'Response style for cron runs:',
      '- Prioritize final outcome over planning commentary.',
      '- Include errors clearly if execution fails.',
      '- Keep language aligned with the original scheduled request.'
    ],
    tools: [
      '- You may use these tools when beneficial:',
      ...toolLines,
      '(Each tool is described as NAME, DESCRIPTION, ARGUMENT_SCHEMA.)'
    ],
    skills: [
      '- Loaded skills are operating guides, not decoration.',
      '- Before acting, compare the scheduled request against loaded skill descriptions.',
      '- If a skill matches, call tool skill.read with that skill id BEFORE tool execution.',
      '- After reading skill.read output, follow its workflow and constraints unless they conflict with the Constitution.',
      ...skillLines
    ],
    context: [
      'Recent Conversation History (tool results are included — use them, do NOT re-query):',
      ...historyLines,
      ...((input.conversationSummary && input.conversationSummary.trim().length > 0) ? ['', `Conversation Summary: ${input.conversationSummary}`] : [])
    ]
  });
}
