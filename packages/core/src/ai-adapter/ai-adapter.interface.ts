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
}

export interface AdapterSkillDefinition {
  id: string;
  name: string;
  description: string;
}

export interface AdapterTokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface AdapterChatResult {
  content: string;
  tokenUsage?: AdapterTokenUsage;
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
