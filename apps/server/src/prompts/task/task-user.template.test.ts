import test from 'node:test';
import assert from 'node:assert/strict';

import { renderTaskUserPrompt } from './task-user.template.js';

const BASE_INPUT = {
  taskId: 'task-abc-123',
  taskTitle: 'Write Q2 content plan',
  taskDescription: 'Produce a comprehensive content plan for Q2.',
  taskStatus: 'pending',
  taskPriority: 'high',
  assigneeAgentId: 'agent-42'
};

test('renderTaskUserPrompt includes task ID and title', () => {
  const prompt = renderTaskUserPrompt(BASE_INPUT);
  assert.ok(prompt.includes('task-abc-123'), 'must include task ID');
  assert.ok(prompt.includes('Write Q2 content plan'), 'must include task title');
});

test('renderTaskUserPrompt includes mandatory execution protocol steps', () => {
  const prompt = renderTaskUserPrompt(BASE_INPUT);
  assert.ok(prompt.includes('Execution Protocol'), 'must include Execution Protocol header');
  assert.ok(prompt.includes('task.update-status'), 'must reference task.update-status');
  assert.ok(prompt.includes('task.comment.add'), 'must reference task.comment.add');
  assert.ok(prompt.includes('REQUIRED'), 'must mark steps as required');
});

test('renderTaskUserPrompt bakes task ID into mandatory steps', () => {
  const prompt = renderTaskUserPrompt(BASE_INPUT);
  // The task ID must appear in the execution protocol, not just the header
  const protocolSection = prompt.slice(prompt.indexOf('Execution Protocol'));
  assert.ok(protocolSection.includes('task-abc-123'), 'task ID must appear in protocol section');
});

test('renderTaskUserPrompt bakes assignee ID into comment step', () => {
  const prompt = renderTaskUserPrompt(BASE_INPUT);
  assert.ok(prompt.includes('agent-42'), 'assignee ID must appear in comment step');
});

test('renderTaskUserPrompt includes previous session summary when provided', () => {
  const prompt = renderTaskUserPrompt({
    ...BASE_INPUT,
    previousSessionSummary: 'Completed outline. Next: draft section 1.'
  });
  assert.ok(prompt.includes('Previous Session Summary'), 'must include previous session header');
  assert.ok(prompt.includes('Completed outline'), 'must include previous summary content');
});

test('renderTaskUserPrompt includes task comments when provided', () => {
  const prompt = renderTaskUserPrompt({
    ...BASE_INPUT,
    taskComments: [
      { authorId: 'agent-1', authorLabel: 'Alice', body: 'Please prioritize section 2.', createdAt: '2026-01-01T00:00:00Z' }
    ]
  });
  assert.ok(prompt.includes('Task Comments'), 'must include comments header');
  assert.ok(prompt.includes('Please prioritize section 2.'), 'must include comment body');
  assert.ok(prompt.includes('Alice'), 'must use authorLabel when provided');
});

test('renderTaskUserPrompt uses authorId when authorLabel is absent', () => {
  const prompt = renderTaskUserPrompt({
    ...BASE_INPUT,
    taskComments: [
      { authorId: 'agent-99', body: 'Quick note.', createdAt: '2026-01-01T00:00:00Z' }
    ]
  });
  assert.ok(prompt.includes('agent-99'), 'must fall back to authorId');
});

test('renderTaskUserPrompt renders previousToolResults when provided', () => {
  const prompt = renderTaskUserPrompt({
    ...BASE_INPUT,
    previousToolResults: [
      { toolName: 'file.search', ok: true, output: 'Found 3 files' },
      { toolName: 'file.read', ok: false, error: 'File not found' }
    ]
  });
  assert.ok(prompt.includes('Previous Tool Execution Results'), 'must include tool results header');
  assert.ok(prompt.includes('file.search'), 'must include tool name');
  assert.ok(prompt.includes('Found 3 files'), 'must include tool output');
  assert.ok(prompt.includes('file.read'), 'must include failed tool name');
  assert.ok(prompt.includes('File not found'), 'must include error message');
});

test('renderTaskUserPrompt omits previous tool results section when empty or absent', () => {
  const prompt = renderTaskUserPrompt(BASE_INPUT);
  assert.ok(!prompt.includes('Previous Tool Execution Results'), 'must not include tool results header when absent');

  const promptEmpty = renderTaskUserPrompt({ ...BASE_INPUT, previousToolResults: [] });
  assert.ok(!promptEmpty.includes('Previous Tool Execution Results'), 'must not include tool results header when empty array');
});
