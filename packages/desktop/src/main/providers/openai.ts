import OpenAI from 'openai';
import { McpTool, Message, ModelParameters, ProviderConfig, TokenUsage, ToolCall } from '../../shared/types';

function toOpenAIMessages(
  messages: Message[],
  systemPrompt?: string,
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (systemPrompt) result.push({ role: 'system', content: systemPrompt });
  for (const m of messages) {
    if (m.role === 'user') {
      const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
      if (m.content) parts.push({ type: 'text', text: m.content });
      if (m.attachments) {
        for (const att of m.attachments) {
          if (att.mimeType.startsWith('image/')) {
            parts.push({
              type: 'image_url',
              image_url: { url: `data:${att.mimeType};base64,${att.data}` },
            });
          }
        }
      }
      result.push({ role: 'user', content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts });
    } else if (m.role === 'assistant') {
      const msg: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: m.content || null,
      };
      if (m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.input) },
        }));
      }
      result.push(msg);
    } else if (m.role === 'tool_result') {
      for (const tc of m.toolCalls ?? []) {
        result.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(tc.result ?? ''),
        });
      }
    }
  }
  return result;
}

function toOpenAITools(tools: McpTool[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

export async function* streamOpenAI(
  config: ProviderConfig,
  messages: Message[],
  model: string,
  params: ModelParameters,
  systemPrompt: string | undefined,
  tools: McpTool[],
): AsyncGenerator<{ type: 'delta'; text: string } | { type: 'thinking'; text: string } | { type: 'tool_calls'; toolCalls: ToolCall[] } | { type: 'usage'; usage: TokenUsage }> {
  const client = new OpenAI({
    apiKey: config.apiKey ?? 'lm-studio',
    baseURL: config.baseUrl,
  });

  const stream = await client.chat.completions.create({
    model,
    stream: true,
    stream_options: { include_usage: true },
    temperature: params.temperature,
    top_p: params.topP,
    max_completion_tokens: params.maxTokens,
    messages: toOpenAIMessages(messages, systemPrompt),
    ...(tools.length ? { tools: toOpenAITools(tools), tool_choice: 'auto' } : {}),
  });

  const accumulatedToolCalls: Map<number, { id: string; name: string; args: string }> = new Map();
  let usageData: TokenUsage | null = null;

  for await (const chunk of stream) {
    // OpenAI sends a final chunk with usage when stream_options.include_usage is set
    if (chunk.usage) {
      usageData = {
        inputTokens: chunk.usage.prompt_tokens,
        outputTokens: chunk.usage.completion_tokens,
      };
    }
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;
    if (delta.content) yield { type: 'delta', text: delta.content };
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const existing = accumulatedToolCalls.get(tc.index) ?? { id: '', name: '', args: '' };
        if (tc.id) existing.id = tc.id;
        if (tc.function?.name) existing.name = tc.function.name;
        if (tc.function?.arguments) existing.args += tc.function.arguments;
        accumulatedToolCalls.set(tc.index, existing);
      }
    }
  }

  if (usageData) yield { type: 'usage', usage: usageData };

  if (accumulatedToolCalls.size > 0) {
    const toolCalls: ToolCall[] = [];
    for (const [, tc] of accumulatedToolCalls) {
      let input: Record<string, unknown> = {};
      try { input = JSON.parse(tc.args); } catch { /* ignore */ }
      toolCalls.push({ id: tc.id, name: tc.name, input, pending: true });
    }
    yield { type: 'tool_calls', toolCalls };
  }
}
