import { resolveExecutiveAgentId } from '../modules/shared/defaults.js';
import {
  asNonEmptyString,
  asTextString,
  invalidArguments,
  parseKeyValueArgs,
  unavailableTool
} from '../modules/tools/tool.helpers.js';
import type { ServerToolDefinition, SlashCommandSpec } from '../modules/tools/tool.types.js';

export const cronUpsertSlashSpec: SlashCommandSpec = {
  command: '/create-cron',
  label: 'Create or update a cron job',
  description: 'Schedule a recurring founder request using cron format.',
  insertValue: '/create-cron schedule=0 7 * * * prompt=',
  levels: ['L0'],
  auditAction: 'agent.chat.cron.upsert',
  buildArguments: (args) => {
    const kv = parseKeyValueArgs(args);
    return {
      name: kv.name,
      schedule: kv.schedule,
      prompt: kv.prompt,
      cronId: kv.id
    };
  }
};

export const cronUpsertTool: ServerToolDefinition = {
  name: 'cron.upsert',
  description: 'Create or update recurring CRON jobs for the founder. Use this whenever the request is periodic.',
  slashSpec: cronUpsertSlashSpec,
  parameters: [
    {
      name: 'name',
      type: 'string',
      required: true,
      description: 'Human-friendly cron name.'
    },
    {
      name: 'prompt',
      type: 'string',
      required: true,
      description: 'Prompt message executed in the linked chat session on each run.'
    },
    {
      name: 'schedule',
      type: 'string',
      required: true,
      description: '5-field cron expression: minute hour day month weekday (example: 0 7 * * *).'
    },
    {
      name: 'cronId',
      type: 'string',
      required: false,
      description: 'Existing cron ID. If provided, update this job instead of creating a new one.'
    },
    {
      name: 'enabled',
      type: 'boolean',
      required: false,
      description: 'Whether the cron should run immediately after save. Defaults to true.'
    }
  ],
  async execute(argumentsMap, context) {
    if (!context.cronService || !context.settingsService || !context.agentService) {
      return unavailableTool('cron.upsert', 'cron.upsert requires cronService, settingsService, and agentService');
    }

    const name = asNonEmptyString(argumentsMap.name);
    const prompt = asTextString(argumentsMap.prompt);
    const schedule = asNonEmptyString(argumentsMap.schedule);
    const cronId = asNonEmptyString(argumentsMap.cronId);
    const enabled = parseBoolean(argumentsMap.enabled);

    if (!name) {
      return invalidArguments('cron.upsert', 'name is required');
    }

    if (!prompt) {
      return invalidArguments('cron.upsert', 'prompt is required');
    }

    if (!schedule) {
      return invalidArguments('cron.upsert', 'schedule is required');
    }

    try {
      context.cronService.parseSchedule(schedule);
    } catch {
      return invalidArguments('cron.upsert', 'schedule must be a valid 5-field cron expression');
    }

    const agentId = context.agentId ?? await resolveExecutiveAgentId({
      agentService: context.agentService,
      settingsService: context.settingsService
    });

    const job = cronId
      ? await context.cronService.updateJob(cronId, {
          name,
          prompt,
          schedule,
          agentId,
          ...(enabled !== undefined ? { enabled } : {})
        })
      : await context.cronService.createJob({
          name,
          prompt,
          schedule,
          agentId,
          ...(enabled !== undefined ? { enabled } : {})
        });

    return {
      ok: true,
      toolName: 'cron.upsert',
      output: job
    };
  }
};

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }

  return undefined;
}
