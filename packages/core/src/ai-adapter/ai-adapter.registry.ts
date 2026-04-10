import type { AiAdapter } from './ai-adapter.interface.js';

export class AiAdapterRegistry {
  private readonly adapters = new Map<string, AiAdapter>();

  register(adapter: AiAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): AiAdapter | undefined {
    return this.adapters.get(id);
  }

  getRequired(id: string): AiAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`ADAPTER_NOT_FOUND:${id}`);
    }

    return adapter;
  }

  list(): AiAdapter[] {
    return Array.from(this.adapters.values());
  }
}
