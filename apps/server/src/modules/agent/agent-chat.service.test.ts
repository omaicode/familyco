import assert from 'node:assert/strict';
import test from 'node:test';

import type { AgentProfile, AgentService } from '@familyco/core';
import { InboxService } from '@familyco/core';

import { InMemoryChatConversationRepository } from '../../repositories/in-memory-chat-conversation.repository.js';
import { InMemoryInboxRepository } from '../../repositories/in-memory-inbox.repository.js';
import { ChatConversationService } from './chat-conversation.service.js';
import type { ChatAttachmentData } from './chat-attachment-store.js';
import { chunkReply, processAgentChat } from './agent-chat.service.js';
import { toConversationHistoryEntry } from './agent-chat.helpers.js';

test('chunkReply preserves markdown newlines', () => {
  const reply = '# Weekly Plan\n\n1. Sync roadmap\n2. Ship onboarding polish\n\n- Owner: Ops\n- ETA: Friday';
  const chunks = chunkReply(reply);
  const rebuilt = chunks.join('');

  assert.equal(rebuilt, reply);
  assert.equal(rebuilt.includes('\n\n1. Sync roadmap'), true);
  assert.equal(rebuilt.includes('\n- Owner: Ops'), true);
});

test('processAgentChat transcribes audio before sending transcript into chat engine', async () => {
  const inboxService = new InboxService(new InMemoryInboxRepository());
  const chatConversationService = new ChatConversationService(new InMemoryChatConversationRepository());
  const capturedRunInputs: Array<{ message?: string; attachments?: Array<{ transcript?: string }> }> = [];
  const capturedTitleInputs: Array<{ message: string }> = [];
  const createdAt = new Date('2025-01-01T00:00:00.000Z');
  const attachment: ChatAttachmentData = {
    id: 'audio-1',
    kind: 'audio',
    name: 'recording.webm',
    mediaType: 'audio/webm',
    sizeBytes: 3,
    storageKey: 'audio-1',
    createdAt: new Date().toISOString(),
    data: new Uint8Array([1, 2, 3])
  };

  const result = await processAgentChat({
    agentId: 'agent-1',
    actorId: 'founder',
    body: {
      message: '',
      meta: {
        attachments: [{ id: attachment.id }]
      }
    },
    deps: {
      agentService: {
        getAgentById: async (): Promise<AgentProfile> => ({
          id: 'agent-1',
          name: 'Chief of Staff',
          role: 'Chief of Staff',
          level: 'L0',
          department: 'Executive',
          status: 'active',
          parentAgentId: null,
          aiAdapterId: 'openai',
          aiModel: 'gpt-5',
          createdAt,
          updatedAt: createdAt
        })
      } as unknown as AgentService,
      inboxService,
      chatConversationService,
      approvalService: {} as never,
      auditService: {
        write: async () => undefined
      } as never,
      approvalGuard: {} as never,
      agentRunner: {} as never,
      chatEngineService: {
        prepareAttachments: async (input: { attachments: Array<{ id: string }> }) =>
          input.attachments.map((item) => ({
            ...item,
            kind: 'audio' as const,
            filename: 'recording.webm',
            mediaType: 'audio/webm',
            sizeBytes: 3,
            data: new Uint8Array([1, 2, 3]),
            transcript: 'We should review churn and onboarding.'
          })),
        run: async (input: { attachments?: Array<{ transcript?: string }> }) => {
          capturedRunInputs.push(input);
          return { reply: 'Done.', toolCalls: [], task: null, project: null };
        },
        generateSessionTitle: async (input: { message: string }) => {
          capturedTitleInputs.push(input);
          return 'Review churn and onboarding';
        }
      } as never,
      toolExecutor: {
        execute: async ({ toolName }: { toolName: string }) =>
          toolName === 'company.profile.read'
            ? { ok: true, output: { companyName: 'FamilyCo', companyDescription: '' } }
            : { ok: false, error: { code: 'TOOL_NOT_FOUND', message: toolName } }
      } as never,
      listTools: () => [],
      chatStreamRegistry: {} as never,
      chatAttachmentStore: {
        read: async (id: string) => (id === attachment.id ? attachment : null),
        updateMetadata: async (_id: string, patch: { transcript?: string }) => ({
          ...attachment,
          ...(patch.transcript ? { transcript: patch.transcript } : {})
        })
      } as never,
      settingsService: {
        get: async (key: string) => {
          if (key === 'provider.name') {
            return { key, value: 'openai' };
          }

          if (key === 'provider.defaultModel') {
            return { key, value: 'gpt-5' };
          }

          return null;
        }
      } as never
    }
  });

  assert.equal(capturedRunInputs.length, 1);
  assert.equal(capturedRunInputs[0]?.message, 'We should review churn and onboarding.');
  assert.equal(capturedRunInputs[0]?.attachments?.[0]?.transcript, 'We should review churn and onboarding.');
  assert.equal(capturedTitleInputs.length, 1);
  assert.equal(capturedTitleInputs[0]?.message, 'We should review churn and onboarding.');
  assert.equal(result.session.title, 'Review churn and onboarding');
  const founderPayload = result.founderMessage.payload as {
    attachments?: Array<{ transcript?: string }>;
  } | null;
  assert.equal(
    founderPayload?.attachments?.[0]?.transcript,
    'We should review churn and onboarding.'
  );
});

test('toConversationHistoryEntry appends attachment transcripts to message history', () => {
  const createdAt = new Date('2026-04-11T07:00:00.000Z');
  const entry = toConversationHistoryEntry({
    id: 'message-1',
    sessionId: 'session-1',
    recipientId: 'agent-1',
    senderId: 'founder',
    type: 'info',
    title: '',
    body: '',
    createdAt,
    updatedAt: createdAt,
    payload: {
      attachments: [
        {
          id: 'audio-1',
          kind: 'audio',
          name: 'recording.webm',
          mediaType: 'audio/webm',
          sizeBytes: 3,
          storageKey: 'audio-1',
          createdAt: createdAt.toISOString(),
          transcript: 'Xin chao, hom nay co task nao?'
        }
      ]
    }
  });

  assert.equal(
    entry.body,
    'Transcript for recording.webm:\nXin chao, hom nay co task nao?'
  );
});
