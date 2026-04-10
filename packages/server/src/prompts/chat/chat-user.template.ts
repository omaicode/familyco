import type { ChatUserPromptInput } from '../prompt.types.js';

export function renderChatUserPrompt(input: ChatUserPromptInput): string {
  return input.message;
}
