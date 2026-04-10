import test from 'node:test';
import assert from 'node:assert/strict';

import { renderChatSystemPrompt } from './chat-system.template.js';

test('renderChatSystemPrompt includes Role Goal Constraints and JSON contract', () => {
  const prompt = renderChatSystemPrompt({
    companyName: 'FamilyCo',
    companyDescription: 'AI-native operating system for founders.',
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
  assert.equal(prompt.includes('Company Name: FamilyCo'), true);
  assert.equal(prompt.includes('- task.create: Create a task'), true);
});
