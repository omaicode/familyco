import assert from 'node:assert/strict';
import test from 'node:test';

import type { ToolDefinitionSummary } from '../tools/tool.types.js';
import { filterToolsForAgent } from './chat-engine.service.js';

function toTool(name: string): ToolDefinitionSummary {
  return {
    name,
    description: `${name} description`,
    parameters: []
  };
}

test('filterToolsForAgent keeps plugin tools for chat prompt/tool availability', () => {
  const tools: ToolDefinitionSummary[] = [
    toTool('plugin.base.tavily_search'),
    toTool('unknown.internal.tool'),
    toTool('confirm.request')
  ];

  const filtered = filterToolsForAgent(tools, 'L0');
  const filteredNames = filtered.map((tool) => tool.name);

  assert.equal(filteredNames.includes('plugin.base.tavily_search'), true);
  assert.equal(filteredNames.includes('confirm.request'), true);
  assert.equal(filteredNames.includes('unknown.internal.tool'), false);
});
