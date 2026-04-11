import test from 'node:test';
import assert from 'node:assert/strict';

import { renderChatSystemPrompt } from './chat-system.template.js';

test('renderChatSystemPrompt includes Role Goal Constraints and JSON contract', () => {
  const prompt = renderChatSystemPrompt({
    companyName: 'FamilyCo',
    companyDescription: 'AI-native operating system for founders.',
    skills: [
      {
        id: 'project-management',
        name: 'Project Management',
        description: 'Coordinate project and task work.',
        path: '/data/projects/familyco/skills/project-management/SKILL.md'
      }
    ],
    conversationHistory: [
      {
        senderId: 'founder',
        title: 'Last topic',
        body: 'Need a weekly execution plan with clear priorities.'
      },
      {
        senderId: 'agent-l0',
        title: 'Reply from Chief of Staff',
        body: 'Plan drafted and tasks created.',
        toolCalls: [
          {
            toolName: 'task.create',
            ok: true,
            summary: 'Created task TASK-123 for the weekly review.',
            outputJson: '{"id":"task-123","title":"Weekly review"}'
          },
          {
            toolName: 'project.update',
            ok: false,
            summary: 'Unable to update project status.',
            error: {
              message: 'PROJECT_NOT_FOUND'
            }
          }
        ]
      }
    ],
    tools: [
      {
        name: 'task.create',
        description: 'Create a task',
        parameters: [
          { name: 'title', type: 'string', required: true, description: 'Task title' },
          { name: 'projectId', type: 'string', required: false, description: 'Target project' }
        ]
      }
    ]
  });

  assert.equal(prompt.includes('Role:'), true);
  assert.equal(prompt.includes('Responsibilities:'), true);
  assert.equal(prompt.includes('Capabilities and limitations:'), true);
  assert.equal(prompt.includes('Constitution'), true);

  assert.equal(prompt.includes('When talking to the Founder (human):'), true);
  assert.equal(prompt.includes('Start with a short executive summary.'), true);
  assert.equal(prompt.includes('When interacting with child agents:'), true);
  assert.equal(prompt.includes('Escalation:'), true);

  // Tools are listed in the TOOLS section
  assert.equal(prompt.includes('TOOLS:'), true);
  assert.equal(prompt.includes('- task.create: Create a task'), true);
  assert.equal(prompt.includes('Skills:'), true);
  assert.equal(prompt.includes('Loaded skills are operating guides, not decoration.'), true);
  assert.equal(
    prompt.includes('If a skill matches the current situation, read that SKILL.md at the listed path with a file-reading tool before planning or tool use.'),
    true
  );
  assert.equal(
    prompt.includes('- project-management (Project Management): Coordinate project and task work. Path => /data/projects/familyco/skills/project-management/SKILL.md'),
    true
  );

  // Conversation history
  assert.equal(prompt.includes('Recent Conversation History'), true);
  assert.equal(prompt.includes('- Founder: Last topic: Need a weekly execution plan with clear priorities.'), true);
  assert.equal(prompt.includes('- Executive agent: Reply from Chief of Staff: Plan drafted and tasks created.'), true);
  assert.equal(
    prompt.includes('Tool task.create (ok): Created task TASK-123 for the weekly review. Output JSON: {"id":"task-123","title":"Weekly review"}'),
    true
  );
  assert.equal(prompt.includes('Tool project.update (failed): Unable to update project status. Error: PROJECT_NOT_FOUND'), true);
});
