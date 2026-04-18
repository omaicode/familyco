import assert from 'node:assert/strict';
import test from 'node:test';

import { skillReadTool } from './skill-read.tool.js';

const baseContext = {
  executeTool: async () => ({ ok: false, toolName: 'noop', error: { code: 'noop', message: 'noop' } }),
  listTools: () => []
};

test('skill.read returns skill content by id', async () => {
  const result = await skillReadTool.execute(
    { skillId: 'plugin:base:project-management' },
    {
      ...baseContext,
      skillsService: {
        getById: async (id: string) => (
          id === 'plugin:base:project-management'
            ? {
                id,
                name: 'project-management',
                description: 'Project management workflow',
                version: null,
                tags: [],
                path: '[plugin:base]',
                content: '# Skill Content',
                source: 'local',
                enabled: true
              }
            : null
        )
      }
    } as unknown as Parameters<typeof skillReadTool.execute>[1]
  );

  assert.equal(result.ok, true);
  assert.equal(result.toolName, 'skill.read');
  assert.equal((result.output as { id: string }).id, 'plugin:base:project-management');
  assert.equal((result.output as { content: string }).content, '# Skill Content');
});

test('skill.read validates required skillId', async () => {
  const result = await skillReadTool.execute(
    {},
    {
      ...baseContext,
      skillsService: {
        getById: async () => null
      }
    } as unknown as Parameters<typeof skillReadTool.execute>[1]
  );

  assert.equal(result.ok, false);
  assert.equal(result.error?.code, 'TOOL_INVALID_ARGUMENTS');
});
