export interface ToolExecutionInput {
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ToolExecutionResult {
  ok: boolean;
  toolName: string;
  output?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export interface ToolExecutor {
  execute(input: ToolExecutionInput): Promise<ToolExecutionResult>;
}
