// LM Studio uses the OpenAI-compatible API — we just re-export with a default base URL
import { streamOpenAI } from './openai';
import { Message, ModelParameters, ProviderConfig, ToolCall } from '../../shared/types';
import { McpTool } from '../../shared/types';

export async function* streamLmStudio(
  config: ProviderConfig,
  messages: Message[],
  model: string,
  params: ModelParameters,
  systemPrompt: string | undefined,
  tools: McpTool[],
): AsyncGenerator<{ type: 'delta'; text: string } | { type: 'thinking'; text: string } | { type: 'tool_calls'; toolCalls: ToolCall[] }> {
  const lmConfig: ProviderConfig = {
    ...config,
    apiKey: config.apiKey ?? 'lm-studio',
    baseUrl: config.baseUrl ?? 'http://localhost:1234/v1',
  };
  yield* streamOpenAI(lmConfig, messages, model, params, systemPrompt, tools);
}
