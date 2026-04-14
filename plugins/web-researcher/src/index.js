import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { webSearchTool } from './tools/web-search.js';
import { webFetchTool } from './tools/web-fetch.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const webResearchContent = readFileSync(
  path.join(__dirname, 'skills/web-research.md'),
  'utf8'
);

const plugin = {
  name: 'Web Researcher',
  description:
    'Adds web search and URL fetch capabilities to agents, enabling them to research topics and retrieve live information from the web.',
  version: '1.0.0',
  author: 'FamilyCo',
  tags: ['web', 'research', 'search', 'fetch'],
  defaultApprovalMode: 'require_review',

  tools: [webSearchTool, webFetchTool],

  skills: [
    {
      name: 'web-research',
      description: 'Guidelines for effective web research using search and fetch tools.',
      content: webResearchContent,
      applyTo: []
    }
  ]
};

export default plugin;
