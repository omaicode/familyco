export type MemoryRole = 'input' | 'tool_output' | 'system';

export interface MemoryEntry {
  id: string;
  agentId: string;
  role: MemoryRole;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface AddMemoryEntryInput {
  agentId: string;
  role: MemoryRole;
  content: string;
  metadata?: Record<string, unknown>;
}
