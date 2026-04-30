import type {
  AgentRepository,
  AgentRunRepository,
  ApprovalRepository,
  AuditRepository,
  BudgetUsageRepository,
  CronRepository,
  InboxRepository,
  PluginRepository as PluginRepositoryInterface,
  PluginRunRepository as PluginRunRepositoryInterface,
  ProjectRepository,
  SettingsRepository,
  TaskRepository
} from '@familyco/core';
import { prismaClient } from '@familyco/db';

import type { SettingsEncryption } from '../modules/settings/settings.encryption.js';
import type { ApiKeyRepository } from '../modules/auth/api-key.service.js';
import type { ChatConversationRepository } from '../modules/agent/chat-conversation.service.js';
import {
  InMemoryAgentRepository,
  InMemoryAgentRunRepository,
  InMemoryApiKeyRepository,
  InMemoryApprovalRepository,
  InMemoryAuditRepository,
  InMemoryBudgetUsageRepository,
  InMemoryChatConversationRepository,
  InMemoryCronRepository,
  InMemoryInboxRepository,
  InMemoryPluginRepository,
  InMemoryPluginRunRepository,
  InMemoryProjectRepository,
  InMemorySettingsRepository,
  InMemoryTaskRepository,
  InMemoryTaskSessionRepository,
  PrismaAgentRepository,
  PrismaAgentRunRepository,
  PrismaApiKeyRepository,
  PrismaApprovalRepository,
  PrismaAuditRepository,
  PrismaBudgetUsageRepository,
  PrismaChatConversationRepository,
  PrismaCronRepository,
  PrismaInboxRepository,
  PrismaPluginRepository,
  PrismaPluginRunRepository,
  PrismaProjectRepository,
  PrismaSettingsRepository,
  PrismaTaskRepository,
  PrismaTaskSessionRepository
} from '../repositories/index.js';

export type RepositoryDriver = 'memory' | 'prisma';
export type TaskSessionRepository = InMemoryTaskSessionRepository | PrismaTaskSessionRepository;

export interface AppRepositories {
  agentRepository: AgentRepository;
  agentRunRepository: AgentRunRepository;
  apiKeyRepository: ApiKeyRepository;
  approvalRepository: ApprovalRepository;
  auditRepository: AuditRepository;
  budgetUsageRepository: BudgetUsageRepository;
  chatConversationRepository: ChatConversationRepository;
  cronRepository: CronRepository;
  inboxRepository: InboxRepository;
  pluginRepository: PluginRepositoryInterface;
  pluginRunRepository: PluginRunRepositoryInterface;
  projectRepository: ProjectRepository;
  settingsRepository: SettingsRepository;
  taskRepository: TaskRepository;
  taskSessionRepository: TaskSessionRepository;
}

export function createRepositories(
  repositoryDriver: RepositoryDriver,
  settingsEncryption: SettingsEncryption | null = null
): AppRepositories {
  if (repositoryDriver === 'prisma') {
    const client = prismaClient;
    return {
      agentRepository: new PrismaAgentRepository(client),
      agentRunRepository: new PrismaAgentRunRepository(client),
      apiKeyRepository: new PrismaApiKeyRepository(client),
      approvalRepository: new PrismaApprovalRepository(client),
      auditRepository: new PrismaAuditRepository(client),
      budgetUsageRepository: new PrismaBudgetUsageRepository(client),
      chatConversationRepository: new PrismaChatConversationRepository(client),
      cronRepository: new PrismaCronRepository(client),
      inboxRepository: new PrismaInboxRepository(client),
      pluginRepository: new PrismaPluginRepository(client),
      pluginRunRepository: new PrismaPluginRunRepository(client),
      projectRepository: new PrismaProjectRepository(client),
      settingsRepository: new PrismaSettingsRepository(client, settingsEncryption),
      taskRepository: new PrismaTaskRepository(client),
      taskSessionRepository: new PrismaTaskSessionRepository(client)
    };
  }

  return {
    agentRepository: new InMemoryAgentRepository(),
    agentRunRepository: new InMemoryAgentRunRepository(),
    apiKeyRepository: new InMemoryApiKeyRepository(),
    approvalRepository: new InMemoryApprovalRepository(),
    auditRepository: new InMemoryAuditRepository(),
    budgetUsageRepository: new InMemoryBudgetUsageRepository(),
    chatConversationRepository: new InMemoryChatConversationRepository(),
    cronRepository: new InMemoryCronRepository(),
    inboxRepository: new InMemoryInboxRepository(),
    pluginRepository: new InMemoryPluginRepository(),
    pluginRunRepository: new InMemoryPluginRunRepository(),
    projectRepository: new InMemoryProjectRepository(),
    settingsRepository: new InMemorySettingsRepository(),
    taskRepository: new InMemoryTaskRepository(),
    taskSessionRepository: new InMemoryTaskSessionRepository()
  };
}
