import test from 'node:test';
import assert from 'node:assert/strict';

import { renderTaskSystemPrompt } from './task-system.template.js';

test('renderTaskSystemPrompt includes full project context when project is linked', () => {
  const prompt = renderTaskSystemPrompt({
    agentName: 'Delivery Lead',
    agentRole: 'Engineering Manager',
    agentDepartment: 'Engineering',
    agentId: 'agent-001',
    companyName: 'FamilyCo',
    projectId: 'proj-123',
    projectName: 'Website MVP',
    projectDescription: 'Build public website and admin panel.',
    projectOwnerAgentId: 'agent-owner',
    projectParentId: null,
    projectCreatedAt: '2026-04-01T00:00:00.000Z',
    projectUpdatedAt: '2026-04-02T00:00:00.000Z',
    projectWorkspaceDir: '/workspace/website-mvp',
    skills: [],
    tools: []
  });

  assert.equal(prompt.includes('Project context for this task:'), true);
  assert.equal(prompt.includes('- Project ID: proj-123'), true);
  assert.equal(prompt.includes('- Project name: Website MVP'), true);
  assert.equal(prompt.includes('- Project owner agent ID: agent-owner'), true);
  assert.equal(prompt.includes('Your project working directory is: /workspace/website-mvp'), true);
  assert.equal(prompt.includes('Workspace reconnaissance FIRST (mandatory before any write):'), true);
  assert.equal(prompt.includes('Plan implementation in a clear file-by-file sequence, then execute in that sequence.'), true);
  assert.equal(prompt.includes('## Files Created'), true);
});

test('renderTaskSystemPrompt marks task as non-project when project is missing', () => {
  const prompt = renderTaskSystemPrompt({
    agentName: 'Delivery Lead',
    agentRole: 'Engineering Manager',
    agentDepartment: 'Engineering',
    agentId: 'agent-001',
    companyName: 'FamilyCo',
    skills: [],
    tools: []
  });

  assert.equal(prompt.includes('Project context: task is not linked to any project.'), true);
});
