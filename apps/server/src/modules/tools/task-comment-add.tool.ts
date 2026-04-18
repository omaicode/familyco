import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, asTextString } from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const taskCommentAddSlashSpec: SlashCommandSpec = {
  command: '/task-comment',
  label: 'Add a task comment',
  description: 'Add a progress comment, question, or blocker note to a specific task.',
  insertValue: '/task-comment ',
  levels: ['L0', 'L1', 'L2'],
  auditAction: 'agent.chat.task-comment',
  buildArguments: (args) => ({ body: args })
};

export const taskCommentAddTool: ServerToolDefinition = {
  name: 'task.comment.add',
  slashSpec: taskCommentAddSlashSpec,
  description: 'Add a comment to a task. Use this to report progress, ask questions, or document blockers.',
  parameters: [
    {
      name: 'taskId',
      type: 'string',
      required: true,
      description: 'The ID of the task to comment on.'
    },
    {
      name: 'body',
      type: 'string',
      required: true,
      description: 'The comment text to add to the task.'
    },
    {
      name: 'authorId',
      type: 'string',
      required: true,
      description: 'The agent or user ID making the comment.'
    },
    {
      name: 'authorLabel',
      type: 'string',
      required: false,
      description: 'Display name for the comment author.'
    }
  ],

  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    const taskId = asNonEmptyString(argumentsMap.taskId);
    const body = asTextString(argumentsMap.body);
    const authorId = asNonEmptyString(argumentsMap.authorId);
    const authorLabel = asNonEmptyString(argumentsMap.authorLabel);

    if (!taskId) {
      return { ok: false, toolName: 'task.comment.add', error: { code: 'MISSING_TASK_ID', message: 'taskId is required' } };
    }

    if (!body) {
      return { ok: false, toolName: 'task.comment.add', error: { code: 'MISSING_BODY', message: 'body is required' } };
    }

    if (!authorId) {
      return { ok: false, toolName: 'task.comment.add', error: { code: 'MISSING_AUTHOR_ID', message: 'authorId is required' } };
    }

    if (!context.taskService) {
      return { ok: false, toolName: 'task.comment.add', error: { code: 'SERVICE_UNAVAILABLE', message: 'taskService is not configured' } };
    }

    await context.taskService.getTask(taskId);

    if (!context.auditService) {
      return { ok: false, toolName: 'task.comment.add', error: { code: 'SERVICE_UNAVAILABLE', message: 'auditService is not configured' } };
    }

    const record = await context.auditService.write({
      actorId: authorId,
      action: 'task.comment.added',
      targetId: taskId,
      payload: {
        body,
        authorType: 'agent',
        authorLabel: authorLabel ?? authorId
      }
    });

    context.eventBus?.emit('task.comment.added', {
      taskId,
      authorId,
      authorType: 'agent',
      authorLabel: authorLabel ?? authorId,
      body,
      commentId: record.id
    });

    return {
      ok: true,
      toolName: 'task.comment.add',
      output: {
        id: record.id,
        taskId,
        body,
        authorId,
        createdAt: record.createdAt.toISOString()
      }
    };
  }
};
