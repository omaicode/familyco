import { AiAdapterRegistry } from '@familyco/core';

import { ClaudeAdapter } from './claude.adapter.js';
import { CopilotAdapter } from './copilot.adapter.js';
import { OpenAiAdapter } from './openai.adapter.js';

export function createAdapterRegistry(): AiAdapterRegistry {
  const registry = new AiAdapterRegistry();
  registry.register(new CopilotAdapter());
  registry.register(new OpenAiAdapter());
  registry.register(new ClaudeAdapter());
  return registry;
}
