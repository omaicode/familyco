export interface ToolExecutionInput {
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ToolExecutor {
  execute(input: ToolExecutionInput): Promise<unknown>;
}
