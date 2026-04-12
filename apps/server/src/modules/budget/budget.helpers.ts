/**
 * Estimated cost per 1K tokens in USD { input, output }
 * Prices are approximate and may drift — update when provider pricing changes.
 */
const MODEL_COST_PER_1K: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-5-mini':           { input: 0.0025,  output: 0.01 },
  'gpt-5.4-mini':      { input: 0.000150, output: 0.000600 },
  'o3-mini':          { input: 0.0011,  output: 0.0044 },
  'o1':               { input: 0.015,   output: 0.06 },
  // Claude
  'claude-opus-4-5':    { input: 0.015,  output: 0.075 },
  'claude-sonnet-4-5':  { input: 0.003,  output: 0.015 },
  'claude-haiku-3-5':   { input: 0.00025, output: 0.00125 },
  // Copilot / GitHub (same underlying models as OpenAI)
  'claude-3.5-sonnet':  { input: 0.003,  output: 0.015 },
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
