import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tavilyTools } from './tools/tavily-tools.js';
import { httpTools } from './tools/http-tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(path.join(__dirname, 'skills', f), 'utf8');

/** @type {import('@familyco/core').PluginModule} */
const plugin = {
  name: 'Base',
  description: 'Built-in skills & tools.',
  version: '1.2.0',
  author: 'FamilyCo',
  tags: ['base', 'orchestration', 'project-management', 'operations', 'research', 'tavily'],
  defaultApprovalMode: 'auto',
  tools: [
    ...tavilyTools,
    ...httpTools
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
      name: 'weather-forecast',
      description: 'Get current weather and forecasts for any location worldwide.',
      content: read('weather.md'),
      applyTo: ['L0', 'L1', 'L2']
    }
  ]
};

export default plugin;
