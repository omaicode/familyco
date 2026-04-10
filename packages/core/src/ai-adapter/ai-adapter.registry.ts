import type { AdapterHook } from './adapter-hook.interface.js';
import { AdapterHookRunner } from './adapter-hook-runner.js';
import type { AiAdapter, AdapterChatInput, AdapterChatResult, AdapterTestResult } from './ai-adapter.interface.js';

class HookedAdapter implements AiAdapter {
  constructor(
    private readonly inner: AiAdapter,
    private readonly runner: AdapterHookRunner
  ) {}

  get id(): string { return this.inner.id; }
  get name(): string { return this.inner.name; }
  get description(): string { return this.inner.description; }
  get keyHint(): string { return this.inner.keyHint; }
  get defaultModel(): string { return this.inner.defaultModel; }
  get availableModels(): readonly string[] { return this.inner.availableModels; }

  async chat(input: AdapterChatInput): Promise<AdapterChatResult> {
    const ctx = { adapterId: this.inner.id, model: input.model, input };
    const start = Date.now();

    await this.runner.runBeforeChat(ctx);

    try {
      const result = await this.inner.chat(input);
      await this.runner.runAfterChat({ ...ctx, result, durationMs: Date.now() - start });
      return result;
    } catch (error) {
      await this.runner.runOnError({
        ...ctx,
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs: Date.now() - start
      });
      throw error;
    }
  }

  testConnection(apiKey: string): Promise<AdapterTestResult> {
    return this.inner.testConnection(apiKey);
  }
}

export class AiAdapterRegistry {
  private readonly adapters = new Map<string, AiAdapter>();
  private readonly hookRunner = new AdapterHookRunner();

  register(adapter: AiAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  registerHook(hook: AdapterHook): void {
    this.hookRunner.register(hook);
  }

  get(id: string): AiAdapter | undefined {
    const adapter = this.adapters.get(id);
    if (!adapter) return undefined;
    return new HookedAdapter(adapter, this.hookRunner);
  }

  getRequired(id: string): AiAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`ADAPTER_NOT_FOUND:${id}`);
    }

    return new HookedAdapter(adapter, this.hookRunner);
  }

  list(): AiAdapter[] {
    return Array.from(this.adapters.values()).map(
      (adapter) => new HookedAdapter(adapter, this.hookRunner)
    );
  }
}
