import type { AdapterChatInput, AdapterChatResult } from './ai-adapter.interface.js';

export interface AdapterHookContext {
  adapterId: string;
  model: string;
}

export interface BeforeChatHookContext extends AdapterHookContext {
  input: AdapterChatInput;
}

export interface AfterChatHookContext extends AdapterHookContext {
  input: AdapterChatInput;
  result: AdapterChatResult;
  durationMs: number;
}

export interface OnErrorHookContext extends AdapterHookContext {
  input: AdapterChatInput;
  error: Error;
  durationMs: number;
}

export interface AdapterHook {
  readonly id: string;
  beforeChat?(ctx: BeforeChatHookContext): Promise<void> | void;
  afterChat?(ctx: AfterChatHookContext): Promise<void> | void;
  onError?(ctx: OnErrorHookContext): Promise<void> | void;
}
