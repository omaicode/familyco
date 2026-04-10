export interface PromptToolParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface PromptToolDefinition {
  name: string;
  description: string;
  parameters: PromptToolParameter[];
}

export interface PromptConversationEntry {
  senderId: string;
  body: string;
  title?: string;
  createdAt?: string;
  toolCalls?: PromptConversationToolCall[];
}

export interface PromptConversationToolCall {
  toolName: string;
  ok: boolean;
  summary: string;
  outputJson?: string;
  error?: {
    code?: string;
    message: string;
  };
}

export interface ChatSystemPromptInput {
  companyName: string;
  companyDescription?: string;
  tools: PromptToolDefinition[];
  conversationHistory: PromptConversationEntry[];
}

export interface ChatUserPromptInput {
  message: string;
  conversationHistory: PromptConversationEntry[];
}

export interface HeartbeatRunPromptInput {
  agentName: string;
  agentRole: string;
  agentDepartment: string;
  timestamp: string;
}
