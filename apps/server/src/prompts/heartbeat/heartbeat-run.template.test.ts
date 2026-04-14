import test from 'node:test';
import assert from 'node:assert/strict';

import { renderHeartbeatRunPrompt } from './heartbeat-run.template.js';

test('renderHeartbeatRunPrompt follows Role Goal Constraints pattern', () => {
  const prompt = renderHeartbeatRunPrompt({
    agentId: 'agent-001',
    agentName: 'Chief of Staff',
    agentRole: 'Executive Agent',
    agentDepartment: 'Executive',
    skills: [
      {
        id: 'agent-orchestrator',
        name: 'Agent Orchestrator',
        description: 'Manage subordinate agents.',
        path: '/data/projects/familyco/skills/agent-orchestrator/SKILL.md'
      }
    ],
    timestamp: '2026-01-01T00:00:00.000Z'
  });

  assert.equal(prompt.includes('Role:'), true);
  assert.equal(prompt.includes('Responsibilities:'), true);
  assert.equal(prompt.includes('Capabilities and limitations:'), true);
  assert.equal(prompt.includes('Heartbeat Timestamp: 2026-01-01T00:00:00.000Z'), true);
  assert.equal(prompt.includes('agent-001'), true);
  assert.equal(prompt.includes('Call task.list with assigneeAgentId="agent-001" and status="in_progress".'), true);
  assert.equal(prompt.includes('Call task.list again with assigneeAgentId="agent-001" and status="pending".'), true);
  assert.equal(prompt.includes('Use dependsOnTaskIds and readinessRules from task.list output to skip work that is not actually ready.'), true);
  assert.equal(prompt.includes('If title alone is ambiguous, call task.read for specific task(s) to clarify scope, dependencies, readinessRules, or readiness blockers.'), true);
  assert.equal(prompt.includes('You MAY call only: task.list, task.read, heartbeat.dispatch, task.log.'), true);
  assert.equal(prompt.includes('Do NOT dispatch tasks whose dependsOnTaskIds or readinessRules are not satisfied.'), true);
  assert.equal(
    prompt.includes('- agent-orchestrator (Agent Orchestrator): Manage subordinate agents. Path => /data/projects/familyco/skills/agent-orchestrator/SKILL.md'),
    true
  );
});
