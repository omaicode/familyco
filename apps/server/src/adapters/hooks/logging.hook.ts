import type { AdapterHook, AfterChatHookContext, OnErrorHookContext } from '@familyco/core';

export interface AdapterLogger {
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
}

export class LoggingHook implements AdapterHook {
  readonly id = 'logging';

  constructor(private readonly logger: AdapterLogger) {}

  afterChat(ctx: AfterChatHookContext): void {
    this.logger.info(
      {
        adapterId: ctx.adapterId,
        model: ctx.model,
        durationMs: ctx.durationMs,
        tokens: ctx.result.tokenUsage
      },
      'adapter.chat.completed'
    );
  }

  onError(ctx: OnErrorHookContext): void {
    this.logger.warn(
      {
        adapterId: ctx.adapterId,
        model: ctx.model,
        durationMs: ctx.durationMs,
        error: ctx.error.message
      },
      'adapter.chat.error'
    );
  }
}
