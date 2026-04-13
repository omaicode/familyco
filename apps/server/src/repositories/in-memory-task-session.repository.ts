import type { TaskSessionCheckpoint, TaskSessionRepository } from '../runtime/task-session.store.js';

export class InMemoryTaskSessionRepository implements TaskSessionRepository {
  private readonly store = new Map<string, TaskSessionCheckpoint>();

  async load(taskId: string): Promise<TaskSessionCheckpoint | null> {
    return this.store.get(taskId) ?? null;
  }

  async save(checkpoint: TaskSessionCheckpoint): Promise<void> {
    this.store.set(checkpoint.taskId, { ...checkpoint });
  }

  async clear(taskId: string): Promise<void> {
    this.store.delete(taskId);
  }
}
