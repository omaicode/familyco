import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString } from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const inboxSendSlashSpec: SlashCommandSpec = {
  command: '/inbox-send',
  label: 'Send inbox message',
  description: 'Send a message to another agent or the Founder to escalate blockers or request information.',
  insertValue: '/inbox-send ',
  levels: ['L0', 'L1', 'L2'],
  auditAction: 'agent.chat.inbox-send',
  buildArguments: (args) => ({ body: args })
};

export const inboxSendTool: ServerToolDefinition = {
  name: 'inbox.send',
  slashSpec: inboxSendSlashSpec,
  description: 'Send an inbox message to another agent or the Founder. Use this to escalate blockers, request information, or notify parent agents of task status.',
  parameters: [
    {
      name: 'recipientId',
      type: 'string',
      required: true,
      description: 'The ID of the recipient (agent ID or "founder").'
    },
    {
      name: 'senderId',
      type: 'string',
      required: true,
      description: 'The ID of the sender (your agent ID).'
    },
    {
      name: 'title',
      type: 'string',
      required: true,
      description: 'Short title for the message.'
    },
    {
      name: 'body',
      type: 'string',
      required: true,
      description: 'Full message body. Include the task link or context if relevant.'
    },
    {
      name: 'type',
      type: 'string',
      required: false,
      description: 'Message type: "info" (default), "alert", "report", or "approval".'
    },
    {
      name: 'taskId',
      type: 'string',
      required: false,
      description: 'Optional task ID this message relates to. Included in message payload.'
    }
  ],

  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    const recipientId = asNonEmptyString(argumentsMap.recipientId);
    const senderId = asNonEmptyString(argumentsMap.senderId);
    const title = asNonEmptyString(argumentsMap.title);
    const body = asNonEmptyString(argumentsMap.body);
    const rawType = asNonEmptyString(argumentsMap.type) ?? 'info';
    const taskId = asNonEmptyString(argumentsMap.taskId);
    const messageType = rawType === 'alert' || rawType === 'report' || rawType === 'approval'
      ? rawType
      : 'info' as const;

    if (!recipientId || !senderId || !title || !body) {
      return {
        ok: false,
        toolName: 'inbox.send',
        error: { code: 'MISSING_REQUIRED_FIELDS', message: 'recipientId, senderId, title, and body are required' }
      };
    }

    if (!context.inboxService) {
      return { ok: false, toolName: 'inbox.send', error: { code: 'SERVICE_UNAVAILABLE', message: 'inboxService is not configured' } };
    }

    const payload: Record<string, unknown> = {};
    if (taskId) {
      payload.taskId = taskId;
    }

    const message = await context.inboxService.createMessage({
      recipientId,
      senderId,
      type: messageType,
      title,
      body,
      payload
    });

    return {
      ok: true,
      toolName: 'inbox.send',
      output: {
        id: message.id,
        recipientId: message.recipientId,
        senderId: message.senderId,
        title: message.title,
        createdAt: message.createdAt.toISOString()
      }
    };
  }
};
