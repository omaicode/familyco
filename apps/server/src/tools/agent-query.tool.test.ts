import assert from 'node:assert/strict';
import test from 'node:test';

import { agentListTool } from './agent-list.tool.js';
import { agentReadTool } from './agent-read.tool.js';

const agents = [
  {
    id: 'agent-l0',
    name: 'Chief of Staff',
    role: 'Executive',
    level: 'L0',
    department: 'Executive',
    status: 'active',
    parentAgentId: null
  },
  {
    id: 'agent-l1-ops',
    name: 'Ops Lead',
    role: 'Operations Manager',
    level: 'L1',
    department: 'Operations',
    status: 'idle',
    parentAgentId: 'agent-l0'
  }
];

const context = {
  agentService: {
    listAgents: async () => agents
  }
};

test('agent.list returns filtered agents', async () => {
  const result = await agentListTool.execute(
    { level: 'L1', department: 'Operations', parentAgentId: 'Chief of Staff' },
    context as Parameters<typeof agentListTool.execute>[1]
  );

  assert.equal(result.ok, true);
  assert.equal((result.output as { total: number }).total, 1);
  const items = (result.output as { items: Array<{ id: string }> }).items;
  assert.equal(items[0]?.id, 'agent-l1-ops');
});

test('agent.read returns a single agent by id or name', async () => {
  const byId = await agentReadTool.execute(
    { query: 'agent-l0' },
    context as Parameters<typeof agentReadTool.execute>[1]
  );
  assert.equal(byId.ok, true);
  assert.equal((byId.output as { name: string }).name, 'Chief of Staff');

  const byName = await agentReadTool.execute(
    { query: 'Ops Lead' },
    context as Parameters<typeof agentReadTool.execute>[1]
  );
  assert.equal(byName.ok, true);
  assert.equal((byName.output as { id: string }).id, 'agent-l1-ops');
});
