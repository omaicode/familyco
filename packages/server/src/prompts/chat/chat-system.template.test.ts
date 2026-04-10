import test from 'node:test';
import assert from 'node:assert/strict';

import { renderChatSystemPrompt } from './chat-system.template.js';

test('renderChatSystemPrompt includes Role Goal Constraints and JSON contract', () => {
  const prompt = renderChatSystemPrompt({
    companyName: 'FamilyCo',
    companyDescription: 'AI-native operating system for founders.',
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
            summary: 'Created task TASK-123 for the weekly review.'
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
  assert.equal(prompt.includes('Goal:'), true);
  assert.equal(prompt.includes('Constraints:'), true);
  assert.equal(prompt.includes('Output Contract:'), true);
  assert.equal(prompt.includes('{"reply":"string","toolCalls":[{"toolName":"string","arguments":{}}]}'), true);
  assert.equal(prompt.includes('Direct conversational responses are valid and preferred'), true);
  assert.equal(prompt.includes('Company Name: FamilyCo'), true);
  assert.equal(prompt.includes('Recent Conversation Context:'), true);
  assert.equal(prompt.includes('- Founder: Last topic: Need a weekly execution plan with clear priorities.'), true);
  assert.equal(prompt.includes('- Executive agent: Reply from Chief of Staff: Plan drafted and tasks created.'), true);
  assert.equal(prompt.includes('Tool task.create (ok): Created task TASK-123 for the weekly review.'), true);
  assert.equal(prompt.includes('Tool project.update (failed): Unable to update project status. Error: PROJECT_NOT_FOUND'), true);
  assert.equal(prompt.includes('- task.create: Create a task'), true);
});
