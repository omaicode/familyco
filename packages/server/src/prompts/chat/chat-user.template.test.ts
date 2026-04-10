import test from 'node:test';
import assert from 'node:assert/strict';

import { renderChatUserPrompt } from './chat-user.template.js';

test('renderChatUserPrompt includes structured sections and conversation context', () => {
  const prompt = renderChatUserPrompt({
    message: 'Prepare a weekly operating review.',
    conversationHistory: [
      {
        senderId: 'founder',
        title: 'Priorities',
        body: 'Focus on delivery and unblock pending approvals.'
      }
    ]
  });

  assert.equal(prompt.includes('Role:'), true);
  assert.equal(prompt.includes('Goal:'), true);
  assert.equal(prompt.includes('Constraints:'), true);
  assert.equal(prompt.includes('Do not force tool usage when a direct response is sufficient.'), true);
  assert.equal(prompt.includes('Recent conversation context:'), true);
  assert.equal(prompt.includes('Latest founder message:'), true);
  assert.equal(prompt.includes('Prepare a weekly operating review.'), true);
});
