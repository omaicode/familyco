import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString } from './tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from './tool.types.js';

export const approvalRequestSlashSpec: SlashCommandSpec = {
  command: '/approval-request',
  label: 'Request approval',
  description: 'Create an approval request when you need Founder authorization before proceeding.',
  insertValue: '/approval-request ',
  levels: ['L0', 'L1', 'L2'],
  auditAction: 'agent.chat.approval-request',
  buildArguments: (args) => ({ reason: args })
};

export const approvalRequestTool: ServerToolDefinition = {
  name: 'approval.request',
  slashSpec: approvalRequestSlashSpec,
  description: 'Create an approval request for the Founder or a reviewer. Use this when you need explicit authorization before proceeding with a sensitive action or decision.',
  parameters: [
    {
      name: 'actorId',
      type: 'string',
      required: true,
      description: 'Your agent ID (the one requesting approval).'
    },
    {
      name: 'action',
      type: 'string',
      required: true,
      description: 'The action requiring approval, e.g. "task.close", "budget.spend", "agent.create".'
    },
    {
      name: 'reason',
      type: 'string',
      required: true,
      description: 'Why approval is needed. Be specific about what you want to do and why.'
    },
    {
      name: 'targetId',
      type: 'string',
      required: false,
      description: 'Optional ID of the resource the action targets (task ID, project ID, etc.).'
    },
    {
      name: 'taskId',
      type: 'string',
      required: false,
      description: 'Optional task ID this approval is linked to.'
    }
  ],

  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    const actorId = asNonEmptyString(argumentsMap.actorId);
    const action = asNonEmptyString(argumentsMap.action);
    const reason = asNonEmptyString(argumentsMap.reason);
    const targetId = asNonEmptyString(argumentsMap.targetId);
    const taskId = asNonEmptyString(argumentsMap.taskId);

    if (!actorId || !action || !reason) {
      return {
        ok: false,
        toolName: 'approval.request',
        error: { code: 'MISSING_REQUIRED_FIELDS', message: 'actorId, action, and reason are required' }
      };
    }

    if (!context.approvalService) {
      return { ok: false, toolName: 'approval.request', error: { code: 'SERVICE_UNAVAILABLE', message: 'approvalService is not configured' } };
    }

    const payload: Record<string, unknown> = { reason };
    if (taskId) {
      payload.taskId = taskId;
    }

    const request = await context.approvalService.createApprovalRequest({
      actorId,
      action,
      targetId: targetId ?? taskId,
      payload
    });

    if (context.inboxService) {
      await context.inboxService.createMessage({
        recipientId: 'founder',
        senderId: actorId,
        type: 'approval',
        title: `Approval needed: ${action}`,
        body: reason,
        payload: {
          approvalRequestId: request.id,
          action,
          targetId: request.targetId,
          taskId
        }
      });
    }

    return {
      ok: true,
      toolName: 'approval.request',
      output: {
        approvalRequestId: request.id,
        action: request.action,
        status: request.status,
        createdAt: request.createdAt.toISOString()
      }
    };
  }
};
