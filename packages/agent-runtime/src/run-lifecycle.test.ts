import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canTransition,
  createRunLifecycle,
  isRunState,
  RUN_TRANSITIONS,
  type RunState
} from './run-lifecycle.js';

test('isRunState validates known states', () => {
  assert.equal(isRunState('queued'), true);
  assert.equal(isRunState('executing'), true);
  assert.equal(isRunState('unknown'), false);
});

test('canTransition follows declared transition graph', () => {
  const states = Object.keys(RUN_TRANSITIONS) as RunState[];

  for (const from of states) {
    for (const to of states) {
      const expected = RUN_TRANSITIONS[from].includes(to);
      assert.equal(canTransition(from, to), expected, `${from} -> ${to} mismatch`);
    }
  }
});

test('lifecycle transitions through happy path', () => {
  const lifecycle = createRunLifecycle('queued');
  assert.equal(lifecycle.current, 'queued');

  lifecycle.transitionTo('planning');
  assert.equal(lifecycle.current, 'planning');

  lifecycle.transitionTo('executing');
  assert.equal(lifecycle.current, 'executing');

  lifecycle.transitionTo('completed');
  assert.equal(lifecycle.current, 'completed');
});

test('lifecycle rejects invalid transitions', () => {
  const lifecycle = createRunLifecycle('queued');

  assert.throws(() => lifecycle.transitionTo('completed'), {
    message: 'RUN_STATE_TRANSITION_INVALID:queued->completed'
  });
});
