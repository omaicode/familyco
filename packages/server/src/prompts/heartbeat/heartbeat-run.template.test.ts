import test from 'node:test';
import assert from 'node:assert/strict';

import { renderHeartbeatRunPrompt } from './heartbeat-run.template.js';

test('renderHeartbeatRunPrompt follows Role Goal Constraints pattern', () => {
  const prompt = renderHeartbeatRunPrompt({
    agentName: 'Chief of Staff',
    agentRole: 'Executive Agent',
    agentDepartment: 'Executive',
    timestamp: '2026-01-01T00:00:00.000Z'
  });

  assert.equal(prompt.includes('Role:'), true);
  assert.equal(prompt.includes('Goal:'), true);
  assert.equal(prompt.includes('Constraints:'), true);
  assert.equal(prompt.includes('Heartbeat Timestamp: 2026-01-01T00:00:00.000Z'), true);
  assert.equal(prompt.includes('Resume from saved session context before taking action.'), true);
});
