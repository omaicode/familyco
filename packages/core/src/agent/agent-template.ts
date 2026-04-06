import type { ApprovalMode } from '../approval/approval.entity.js';
import type { AgentLevel } from './agent.entity.js';

export interface AgentTemplateDefinition {
  id: 'pm' | 'ops' | 'research' | 'finance' | 'marketing';
  name: string;
  role: string;
  level: Extract<AgentLevel, 'L1' | 'L2'>;
  department: string;
  tools: string[];
  approvalMode: ApprovalMode;
  rationale: string;
}

export const DEFAULT_AGENT_TEMPLATES: readonly AgentTemplateDefinition[] = [
  {
    id: 'pm',
    name: 'PM Agent',
    role: 'Project Management Lead',
    level: 'L1',
    department: 'Operations',
    tools: ['task_manager', 'project_manager', 'calendar'],
    approvalMode: 'suggest_only',
    rationale: 'Coordinates delivery, keeps timelines visible, and turns founder goals into structured execution.'
  },
  {
    id: 'ops',
    name: 'Ops Agent',
    role: 'Operations Lead',
    level: 'L1',
    department: 'Operations',
    tools: ['scheduler', 'workflow_automation', 'report_generator'],
    approvalMode: 'suggest_only',
    rationale: 'Owns recurring operations, workflows, and handoffs across the company.'
  },
  {
    id: 'research',
    name: 'Research Agent',
    role: 'Research Lead',
    level: 'L1',
    department: 'Research',
    tools: ['web_search', 'summarizer', 'knowledge_base'],
    approvalMode: 'suggest_only',
    rationale: 'Collects context, validates assumptions, and produces concise research briefs.'
  },
  {
    id: 'finance',
    name: 'Finance Agent',
    role: 'Finance Lead',
    level: 'L1',
    department: 'Finance',
    tools: ['spreadsheet', 'calculator', 'report_generator'],
    approvalMode: 'require_review',
    rationale: 'Tracks budget, monitors cash signals, and prepares financial summaries for review.'
  },
  {
    id: 'marketing',
    name: 'Marketing Agent',
    role: 'Marketing Lead',
    level: 'L1',
    department: 'Marketing',
    tools: ['content_generator', 'campaign_planner', 'analytics_reader'],
    approvalMode: 'suggest_only',
    rationale: 'Plans campaigns, content, and growth experiments while keeping messaging aligned.'
  }
] as const;

const TEMPLATE_KEYWORDS: Record<AgentTemplateDefinition['id'], string[]> = {
  pm: ['project manager', 'project management', 'pm agent', 'pm', 'quản lý dự án'],
  ops: ['operations', 'ops', 'vận hành'],
  research: ['research', 'nghiên cứu', 'market research'],
  finance: ['finance', 'tài chính', 'budget'],
  marketing: ['marketing', 'content', 'seo', 'social']
};

export function getAgentTemplateById(
  templateId: string
): AgentTemplateDefinition | undefined {
  return DEFAULT_AGENT_TEMPLATES.find((template) => template.id === templateId);
}

export function matchAgentTemplateFromText(
  input: string,
  templates: readonly AgentTemplateDefinition[] = DEFAULT_AGENT_TEMPLATES
): AgentTemplateDefinition | undefined {
  const normalized = input.trim().toLowerCase();

  return templates.find((template) =>
    TEMPLATE_KEYWORDS[template.id].some((keyword) => normalized.includes(keyword))
  );
}
