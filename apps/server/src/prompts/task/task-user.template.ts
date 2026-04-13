export interface TaskUserPromptInput {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  taskStatus: string;
  taskPriority: string;
  assigneeAgentId: string | null;
  previousSessionSummary?: string;
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

  if (input.previousSessionSummary) {
    lines.push(
      '### Previous Session Summary',
      input.previousSessionSummary,
      ''
    );
  }

  if (input.taskComments && input.taskComments.length > 0) {
    lines.push('### Task Comments');
    for (const comment of input.taskComments) {
      lines.push(`**${comment.authorLabel ?? comment.authorId}** (${comment.createdAt}):`);
      lines.push(comment.body);
      lines.push('');
    }
  }

  lines.push(
    '---',
    '## Execution Protocol',
    '',
    'Follow this sequence strictly:',
    '',
    `**Step 1 — Mark in progress:** Call \`task.update-status\` with taskId=\`${input.taskId}\` and status=\`in_progress\` before doing any work.`,
    '',
    '**Step 2 — Do the work:** Use available tools to make real progress on the task. Read relevant files, update records, or produce required outputs.',
    '',
    `**Step 3 — Add a progress comment:** Call \`task.comment.add\` with taskId=\`${input.taskId}\` and authorId=\`${input.assigneeAgentId ?? 'agent'}\`. Write a clear comment describing what you did, any decisions made, and any blockers encountered.`,
    '',
    `**Step 4 — Set final status:** Call \`task.update-status\` with taskId=\`${input.taskId}\` and status set to one of:`,
    '  - `done` if the task is fully complete',
    '  - `blocked` if you cannot proceed (explain why in the comment)',
    '  - `review` if work is done but needs review',
    '  - `in_progress` if more sessions are needed',
    '',
    '**Step 5 — Final reply:** End with a plain-text summary of what was accomplished, what decisions were made, and what the next action is (if any).',
    '',
    '> Steps 1, 3, 4, and 5 are REQUIRED. Do not stop before completing all of them.'
  );

  return lines.join('\n');
}
