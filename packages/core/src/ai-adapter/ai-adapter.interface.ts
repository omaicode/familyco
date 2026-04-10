export interface AdapterTestResult {
  ok: boolean;
  latencyMs: number;
  model?: string;
  error?: string;
}

export interface AdapterChatInput {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  skills?: AdapterSkillDefinition[];
  tools?: AdapterToolDefinition[];
  onChunk?: (chunk: string) => void;
}

export interface AdapterSkillDefinition {
  id: string;
  name: string;
  description: string;
}

export interface AdapterToolParameterDefinition {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface AdapterToolDefinition {
  name: string;
  description: string;
  parameters: AdapterToolParameterDefinition[];
}

export interface AdapterPlannedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface AdapterTokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface AdapterChatResult {
  content: string;
  tokenUsage?: AdapterTokenUsage;
  toolCalls?: AdapterPlannedToolCall[];
}

export interface AiAdapter {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly keyHint: string;
  readonly defaultModel: string;
  readonly availableModels: readonly string[];

  chat(input: AdapterChatInput): Promise<AdapterChatResult>;
  testConnection(apiKey: string): Promise<AdapterTestResult>;
}
