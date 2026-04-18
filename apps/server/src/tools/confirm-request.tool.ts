import type { ToolExecutionResult } from '@familyco/core';

import type { ServerToolDefinition } from '../modules/tools/tool.types.js';

export const confirmRequestTool: ServerToolDefinition = {
  name: 'confirm.request',
  description:
    'Present the Founder with a question and a list of options to choose from. The Founder must select one before the conversation continues. Use this when you need explicit direction to proceed.',
  parameters: [
    {
      name: 'question',
      type: 'string',
      required: true,
      description: 'The decision prompt or question to present to the Founder.'
    },
    {
      name: 'options',
      type: 'array',
      items: { type: 'string' },
      required: true,
      description: 'The list of option strings for the Founder to choose from.'
    }
  ],
  async execute(args): Promise<ToolExecutionResult> {
    const question = typeof args.question === 'string' ? args.question : '';
    const options = Array.isArray(args.options)
      ? args.options.filter((o): o is string => typeof o === 'string')
      : [];

    return { ok: true, toolName: 'confirm.request', output: { question, options } };
  }
};
