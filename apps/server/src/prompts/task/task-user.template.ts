export interface TaskSessionToolResult {
  toolName: string;
  ok: boolean;
  output?: string;
  error?: string;
}

export interface TaskUserPromptInput {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  taskStatus: string;
  taskPriority: string;
  dependsOnTaskIds?: string[];
  readinessRules?: Array<{
    type: string;
    taskId: string;
    status: string;
    description?: string;
  }>;
  readiness?: {
    ready: boolean;
    blockers: Array<{ code: string; message: string }>;
  };
  assigneeAgentId: string | null;
  previousSessionSummary?: string;
  previousToolResults?: TaskSessionToolResult[];
  taskComments?: Array<{
    authorId: string;
    authorLabel?: string;
    body: string;
    createdAt: string;
  }>;
}

export function renderTaskUserPrompt(input: TaskUserPromptInput): string {
  const lines: string[] = [
    `## Task: ${input.taskTitle}`,
    '',
    `**ID:** \`${input.taskId}\``,
    `**Status:** ${input.taskStatus}`,
    `**Priority:** ${input.taskPriority}`,
    '',
    '### Description',
    input.taskDescription || '(no description)',
    ''
  ];

  lines.push('### Dependencies');
  if (input.dependsOnTaskIds && input.dependsOnTaskIds.length > 0) {
    for (const dependencyId of input.dependsOnTaskIds) {
      lines.push(`- ${dependencyId}`);
    }
  } else {
    lines.push('- None');
  }
  lines.push('');

  lines.push('### Readiness Rules');
  if (input.readinessRules && input.readinessRules.length > 0) {
    for (const rule of input.readinessRules) {
      const suffix = rule.description ? ` — ${rule.description}` : '';
      lines.push(`- ${rule.type}: task ${rule.taskId} must be ${rule.status}${suffix}`);
    }
  } else {
    lines.push('- None');
  }
  lines.push('');

  lines.push('### Current Readiness');
  if (input.readiness?.ready) {
    lines.push('- Ready to execute now.');
  } else if (input.readiness && input.readiness.blockers.length > 0) {
    for (const blocker of input.readiness.blockers) {
      lines.push(`- ${blocker.message}`);
    }
  } else {
    lines.push('- No readiness evaluation available.');
  }
  lines.push('');

  if (input.previousSessionSummary) {
    lines.push(
      '### Previous Session Summary',
      input.previousSessionSummary,
      ''
    );
  }

  if (input.previousToolResults && input.previousToolResults.length > 0) {
    lines.push('### Previous Tool Execution Results');
    lines.push('These are the results from the last session. Use them to avoid repeating work and to understand what was already done.');
    lines.push('');
    for (const result of input.previousToolResults) {
      const statusIcon = result.ok ? '✅' : '❌';
      lines.push(`${statusIcon} **${result.toolName}**`);
      if (result.ok && result.output) {
        lines.push(`> ${result.output.replace(/\n/g, '\n> ')}`);
      } else if (!result.ok && result.error) {
        lines.push(`> Error: ${result.error}`);
      }
      lines.push('');
    }
  }

  if (input.taskComments && input.taskComments.length > 0) {
    lines.push('### Task Comments');
    for (const comment of input.taskComments) {
      lines.push(`**${comment.authorLabel ?? comment.authorId}** (${comment.createdAt}):`);
      lines.push(comment.body);
      lines.push('');
    }
  }

  const alreadyInProgress = input.taskStatus === 'in_progress';

  lines.push(
    '---',
    '## Execution Protocol',
    '',
    'Follow this sequence strictly:',
    '',
    alreadyInProgress
      ? `**Step 1 — Already in progress:** Task status is already \`in_progress\`. Skip this step — do NOT call \`task.update-status\` again with \`in_progress\`.`
      : `**Step 1 — Mark in progress:** Call \`task.update-status\` with taskId=\`${input.taskId}\` and status=\`in_progress\` before doing any work.`,
    '',
    '**Step 2 — Do the work:** Use available tools to make real progress on the task. Read relevant files, update records, or produce required outputs.',
    '  - Before making irreversible progress, respect the dependency and readiness context above.',
    '',
    `**Step 3 — Add a progress comment:** Call \`task.comment.add\` with taskId=\`${input.taskId}\` and authorId=\`${input.assigneeAgentId ?? 'agent'}\`. The comment body MUST use structured Markdown: a \`## Summary\` section, a \`## Actions Taken\` bullet list, a \`## Decisions Made\` bullet list, and a \`## Blockers\` section. Use blank lines between sections. Do not write a single wall of text.`,
    '',
    `**Step 4 — Set final status:** Call \`task.update-status\` with taskId=\`${input.taskId}\` and status set to one of:`,
    '  - `done` if the task is fully complete',
    '  - `blocked` if you cannot proceed — you MUST also call `approval.request` explaining the blocker and what decision is needed from the Founder',
    '  - `review` if work is done but needs review',
    '  - `in_progress` if more sessions are needed',
    '',
    '**Step 5 — Final reply:** Write a Markdown summary of: what was accomplished, what decisions were made, and the final status. Use bullet points and headers for readability.',
    '  - The final reply MUST be a non-empty assistant message after all tool calls are complete.',
    '  - Send exactly one final reply, then stop (no additional tool calls after it).',
    '  - Do NOT suggest next steps or offer options with "If you want..." or "Would you like...".',
    '  - Do NOT ask the Founder questions — if you need a decision, use `approval.request` or `inbox.send` instead.',
    '  - If blocked, state clearly what the blocker is and that an approval request has been submitted.',
    '',
    '> Steps 1, 3, 4, and 5 are REQUIRED. Do not stop before completing all of them.'
  );

  return lines.join('\n');
}
