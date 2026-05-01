import type { AdapterHook, BeforeChatHookContext } from '@familyco/core';

import type { KnowledgeContextService } from '../../modules/knowledge/knowledge-context.service.js';

export class KnowledgeContextHook implements AdapterHook {
  readonly id = 'knowledge-context';

  constructor(private readonly knowledgeContextService: KnowledgeContextService) {}

  async beforeChat(ctx: BeforeChatHookContext): Promise<void> {
    const query = ctx.input.userPrompt.trim();
    if (query.length === 0) {
      return;
    }

    const projectId = extractProjectId(ctx.input.systemPrompt, ctx.input.userPrompt);
    const result = await this.knowledgeContextService.buildPromptContext({
      query,
      ...(projectId ? { projectId } : {}),
      maxItems: 6,
      maxChars: 7000
    });

    if (!result.context) {
      return;
    }

    ctx.input.systemPrompt = `${ctx.input.systemPrompt}\n\n${result.context}`;
  }
}

function extractProjectId(systemPrompt: string, userPrompt: string): string | undefined {
  const systemMatch = systemPrompt.match(/- Project ID:\s*([^\n]+)/i);
  if (systemMatch?.[1]) {
    const normalized = systemMatch[1].trim();
    if (normalized.length > 0 && normalized !== '(none)' && normalized !== '(unknown)') {
      return normalized;
    }
  }

  const userMatch = userPrompt.match(/projectId["'\s:=`]+([a-zA-Z0-9_-]+)/i);
  if (userMatch?.[1]) {
    const normalized = userMatch[1].trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return undefined;
}
