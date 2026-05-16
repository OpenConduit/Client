import Anthropic from '@anthropic-ai/sdk';
import AnthropicFoundry from '@anthropic-ai/foundry-sdk';
import { McpTool, Message, ModelParameters, ProviderConfig, TokenUsage, ToolCall } from '../../shared/types';

function toAnthropicMessages(messages: Message[]): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = [];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'user') {
      const content: Anthropic.ContentBlockParam[] = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      if (m.attachments) {
        for (const att of m.attachments) {
          if (att.mimeType.startsWith('image/')) {
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: att.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: att.data,
              },
            });
          }
        }
      }
      result.push({ role: 'user' as const, content });
    } else if (m.role === 'assistant') {
      const content: Anthropic.ContentBlockParam[] = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      if (m.toolCalls?.length) {
        // Only include tool_use blocks when the immediately following message is a
        // tool_result that covers those IDs. Orphaned blocks (no result in history,
        // e.g. from a previous session before the store fix) would cause Anthropic
        // to reject the entire request.
        const nextMsg = messages[i + 1];
        const resultIds = new Set(
          nextMsg?.role === 'tool_result' ? (nextMsg.toolCalls ?? []).map((tc) => tc.id) : [],
        );
        const pairedCalls = m.toolCalls.filter((tc) => resultIds.has(tc.id));
        for (const tc of pairedCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.input,
          });
        }
      }
      if (content.length > 0) {
        result.push({ role: 'assistant' as const, content });
      }
    } else if (m.role === 'tool_result') {
      // Anthropic requires tool results as a user message with tool_result blocks
      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = (m.toolCalls ?? []).map((tc) => ({
        type: 'tool_result' as const,
        tool_use_id: tc.id,
        content: typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result ?? ''),
        is_error: tc.isError,
      }));
      if (toolResultBlocks.length) {
        result.push({ role: 'user' as const, content: toolResultBlocks });
      }
    }
  }

  return result;
}

function toAnthropicTools(tools: McpTool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));
}

export async function* streamAnthropic(
  config: ProviderConfig,
  messages: Message[],
  model: string,
  params: ModelParameters,
  systemPrompt: string | undefined,
  tools: McpTool[],
): AsyncGenerator<
  | { type: 'delta'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_calls'; toolCalls: ToolCall[] }
  | { type: 'usage'; usage: TokenUsage }
> {
  const isAzure = !!(config.baseUrl && config.baseUrl.includes('azure.com'));

  // Use the official Azure AI Foundry client when an Azure endpoint is configured
  const client: Anthropic = isAzure
    ? new AnthropicFoundry({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        ...(config.apiVersion ? { apiVersion: config.apiVersion } : {}),
        dangerouslyAllowBrowser: false,
      }) as unknown as Anthropic
    : new Anthropic({
        apiKey: config.apiKey,
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      });

  // Anthropic does not allow both temperature and top_p simultaneously.
  // Prefer temperature; only send top_p if temperature is not set.
  const tempParam = params.temperature !== undefined ? { temperature: params.temperature } : {};
  const topPParam = params.temperature === undefined && params.topP !== undefined ? { top_p: params.topP } : {};

  const streamParams: Anthropic.MessageStreamParams = {
    model,
    max_tokens: params.maxTokens ?? 4096,
    ...tempParam,
    ...topPParam,
    messages: toAnthropicMessages(messages),
    ...(systemPrompt ? { system: systemPrompt } : {}),
    ...(tools.length ? { tools: toAnthropicTools(tools) } : {}),
  };

  const stream = client.messages.stream(streamParams);

  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') {
        yield { type: 'delta', text: event.delta.text };
      } else if (event.delta.type === 'thinking_delta') {
        yield { type: 'thinking', text: (event.delta as { type: string; thinking: string }).thinking };
      }
    }
  }

  const finalMsg = await stream.finalMessage();
  // Emit token usage
  yield {
    type: 'usage',
    usage: {
      inputTokens: finalMsg.usage.input_tokens,
      outputTokens: finalMsg.usage.output_tokens,
      cacheReadTokens: (finalMsg.usage as unknown as Record<string, number>).cache_read_input_tokens ?? 0,
      cacheWriteTokens: (finalMsg.usage as unknown as Record<string, number>).cache_creation_input_tokens ?? 0,
    },
  };
  const toolCalls: ToolCall[] = [];
  for (const block of finalMsg.content) {
    if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
        pending: true,
      });
    }
  }
  if (toolCalls.length) yield { type: 'tool_calls', toolCalls };
}
