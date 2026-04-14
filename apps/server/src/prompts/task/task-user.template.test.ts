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
  assert.ok(prompt.includes('Step 0 — Scan workspace first'), 'must enforce workspace scan first');
  assert.ok(prompt.includes('Do NOT create new files until this scan is complete.'), 'must block file creation before scan');
  assert.ok(prompt.includes('task.update-status'), 'must reference task.update-status');
  assert.ok(prompt.includes('task.comment.add'), 'must reference task.comment.add');
  assert.ok(prompt.includes('Steps 0, 1, 4, 5, and 6 are REQUIRED'), 'must mark updated required steps');
  assert.ok(prompt.includes('final reply MUST be a non-empty assistant message'), 'must enforce non-empty final reply');
  assert.ok(prompt.includes('Send exactly one final reply, then stop'), 'must enforce single final reply after tool calls');
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

test('renderTaskUserPrompt includes dependencies, readiness rules, and blockers when provided', () => {
  const prompt = renderTaskUserPrompt({
    ...BASE_INPUT,
    dependsOnTaskIds: ['task-1', 'task-2'],
    readinessRules: [
      {
        type: 'task_status',
        taskId: 'task-2',
        status: 'done',
        description: 'Task 2 must be completed first.'
      }
    ],
    readiness: {
      ready: false,
      blockers: [
        { code: 'DEPENDENCY_NOT_DONE', message: 'Dependency task task-1 is pending; expected done.' }
      ]
    }
  });

  assert.ok(prompt.includes('### Dependencies'), 'must include dependencies section');
  assert.ok(prompt.includes('task-1'), 'must include dependency id');
  assert.ok(prompt.includes('### Readiness Rules'), 'must include readiness rules section');
  assert.ok(prompt.includes('task_status: task task-2 must be done'), 'must include readiness rule detail');
  assert.ok(prompt.includes('### Current Readiness'), 'must include readiness evaluation section');
  assert.ok(prompt.includes('Dependency task task-1 is pending; expected done.'), 'must include readiness blocker');
});
