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
    `**ID:** ${input.taskId}`,
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
    'Work on this task now. Use the available tools to make progress.',
    'When complete or blocked, update the task status and add a comment explaining what was done or what is needed.'
  );

  return lines.join('\n');
}
