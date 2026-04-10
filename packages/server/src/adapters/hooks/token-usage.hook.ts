import type { AdapterHook, AfterChatHookContext, AuditService } from '@familyco/core';

export class TokenUsageHook implements AdapterHook {
  readonly id = 'token-usage';

  constructor(private readonly auditService: AuditService) {}

  async afterChat(ctx: AfterChatHookContext): Promise<void> {
    if (!ctx.result.tokenUsage) return;

    await this.auditService.write({
      actorId: 'system',
      action: 'adapter.chat.completed',
      payload: {
        adapterId: ctx.adapterId,
        model: ctx.model,
        durationMs: ctx.durationMs,
        tokenUsage: ctx.result.tokenUsage
      }
    });
  }
}
