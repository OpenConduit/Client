// Shared context-window helpers used by InputBar, ContextWarningBanner, and useChat.

const CONTEXT_LIMITS: [string, number][] = [
  ['claude',      200_000],
  ['gpt-4o',      128_000],
  ['gpt-4-turbo', 128_000],
  ['gpt-4',         8_192],
  ['gpt-3.5',      16_385],
  ['o1',          200_000],
  ['o3',          200_000],
  ['llama-3',     131_072],
  ['llama-2',       4_096],
  ['mistral',      32_768],
  ['mixtral',      32_768],
  ['gemma',         8_192],
  ['phi-3',       128_000],
  ['phi-4',        16_384],
];

export function getContextLimit(model: string): number | null {
  const lower = model.toLowerCase();
  for (const [key, limit] of CONTEXT_LIMITS) {
    if (lower.includes(key)) return limit;
  }
  return null;
}

export function fmtTok(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);
}

/** Rough token estimate from raw text (chars / 4). Good enough for trim decisions. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
