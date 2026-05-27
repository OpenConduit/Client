import Anthropic from '@anthropic-ai/sdk';
import AnthropicFoundry from '@anthropic-ai/foundry-sdk';
import { AnthropicThinkingBlock, McpTool, Message, ModelParameters, ProviderConfig, ReasoningLevel, TokenUsage, ToolCall } from '../../shared/types';

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
          } else if (att.mimeType === 'application/pdf' && att.data) {
            content.push({
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: att.data },
            } as Anthropic.DocumentBlockParam);
          } else if (att.data) {
            content.push({ type: 'text', text: `[Attached file: ${att.name}]\n${att.data}` });
          }
        }
      }
      result.push({ role: 'user' as const, content });
    } else if (m.role === 'assistant') {
      const content: Anthropic.ContentBlockParam[] = [];
      // Re-include thinking blocks FIRST — Anthropic requires them verbatim with their signature.
      if (m.thinkingBlocks?.length) {
        for (const block of m.thinkingBlocks) {
          content.push(block as unknown as Anthropic.ContentBlockParam);
        }
      }
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
        // Deduplicate by ID — guard against stored conversations that may have
        // accumulated duplicate tool call entries (same ID, raw + completed).
        const seenToolUse = new Set<string>();
        const pairedCalls = m.toolCalls.filter((tc) => {
          if (resultIds.has(tc.id) && !seenToolUse.has(tc.id)) {
            seenToolUse.add(tc.id);
            return true;
          }
          return false;
        });
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
      // Anthropic requires tool results as a user message with tool_result blocks.
      // Only include results whose tool_use_id actually appears in the preceding
      // assistant message — guards against orphaned results when the history is
      // truncated and the corresponding tool_use block was dropped.
      const prevMsg = result[result.length - 1];
      const prevToolUseIds = new Set<string>(
        prevMsg?.role === 'assistant'
          ? (prevMsg.content as Anthropic.ContentBlockParam[])
              .filter((b): b is Anthropic.ToolUseBlockParam => b.type === 'tool_use')
              .map((b) => b.id)
          : [],
      );
      // Also deduplicate tool_result blocks — same guard as pairedCalls above.
      const seenResultIds = new Set<string>();
      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = (m.toolCalls ?? [])
        .filter((tc) => {
          if (prevToolUseIds.has(tc.id) && !seenResultIds.has(tc.id)) {
            seenResultIds.add(tc.id);
            return true;
          }
          return false;
        })
        .map((tc) => ({
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
  reasoning?: ReasoningLevel,
): AsyncGenerator<
  | { type: 'delta'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'thinking_blocks'; blocks: AnthropicThinkingBlock[] }
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
  // When extended thinking is enabled temperature must be 1 (API requirement).
  const thinkingBudget: Record<ReasoningLevel, number> = { off: 0, low: 2000, medium: 8000, high: 20000 };
  const thinkingEnabled = !!reasoning && reasoning !== 'off';
  const tempParam = thinkingEnabled ? { temperature: 1 } : (params.temperature !== undefined ? { temperature: params.temperature } : {});
  const topPParam = !thinkingEnabled && params.temperature === undefined && params.topP !== undefined ? { top_p: params.topP } : {};

  const budget = thinkingEnabled ? thinkingBudget[reasoning!] : 0;
  const maxTokens = Math.max(params.maxTokens ?? 4096, budget + 1000);

  const streamParams: Anthropic.MessageStreamParams = {
    model,
    max_tokens: maxTokens,
    ...tempParam,
    ...topPParam,
    messages: toAnthropicMessages(messages),
    ...(systemPrompt ? { system: systemPrompt } : {}),
    ...(tools.length ? { tools: toAnthropicTools(tools) } : {}),
    ...(thinkingEnabled ? { thinking: { type: 'enabled', budget_tokens: thinkingBudget[reasoning!] } } : {}),
  } as Anthropic.MessageStreamParams;

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
  const thinkingBlocks: AnthropicThinkingBlock[] = [];
  for (const block of finalMsg.content) {
    if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
        pending: true,
      });
    } else if (block.type === 'thinking') {
      thinkingBlocks.push({ type: 'thinking', thinking: block.thinking, signature: block.signature });
    } else if (block.type === 'redacted_thinking') {
      thinkingBlocks.push({ type: 'redacted_thinking', data: (block as unknown as { data: string }).data });
    }
  }
  if (thinkingBlocks.length) yield { type: 'thinking_blocks', blocks: thinkingBlocks };
  if (toolCalls.length) yield { type: 'tool_calls', toolCalls };
}
