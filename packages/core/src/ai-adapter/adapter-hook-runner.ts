import type {
  AdapterHook,
  AfterChatHookContext,
  BeforeChatHookContext,
  OnErrorHookContext
} from './adapter-hook.interface.js';

export class AdapterHookRunner {
  private readonly hooks: AdapterHook[] = [];

  register(hook: AdapterHook): void {
    this.hooks.push(hook);
  }

  list(): readonly AdapterHook[] {
    return this.hooks;
  }

  async runBeforeChat(ctx: BeforeChatHookContext): Promise<void> {
    for (const hook of this.hooks) {
      if (hook.beforeChat) {
        try {
          await hook.beforeChat(ctx);
        } catch {
          // Hooks must not crash the chat pipeline
        }
      }
    }
  }

  async runAfterChat(ctx: AfterChatHookContext): Promise<void> {
    for (const hook of this.hooks) {
      if (hook.afterChat) {
        try {
          await hook.afterChat(ctx);
        } catch {
          // Hooks must not crash the chat pipeline
        }
      }
    }
  }

  async runOnError(ctx: OnErrorHookContext): Promise<void> {
    for (const hook of this.hooks) {
      if (hook.onError) {
        try {
          await hook.onError(ctx);
        } catch {
          // Hooks must not crash the chat pipeline
        }
      }
    }
  }
}
