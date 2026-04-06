import type { AgentProfile } from '../agent/agent.entity.js';
import {
  DEFAULT_AGENT_TEMPLATES,
  matchAgentTemplateFromText,
  type AgentTemplateDefinition
} from '../agent/agent-template.js';

export interface FounderChatMeta {
  projectId?: string;
  taskId?: string;
}

export interface PlanFounderCommandInput {
  agent: AgentProfile;
  message: string;
  meta?: FounderChatMeta;
  availableTemplates?: readonly AgentTemplateDefinition[];
}

export interface FounderCommandPlan {
  reply: string;
  shouldCreateTask: boolean;
  taskTitle?: string;
  taskDescription?: string;
  requestedTemplate?: AgentTemplateDefinition;
}

const TASK_INTENT_PATTERNS = [
  /hãy/i,
  /thực hiện/i,
  /làm/i,
  /review/i,
  /plan/i,
  /check/i,
  /prepare/i,
  /analy[sz]e/i,
  /follow up/i
];

export class FounderCommandService {
  planResponse(input: PlanFounderCommandInput): FounderCommandPlan {
    const normalized = normalizeText(input.message);
    const templates = input.availableTemplates ?? DEFAULT_AGENT_TEMPLATES;
    const requestedTemplate = matchAgentTemplateFromText(normalized, templates);
    const shouldCreateTask =
      Boolean(input.meta?.projectId || input.meta?.taskId) ||
      TASK_INTENT_PATTERNS.some((pattern) => pattern.test(normalized)) ||
      (!normalized.endsWith('?') && normalized.length >= 40);

    const taskTitle = shouldCreateTask ? buildTaskTitle(normalized) : undefined;
    const taskDescription = shouldCreateTask ? input.message.trim() : undefined;

    if (requestedTemplate && input.agent.level === 'L0' && shouldCreateTask) {
      return {
        reply: `Captured as an executive task and prepared an approval request for a ${requestedTemplate.name}.`,
        shouldCreateTask,
        taskTitle,
        taskDescription,
        requestedTemplate
      };
    }

    if (requestedTemplate && input.agent.level === 'L0') {
      return {
        reply: `Prepared an approval request to add a ${requestedTemplate.name} under the executive layer.`,
        shouldCreateTask,
        taskTitle,
        taskDescription,
        requestedTemplate
      };
    }

    if (requestedTemplate) {
      return {
        reply: `${input.agent.name} can help, but only the executive agent may propose adding a new agent.`,
        shouldCreateTask,
        taskTitle,
        taskDescription
      };
    }

    if (shouldCreateTask) {
      return {
        reply: `Captured this as a pending task for ${input.agent.name} and kept the thread updated here.`,
        shouldCreateTask,
        taskTitle,
        taskDescription
      };
    }

    return {
      reply:
        'Message received. Continue the conversation here, or turn it into a task when explicit execution tracking is needed.',
      shouldCreateTask: false
    };
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function buildTaskTitle(message: string): string {
  const firstSentence = message.split(/[.!?\n]/).find((part) => part.trim().length > 0) ?? message;
  const trimmed = firstSentence.trim();

  if (trimmed.length <= 72) {
    return trimmed;
  }

  return `${trimmed.slice(0, 69).trimEnd()}...`;
}
