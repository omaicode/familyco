/**
 * Estimated cost per 1K tokens in USD { input, output }
 * Prices are approximate and may drift — update when provider pricing changes.
 */
const MODEL_COST_PER_1K: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-5-mini':         { input: 0.00025,  output: 0.002 },
  'gpt-5.4-mini':       { input: 0.00075,  output: 0.0045 },
  'gpt-5':              { input: 0.00125,  output: 0.010 },
  'gpt-5.4':            { input: 0.0025,   output: 0.015 },

  // Claude
  'claude-opus-4-7':    { input: 0.005,    output: 0.025 },
  'claude-opus-4-6':    { input: 0.005,    output: 0.025 },
  'claude-opus-4-5':    { input: 0.005,    output: 0.025 },
  'claude-sonnet-4-5':  { input: 0.003,    output: 0.015 },
  'claude-sonnet-4-6':  { input: 0.003,    output: 0.015 },
  'claude-haiku-4-5':   { input: 0.001,    output: 0.005 },

  // Deepseek
  'deepseek-v4-flash':  { input: 0.000028,    output: 0.00028 },
  'deepseek-v4-pro':    { input: 0.000145,    output: 0.0038 },

  // Vercel
  'v0-1.5-lg':          { input: 0.0025,   output: 0.015 },
  'v0-1.5-md':          { input: 0.0025,   output: 0.015 },

  // OpenRouter (representative models, actual cost depends on routed provider/model)
  'anthropic/claude-opus-4.7':      { input: 0.005,    output: 0.025 },
  'anthropic/claude-sonnet-4.6':    { input: 0.003,    output: 0.015 },
  'anthropic/claude-haiku-4.6':     { input: 0.001,    output: 0.005 },
  'anthropic/claude-opus-4.6':      { input: 0.005,    output: 0.025 },
  'anthropic/claude-opus-4.6-fast': { input: 0.005,    output: 0.025 },
  'anthropic/claude-sonnet-4.5':    { input: 0.003,    output: 0.015 },
  'anthropic/claude-haiku-4.5':     { input: 0.001,    output: 0.005 },
  'anthropic/claude-opus-4.5':      { input: 0.005,    output: 0.025 },
  'openai/gpt-5.4-pro':             { input: 0.03,     output: 0.18 },
  'openai/gpt-5.4':                 { input: 0.0025,   output: 0.015 },
  'openai/gpt-5.4-mini':            { input: 0.00075,  output: 0.0045 },
  'openai/gpt-5.4-nano':            { input: 0.00025,  output: 0.002 },
  'openai/gpt-5.3-chat':            { input: 0.00175,  output: 0.014 },
  'openai/gpt-5.3-codex':           { input: 0.00175,  output: 0.014 },
  'openai/gpt-5.2-pro':             { input: 0.021,    output: 0.168 },
  'openai/gpt-5.2-chat':            { input: 0.00175,  output: 0.014 },
  'openai/gpt-5.2-codex':           { input: 0.00175,  output: 0.014 },
  'openai/gpt-5.2':                 { input: 0.00175,  output: 0.014 },
  'openai/gpt-5-pro':               { input: 0.015,    output: 0.12 },
  'openai/gpt-5-codex':             { input: 0.00125,  output: 0.01 },
  'openai/gpt-5-chat':              { input: 0.00125,  output: 0.01 },
  'openai/gpt-5':                   { input: 0.00125,  output: 0.01 },
  'openai/gpt-5-mini':              { input: 0.00025,  output: 0.002 },
  'openai/gpt-5-nano':              { input: 0.00005,  output: 0.0004 },
  'google/gemma-4-26b-a4b-it:free': { input: 0,        output: 0 },
  'google/gemma-4-31b-it:free':     { input: 0,        output: 0 },
  'google/gemini-2.5-pro':          { input: 0.00125,  output: 0.01 },
  'google/gemini-2.5-flash':        { input: 0.0003,   output: 0.0025 },
  'x-ai/grok-4.20-multi-agent':     { input: 0.002,    output: 0.006 },
  'x-ai/grok-4.20':                 { input: 0.002,    output: 0.006 },
  'x-ai/grok-4.1-fast':             { input: 0.00002,  output: 0.00005 },
  'x-ai/grok-4-fast':               { input: 0.00002,  output: 0.00005 },
  'x-ai/grok-4':                    { input: 0.003,    output: 0.015 },
  'x-ai/grok-3':                    { input: 0.003,    output: 0.015 },
  'deepseek/deepseek-v4-pro':       { input: 0.000145, output: 0.0038 },
  'deepseek/deepseek-v4-flash':     { input: 0.000028, output: 0.00028 },
  'minimax/minimax-m2.7':           { input: 0.0003,   output: 0.0012 },
  'minimax/minimax-m2.5':           { input: 0.0003,   output: 0.0012 },
  'minimax/minimax-m2-her':         { input: 0.0003,   output: 0.0012 },
  'minimax/minimax-m2.1':           { input: 0.0003,   output: 0.0012 },
  'moonshotai/kimi-k2.6':           { input: 0.00095,   output: 0.004 },
  'moonshotai/kimi-k2.5':           { input: 0.0006,   output: 0.003 },
  'z-ai/glm-5.1':                   { input: 0.0014,   output: 0.0044 },
  'z-ai/glm-5v-turbo':              { input: 0.0012,   output: 0.004 },
  'z-ai/glm-5-turbo':               { input: 0.0012,   output: 0.004 },
  'z-ai/glm-5':                     { input: 0.001,    output: 0.0032 },
  'z-ai/glm-4.7-flash':             { input: 0.00007,  output: 0.0004 },
  'z-ai/glm-4.7':                   { input: 0.0006,   output: 0.0022 },
  'z-ai/glm-4.6v':                  { input: 0.0003,   output: 0.0009 },
  'z-ai/glm-4.6':                   { input: 0.0006,   output: 0.0022 },
};

const DEFAULT_COST_PER_1K = { input: 0.005, output: 0.005 };

export function estimateCostUSD(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rates = MODEL_COST_PER_1K[model] ?? DEFAULT_COST_PER_1K;
  const cost =
    (promptTokens / 1000) * rates.input +
    (completionTokens / 1000) * rates.output;
  return Math.round(cost * 1_000_000) / 1_000_000; // 6 decimal places
}

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
