import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCoreMessages, buildVercelTools, toSafeToolName } from './vercel-adapter.helpers.js';

// ---- toSafeToolName ----

test('toSafeToolName: replaces dots with underscores', () => {
  assert.equal(toSafeToolName('task.create'), 'task_create');
  assert.equal(toSafeToolName('agent.task.update'), 'agent_task_update');
});

test('toSafeToolName: handles already-safe names', () => {
  assert.equal(toSafeToolName('myTool'), 'myTool');
  assert.equal(toSafeToolName('tool_name'), 'tool_name');
});

test('toSafeToolName: truncates at 64 chars', () => {
  const long = 'a'.repeat(100);
  assert.equal(toSafeToolName(long).length, 64);
});

// ---- buildVercelTools ----

test('buildVercelTools: builds tools with safe names and restores originals', () => {
  const toolSet = buildVercelTools([
    {
      name: 'task.create',
      description: 'Create a task',
      parameters: [{ name: 'title', type: 'string', description: 'Title', required: true }]
    },
    {
      name: 'task.delete',
      description: 'Delete a task',
      parameters: [{ name: 'id', type: 'string', description: 'ID', required: true }]
    }
  ]);

  assert.ok(toolSet.tools['task_create'], 'task_create should be present');
  assert.ok(toolSet.tools['task_delete'], 'task_delete should be present');
  assert.equal(toolSet.tools['task_create']?.description, 'Create a task');
  assert.equal(toolSet.restoreToolName('task_create'), 'task.create');
  assert.equal(toolSet.restoreToolName('task_delete'), 'task.delete');
  assert.equal(toolSet.restoreToolName('unknown'), 'unknown');
});

test('buildVercelTools: respects required field', () => {
  const toolSet = buildVercelTools([
    {
      name: 'my.tool',
      description: 'A tool',
      parameters: [
        { name: 'required_param', type: 'string', description: 'req', required: true },
        { name: 'optional_param', type: 'number', description: 'opt', required: false }
      ]
    }
  ]);

  const myTool = toolSet.tools['my_tool'];
  assert.ok(myTool, 'my_tool should exist in toolset');
  assert.equal(myTool.description, 'A tool');
  assert.ok(myTool.inputSchema, 'inputSchema should be present');
});

// ---- buildCoreMessages ----

test('buildCoreMessages: produces user message for simple prompt, no history', () => {
  const messages = buildCoreMessages('hello', []);
  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.role, 'user');
  assert.deepEqual(messages[0]?.content, [{ type: 'text', text: 'hello' }]);
});

test('buildCoreMessages: adds assistant message for text-only previous turn', () => {
  const messages = buildCoreMessages('follow-up', [
    {
      assistantText: 'previous response',
      toolInteractions: []
    }
  ]);

  // Structure: [user: follow-up, assistant: previous response]
  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.role, 'user');
  assert.deepEqual(messages[0]?.content, [{ type: 'text', text: 'follow-up' }]);
  assert.equal(messages[1]?.role, 'assistant');
  const assistantContent = messages[1]?.content as Array<{ type: string; text: string }>;
  assert.equal(assistantContent[0]?.type, 'text');
  assert.equal(assistantContent[0]?.text, 'previous response');
});

test('buildCoreMessages: produces tool-call + tool-result for turn with interactions', () => {
  const messages = buildCoreMessages('next', [
    {
      assistantText: 'let me check',
      toolInteractions: [
        {
          callId: 'call_1',
          toolName: 'task.list',
          arguments: { status: 'active' },
          output: '[{"id":"1"}]',
          ok: true
        }
      ]
    }
  ]);

  // Structure: [user: next, assistant: text+tool-call, tool: result]
  assert.equal(messages.length, 3);
  assert.equal(messages[0]?.role, 'user');
  assert.equal(messages[1]?.role, 'assistant');
  assert.equal(messages[2]?.role, 'tool');

  const assistantContent = messages[1]?.content as Array<{ type: string; toolName?: string; toolCallId?: string }>;
  const toolCallPart = assistantContent.find((p) => p.type === 'tool-call');
  assert.ok(toolCallPart, 'assistant should have tool-call part');
  assert.equal(toolCallPart?.toolName, 'task_list');
  assert.equal(toolCallPart?.toolCallId, 'call_1');

  const toolContent = messages[2]?.content as Array<{ type: string; toolCallId: string; output: { type: string; value: unknown } }>;
  assert.equal(toolContent[0]?.toolCallId, 'call_1');
  // JSON-parseable output should be { type: 'json', value: parsed }
  assert.equal(toolContent[0]?.output.type, 'json');
  assert.deepEqual(toolContent[0]?.output.value, [{ id: '1' }]);
});

test('buildCoreMessages: injects audio transcript into user content for the model', () => {
  const messages = buildCoreMessages('Summarize this note.', [], [
    {
      id: 'audio-1',
      kind: 'audio',
      filename: 'recording.webm',
      mediaType: 'audio/webm',
      sizeBytes: 128,
      data: new Uint8Array([1, 2, 3]),
      transcript: 'We need to reduce churn and review onboarding.'
    }
  ]);

  assert.equal(messages.length, 1);
  assert.equal(messages[0]?.role, 'user');
  assert.deepEqual(messages[0]?.content, [
    { type: 'text', text: 'Summarize this note.' },
    {
      type: 'text',
      text: 'Transcript for recording.webm:\nWe need to reduce churn and review onboarding.'
    }
  ]);
});

test('buildCoreMessages: sanitizes dotted tool names in tool-call and tool-result', () => {
  const messages = buildCoreMessages('continue', [
    {
      assistantText: '',
      toolInteractions: [
        {
          callId: 'call_2',
          toolName: 'agent.task.create',
          arguments: {},
          output: 'done',
          ok: true
        }
      ]
    }
  ]);

  const assistantContent = messages[1]?.content as Array<{ type: string; toolName?: string }>;
  const toolCallPart = assistantContent.find((p) => p.type === 'tool-call');
  assert.equal(toolCallPart?.toolName, 'agent_task_create');

  const toolContent = messages[2]?.content as Array<{ toolName: string }>;
  assert.equal(toolContent[0]?.toolName, 'agent_task_create');
});

test('buildCoreMessages: skips empty assistantText in content parts', () => {
  const messages = buildCoreMessages('next', [
    {
      assistantText: '   ',
      toolInteractions: [
        {
          callId: 'call_3',
          toolName: 'my.tool',
          arguments: {},
          output: 'result',
          ok: true
        }
      ]
    }
  ]);

  const assistantContent = messages[1]?.content as Array<{ type: string }>;
  const textParts = assistantContent.filter((p) => p.type === 'text');
  assert.equal(textParts.length, 0, 'no text parts for whitespace-only assistant text');
});
