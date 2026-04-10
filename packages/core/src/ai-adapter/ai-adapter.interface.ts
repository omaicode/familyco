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
}

export interface AiAdapter {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly keyHint: string;
  readonly defaultModel: string;
  readonly availableModels: readonly string[];

  chat(input: AdapterChatInput): Promise<string>;
  testConnection(apiKey: string): Promise<AdapterTestResult>;
}
