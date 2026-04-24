export type AdapterId = 'openai' | 'openrouter' | 'claude' | 'vercel' | 'deepseek';

export interface AdapterOption {
  value: AdapterId;
  label: string;
  models: string[];
  keyHint: string;
}

export const ADAPTER_OPTIONS: AdapterOption[] = [
  {
    value: 'openai',
    label: 'OpenAI',
    models: ['gpt-5', 'gpt-5-mini', 'gpt-5.4', 'gpt-5.4-mini'],
    keyHint: 'sk-…'
  },
  {
    value: 'openrouter',
    label: 'OpenRouter',
    models: ['openai/gpt-5-mini', 'anthropic/claude-sonnet-4.5', 'google/gemini-2.5-flash'],
    keyHint: 'sk-or-…'
  },
  {
    value: 'claude',
    label: 'Claude',
    models: ['claude-sonnet-4-5', 'claude-sonnet-4-6', 'claude-opus-4-5', 'claude-opus-4-6', 'claude-haiku-4-5'],
    keyHint: 'sk-ant-…'
  },
  {
    value: 'vercel',
    label: 'Vercel',
    models: ['openai/gpt-5-mini', 'anthropic/claude-sonnet-4-5', 'google/gemini-2.5-flash'],
    keyHint: 'vck_…'
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyHint: 'sk-…'
  }
];

export function getDefaultAdapterModel(adapterId: AdapterId): string {
  return ADAPTER_OPTIONS.find((option) => option.value === adapterId)?.models[0] ?? 'gpt-5-mini';
}

export function normalizeAdapterModel(adapterId: AdapterId, model: string | null | undefined): string {
  const trimmed = model?.trim();
  if (!trimmed) {
    return getDefaultAdapterModel(adapterId);
  }

  const supported = ADAPTER_OPTIONS.find((option) => option.value === adapterId)?.models ?? [];
  return supported.includes(trimmed) ? trimmed : getDefaultAdapterModel(adapterId);
}
