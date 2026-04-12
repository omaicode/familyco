import type { ToolExecutionResult } from '@familyco/core';

import { asNonEmptyString } from './tool.helpers.js';
import type { ServerToolDefinition } from './tool.types.js';

export interface CompanyProfile {
  companyName: string;
  companyDescription: string;
}

export const companyProfileReadTool: ServerToolDefinition = {
  name: 'company.profile.read',
  description:
    'Read the current company name and description saved during setup so the agent has the latest business context.',
  parameters: [],
  async execute(_argumentsMap, context): Promise<ToolExecutionResult> {
    const companyNameSetting = await context.settingsService?.get('company.name');
    const descriptionSetting = await context.settingsService?.get('company.description');

    return {
      ok: true,
      toolName: 'company.profile.read',
      output: {
        companyName: asNonEmptyString(companyNameSetting?.value) ?? 'FamilyCo',
        companyDescription: asNonEmptyString(descriptionSetting?.value) ?? ''
      } satisfies CompanyProfile
    };
  }
};
