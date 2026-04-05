import type { ToolExecutor } from './tool-executor.js';

export class ToolRegistry {
  private readonly executors = new Map<string, ToolExecutor>();

  register(toolName: string, executor: ToolExecutor): void {
    this.executors.set(toolName, executor);
  }

  get(toolName: string): ToolExecutor | undefined {
    return this.executors.get(toolName);
  }
}
