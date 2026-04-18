import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { industryTools } from './tools/industry-tools.js';
import { tavilyTools } from './tools/tavily-tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(path.join(__dirname, 'skills', f), 'utf8');

/** @type {import('@familyco/core').PluginModule} */
const plugin = {
  name: 'Base',
  description: 'Built-in skills & tools.',
  version: '1.2.0',
  author: 'FamilyCo',
  tags: ['base', 'orchestration', 'project-management', 'industry-playbooks', 'operations', 'research', 'tavily'],
  defaultApprovalMode: 'auto',
  tools: [
    ...tavilyTools,
    ...industryTools,
  ],
  skills: [
    {
      name: 'agent-orchestrator',
      description:
        'Manage subordinate agents with a supervisory workflow. Use for staffing, role definition, scope control, workload balancing, performance review, conflict resolution, and safe agent lifecycle management.',
      content: read('agent-orchestrator.md'),
      applyTo: ['L0'],
      enabledByDefault: true
    },
    {
      name: 'project-management',
      description:
        'Manage projects and tasks through subordinate agents with a delegate-first workflow. Use for project planning, task breakdown, assignment, execution tracking, status reporting, and safe project/task CRUD.',
      content: read('project-management.md'),
      applyTo: ['L0'],
      enabledByDefault: true
    },
    {
      name: 'tavily-research',
      description:
        'Run web search and compact research synthesis through Tavily before making operational decisions.',
      content: read('tavily-research.md'),
      applyTo: ['L0', 'L1']
    },    
    {
      name: 'saas-growth-operations',
      description:
        'Execute SaaS growth operations through structured playbooks for acquisition, activation, retention, and expansion.',
      content: read('saas-growth-operations.md'),
      applyTo: ['L0', 'L1']
    },
    {
      name: 'retail-operations',
      description:
        'Coordinate retail and e-commerce operations with inventory, replenishment, promotion, and margin guardrails.',
      content: read('retail-operations.md'),
      applyTo: ['L0', 'L1']
    },
    {
      name: 'healthcare-operations',
      description:
        'Coordinate healthcare operations with patient-flow clarity, safety checks, and compliance-aware execution.',
      content: read('healthcare-operations.md'),
      applyTo: ['L0', 'L1']
    },
    {
      name: 'education-program-operations',
      description:
        'Run education program operations with outcome tracking, intervention loops, and learner-support coordination.',
      content: read('education-program-operations.md'),
      applyTo: ['L0', 'L1']
    },
    {
      name: 'manufacturing-quality-operations',
      description:
        'Operate manufacturing workflows with throughput, quality, and maintenance coordination under controlled risk.',
      content: read('manufacturing-quality-operations.md'),
      applyTo: ['L0', 'L1']
    },
    {
      name: 'hospitality-operations',
      description:
        'Coordinate hospitality workflows across reservations, guest service, and revenue-sensitive operations.',
      content: read('hospitality-operations.md'),
      applyTo: ['L0', 'L1']
    }
  ]
};

export default plugin;
