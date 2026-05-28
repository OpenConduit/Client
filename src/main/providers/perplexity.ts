// Perplexity uses an OpenAI-compatible API — we delegate to streamOpenAI with their base URL.
import { streamOpenAI } from './openai';
import type { McpTool, Message, ModelParameters, ProviderConfig, ReasoningLevel, TokenUsage, ToolCall } from '../../shared/types';

const PERPLEXITY_BASE_URL = 'https://api.perplexity.ai';

export async function* streamPerplexity(
  config: ProviderConfig,
  messages: Message[],
  model: string,
  params: ModelParameters,
  systemPrompt: string | undefined,
  tools: McpTool[],
  reasoning?: ReasoningLevel,
): AsyncGenerator<{ type: 'delta'; text: string } | { type: 'thinking'; text: string } | { type: 'tool_calls'; toolCalls: ToolCall[] } | { type: 'usage'; usage: TokenUsage }> {
  const perplexityConfig: ProviderConfig = {
    ...config,
    baseUrl: PERPLEXITY_BASE_URL,
  };
  yield* streamOpenAI(perplexityConfig, messages, model, params, systemPrompt, tools, reasoning);
}
