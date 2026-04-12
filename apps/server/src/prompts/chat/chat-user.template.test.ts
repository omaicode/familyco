import test from 'node:test';
import assert from 'node:assert/strict';

import { renderChatUserPrompt } from './chat-user.template.js';

test('renderChatUserPrompt returns raw founder message only', () => {
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

  assert.equal(prompt, 'Prepare a weekly operating review.');
});
