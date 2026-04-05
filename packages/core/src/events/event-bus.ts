import { EventEmitter } from 'node:events';

import type { FamilyCoEvents } from './event.types.js';

export class EventBus {
  private readonly emitter = new EventEmitter();

  on<K extends keyof FamilyCoEvents>(event: K, listener: (payload: FamilyCoEvents[K]) => void): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  emit<K extends keyof FamilyCoEvents>(event: K, payload: FamilyCoEvents[K]): void {
    this.emitter.emit(event, payload);
  }
}
