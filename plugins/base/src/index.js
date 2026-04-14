import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(path.join(__dirname, 'skills', f), 'utf8');

/** @type {import('@familyco/core').PluginModule} */
const plugin = {
  name: 'Base',
  description: 'Built-in skills & tools.',
  version: '1.0.0',
  author: 'FamilyCo',
  tags: ['base', 'orchestration', 'project-management'],
  defaultApprovalMode: 'auto',
  tools: [],
  skills: [
    {
      name: 'agent-orchestrator',
      description:
        'Manage subordinate agents with a supervisory workflow. Use for staffing, role definition, scope control, workload balancing, performance review, conflict resolution, and safe agent lifecycle management.',
      content: read('agent-orchestrator.md'),
      applyTo: ['L0']
    },
    {
      name: 'project-management',
      description:
        'Manage projects and tasks through subordinate agents with a delegate-first workflow. Use for project planning, task breakdown, assignment, execution tracking, status reporting, and safe project/task CRUD.',
      content: read('project-management.md'),
      applyTo: ['L0']
    }
  ]
};

export default plugin;
