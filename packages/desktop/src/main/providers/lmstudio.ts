// LM Studio uses the OpenAI-compatible API — we just re-export with a default base URL
import { streamOpenAI } from './openai';
import { McpTool, Message, ModelParameters, ProviderConfig, TokenUsage, ToolCall } from '../../shared/types';

function normalizeLmStudioBaseUrl(url: string | undefined): string {
  const base = (url ?? 'http://localhost:1234').replace(/\/v1\/?$/, '');
  return `${base}/v1`;
}

export async function* streamLmStudio(
  config: ProviderConfig,
  messages: Message[],
  model: string,
  params: ModelParameters,
  systemPrompt: string | undefined,
  tools: McpTool[],
): AsyncGenerator<{ type: 'delta'; text: string } | { type: 'thinking'; text: string } | { type: 'tool_calls'; toolCalls: ToolCall[] } | { type: 'usage'; usage: TokenUsage }> {
  const lmConfig: ProviderConfig = {
    ...config,
    apiKey: config.apiKey ?? 'lm-studio',
    baseUrl: normalizeLmStudioBaseUrl(config.baseUrl),
  };
  yield* streamOpenAI(lmConfig, messages, model, params, systemPrompt, tools);
}
