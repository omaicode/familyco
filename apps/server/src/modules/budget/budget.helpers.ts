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
  'claude-opus-4-5':    { input: 0.005,    output: 0.025 },
  'claude-opus-4-6':    { input: 0.005,    output: 0.025 },
  'claude-sonnet-4-5':  { input: 0.003,    output: 0.015 },
  'claude-sonnet-4-6':  { input: 0.003,    output: 0.015 },
  'claude-haiku-4-5':   { input: 0.001,    output: 0.005 },
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
