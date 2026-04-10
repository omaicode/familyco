export type AdapterId = 'copilot' | 'openai' | 'claude';

export interface AdapterOption {
  value: AdapterId;
  label: string;
  models: string[];
  keyHint: string;
}

export const ADAPTER_OPTIONS: AdapterOption[] = [
  {
    value: 'copilot',
    label: 'GitHub Copilot',
    models: [
      'gpt-5-mini',
      'gpt-5.4-mini',
      'gpt-5',
      'gpt-5.4',
      'claude-sonnet-4-5',
      'claude-sonnet-4-6',
      'claude-opus-4-6',
      'claude-haiku-4-5'
    ],
    keyHint: 'ghp_… or ghu_…'
  },
  {
    value: 'openai',
    label: 'OpenAI',
    models: ['gpt-5-mini', 'gpt-5.4-mini', 'gpt-5', 'gpt-5.4'],
    keyHint: 'sk-…'
  },
  {
    value: 'claude',
    label: 'Claude',
    models: ['claude-sonnet-4-5', 'claude-sonnet-4-6', 'claude-opus-4-5', 'claude-opus-4-6', 'claude-haiku-4-5'],
    keyHint: 'sk-ant-…'
  }
];

export function getDefaultAdapterModel(adapterId: AdapterId): string {
  return ADAPTER_OPTIONS.find((option) => option.value === adapterId)?.models[0] ?? 'gpt-5-mini';
}
