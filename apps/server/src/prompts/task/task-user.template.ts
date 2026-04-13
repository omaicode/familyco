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
