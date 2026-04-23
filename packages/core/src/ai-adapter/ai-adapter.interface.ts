export type AdapterAuthType = 'apikey' | 'oauth';

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
  attachments?: AdapterChatAttachment[];
  skills?: AdapterSkillDefinition[];
  tools?: AdapterToolDefinition[];
  previousTurns?: AdapterPreviousTurn[];
  onChunk?: (chunk: string) => void;
  abortSignal?: AbortSignal;
}

export interface AdapterChatAttachment {
  id: string;
  kind: 'file' | 'audio';
  filename: string;
  mediaType: string;
  sizeBytes: number;
  data: Uint8Array;
  transcript?: string;
}

export interface AdapterAudioTranscriptionInput {
  apiKey: string;
  audio: Uint8Array;
  mediaType: string;
  filename?: string;
  abortSignal?: AbortSignal;
}

export interface AdapterAudioTranscriptionResult {
  text: string;
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
  items?: { type: string };
}

export interface AdapterToolDefinition {
  name: string;
  description: string;
  parameters: AdapterToolParameterDefinition[];
}

export interface AdapterToolInteraction {
  /** Unique ID for linking call ↔ result (generated per-call) */
  callId: string;
  /** Original tool name (dot-separated, e.g., "task.list") */
  toolName: string;
  /** Arguments passed to the tool */
  arguments: Record<string, unknown>;
  /** JSON string of the tool's output */
  output: string;
  /** Whether the tool succeeded */
  ok: boolean;
}

export interface AdapterPreviousTurn {
  /** The assistant's text response in this turn (may be empty) */
  assistantText: string;
  /** Tool calls made and their results */
  toolInteractions: AdapterToolInteraction[];
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
  readonly logoId: string;
  readonly keyHint: string;
  readonly authType: AdapterAuthType;
  readonly supportedAuthTypes: readonly AdapterAuthType[];
  readonly defaultAuthType: AdapterAuthType;
  readonly defaultModel: string;
  readonly availableModels: readonly string[];

  chat(input: AdapterChatInput): Promise<AdapterChatResult>;
  transcribeAudio?(input: AdapterAudioTranscriptionInput): Promise<AdapterAudioTranscriptionResult>;
  testConnection(apiKey: string, model?: string): Promise<AdapterTestResult>;
}
