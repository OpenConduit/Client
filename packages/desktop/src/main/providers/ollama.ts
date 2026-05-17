import { streamOpenAI } from './openai';
import { McpTool, Message, ModelParameters, ProviderConfig, TokenUsage, ToolCall } from '../../shared/types';

export function normalizeOllamaBaseUrl(url: string | undefined): string {
  const base = (url ?? 'http://localhost:11434').replace(/\/v1\/?$/, '');
  return `${base}/v1`;
}

export function toOllamaModelId(model: string): string {
  return model.replace(/\s+·\s+.+$/, '').trim();
}

function toOllamaError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (
    /ECONNREFUSED|ENOTFOUND|fetch failed|Failed to fetch|Connection error|404/.test(message)
  ) {
    return new Error('Ollama not detected — download at ollama.com');
  }
  return err instanceof Error ? err : new Error(message);
}

export async function* streamOllama(
  config: ProviderConfig,
  messages: Message[],
  model: string,
  params: ModelParameters,
  systemPrompt: string | undefined,
  tools: McpTool[],
): AsyncGenerator<{ type: 'delta'; text: string } | { type: 'thinking'; text: string } | { type: 'tool_calls'; toolCalls: ToolCall[] } | { type: 'usage'; usage: TokenUsage }> {
  const ollamaConfig: ProviderConfig = {
    ...config,
    apiKey: config.apiKey ?? 'ollama',
    baseUrl: normalizeOllamaBaseUrl(config.baseUrl),
  };
  try {
    yield* streamOpenAI(ollamaConfig, messages, toOllamaModelId(model), params, systemPrompt, tools);
  } catch (err) {
    throw toOllamaError(err);
  }
}
