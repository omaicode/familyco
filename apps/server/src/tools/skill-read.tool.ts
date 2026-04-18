import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString, invalidArguments, unavailableTool } from '../modules/tools/tool.helpers.js';
import type { ServerToolDefinition } from '../modules/tools/tool.types.js';

export const skillReadTool: ServerToolDefinition = {
  name: 'skill.read',
  description: 'Read full markdown content of a loaded skill by skill id (e.g. plugin:base:project-management).',
  parameters: [
    { name: 'skillId', type: 'string', required: true, description: 'Exact skill id from the Skills list.' }
  ],
  async execute(argumentsMap, context): Promise<ToolExecutionResult> {
    if (!context.skillsService) {
      return unavailableTool('skill.read', 'skill.read requires skillsService');
    }

    const skillId = asNonEmptyString(argumentsMap.skillId);
    if (!skillId) {
      return invalidArguments('skill.read', 'skillId is required');
    }

    const skill = await context.skillsService.getById(skillId);
    if (!skill) {
      return invalidArguments('skill.read', `skill not found: ${skillId}`);
    }

    return {
      ok: true,
      toolName: 'skill.read',
      output: {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        path: skill.path,
        content: skill.content ?? ''
      }
    };
  }
};