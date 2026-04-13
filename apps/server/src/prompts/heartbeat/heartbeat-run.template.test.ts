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
  assert.equal(prompt.includes('Call task.list with assigneeAgentId="agent-001" (without status filter) to fetch ALL your tasks.'), true);
  assert.equal(prompt.includes('For each project that has actionable tasks, call project.read once'), true);
  assert.equal(prompt.includes('Project Kickoff & Requirements'), true);
  assert.equal(prompt.includes('Tech Setup'), true);
  assert.equal(
    prompt.includes('- agent-orchestrator (Agent Orchestrator): Manage subordinate agents. Path => /data/projects/familyco/skills/agent-orchestrator/SKILL.md'),
    true
  );
});
