import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateApprovalCategory, resolutionToRunOutcome } from './approval-policy.js';

test('maps AP-01 actions to required approval', () => {
  const result = evaluateApprovalCategory('agent.create');
  assert.equal(result.category, 'AP-01');
  assert.equal(result.requiresApproval, true);
  assert.equal(result.requiresClarification, false);
});

test('maps AP-02 actions to policy-overridable approval', () => {
  const result = evaluateApprovalCategory('provider.model.premium.use');
  assert.equal(result.category, 'AP-02');
  assert.equal(result.requiresApproval, true);
  assert.equal(result.requiresClarification, false);
});

test('maps AP-03 actions to clarification flow', () => {
  const result = evaluateApprovalCategory('clarify.acceptance_criteria.unclear');
  assert.equal(result.category, 'AP-03');
  assert.equal(result.requiresApproval, false);
  assert.equal(result.requiresClarification, true);
});

test('keeps unknown actions non-blocking by default', () => {
  const result = evaluateApprovalCategory('task.update');
  assert.equal(result.category, 'AP-02');
  assert.equal(result.requiresApproval, false);
  assert.equal(result.requiresClarification, false);
});

test('resolves approval outcomes into run outcomes', () => {
  assert.equal(resolutionToRunOutcome('approve'), 'resume');
  assert.equal(resolutionToRunOutcome('clarification_answer'), 'resume');
  assert.equal(resolutionToRunOutcome('request_change'), 'replan');
  assert.equal(resolutionToRunOutcome('reject'), 'cancel');
});
