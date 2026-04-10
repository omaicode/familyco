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
  assert.equal(prompt.includes('Goal:'), true);
  assert.equal(prompt.includes('Constraints:'), true);
  assert.equal(prompt.includes('Output Contract:'), true);

  // New output contract: native tool calling, always write text, no JSON wrapper
  assert.equal(prompt.includes('Tool calls are handled natively'), true);
  assert.equal(prompt.includes('Always write a text reply in every response'), true);
  assert.equal(prompt.includes('After tool results return, ALWAYS write a substantive reply'), true);
  assert.equal(prompt.includes('does this request actually need external data?'), true);

  // Old JSON contract must be gone
  assert.equal(prompt.includes('return JSON:'), false);
  assert.equal(prompt.includes('"toolCalls"'), false);

  // Tool strategy section — GATHER is now optional
  assert.equal(prompt.includes('Tool Strategy (follow this order strictly)'), true);
  assert.equal(prompt.includes('GATHER (skip if not needed)'), true);
  assert.equal(prompt.includes('PLAN'), true);
  assert.equal(prompt.includes('CONFIRM'), true);
  assert.equal(prompt.includes('EXECUTE'), true);
  assert.equal(prompt.includes('NEVER repeat a tool call'), true);

  // confirm.request guidance
  assert.equal(prompt.includes('confirm.request'), true);
  assert.equal(prompt.includes('sparingly'), true);

  // Tools are now listed in context
  assert.equal(prompt.includes('Available Tools:'), true);
  assert.equal(prompt.includes('- task.create: Create a task'), true);

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
