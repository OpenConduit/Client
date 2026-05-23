import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  type ContentBlock,
  type Message as BedrockMessage,
  type Tool as BedrockTool,
} from '@aws-sdk/client-bedrock-runtime';
import type { McpTool, Message, ModelParameters, ProviderConfig, TokenUsage, ToolCall } from '../../shared/types';

function toBedrockMessages(messages: Message[]): BedrockMessage[] {
  const result: BedrockMessage[] = [];

  for (const m of messages) {
    if (m.role === 'user') {
      const content: ContentBlock[] = [];
      if (m.content) content.push({ text: m.content });
      if (m.attachments) {
        for (const att of m.attachments) {
          if (att.mimeType.startsWith('image/')) {
            const rawFmt = att.mimeType.split('/')[1];
            const fmt = (rawFmt === 'jpg' ? 'jpeg' : rawFmt) as 'jpeg' | 'png' | 'gif' | 'webp';
            content.push({
              image: {
                format: fmt,
                source: { bytes: Buffer.from(att.data, 'base64') },
              },
            });
          } else {
            content.push({ text: `[Attached file: ${att.name}]\n${att.data}` });
          }
        }
      }
      if (content.length) result.push({ role: 'user', content });
    } else if (m.role === 'assistant') {
      const content: ContentBlock[] = [];
      if (m.content) content.push({ text: m.content });
      if (m.toolCalls?.length) {
        for (const tc of m.toolCalls) {
          content.push({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            toolUse: { toolUseId: tc.id, name: tc.name, input: tc.input as any },
          });
        }
      }
      if (content.length) result.push({ role: 'assistant', content });
    } else if (m.role === 'tool_result') {
      const content: ContentBlock[] = [];
      for (const tc of m.toolCalls ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content.push({ toolResult: { toolUseId: tc.id, content: [{ text: JSON.stringify(tc.result ?? '') }] } } as any);
      }
      if (content.length) result.push({ role: 'user', content });
    }
  }

  return result;
}

function toBedrockTools(tools: McpTool[]): BedrockTool[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tools.map((t) => ({
    toolSpec: {
      name: t.name,
      description: t.description,
      inputSchema: { json: t.inputSchema },
    },
  } as any) as BedrockTool);
}

export async function* streamBedrock(
  config: ProviderConfig,
  messages: Message[],
  model: string,
  params: ModelParameters,
  systemPrompt?: string,
  tools: McpTool[] = [],
): AsyncGenerator<
  | { type: 'delta'; text: string }
  | { type: 'tool_calls'; toolCalls: ToolCall[] }
  | { type: 'usage'; usage: TokenUsage }
> {
  const region = config.baseUrl || 'us-east-1';
  const client = new BedrockRuntimeClient({
    region,
    credentials: {
      accessKeyId: config.apiKey ?? '',
      secretAccessKey: config.apiSecret ?? '',
    },
  });

  const bedrockMessages = toBedrockMessages(messages);
  const bedrockTools = tools.length ? toBedrockTools(tools) : undefined;

  const command = new ConverseStreamCommand({
    modelId: model,
    messages: bedrockMessages,
    system: systemPrompt ? [{ text: systemPrompt }] : undefined,
    inferenceConfig: {
      maxTokens: params.maxTokens ?? 4096,
      temperature: params.temperature ?? 1.0,
    },
    toolConfig: bedrockTools ? { tools: bedrockTools } : undefined,
  });

  const response = await client.send(command);
  if (!response.stream) return;

  // Accumulate tool input JSON per content block index
  const toolBlocks: Map<number, { id: string; name: string; inputJson: string }> = new Map();

  for await (const event of response.stream) {
    if (event.contentBlockStart?.start?.toolUse) {
      const { toolUseId, name } = event.contentBlockStart.start.toolUse;
      const idx = event.contentBlockStart.contentBlockIndex ?? 0;
      toolBlocks.set(idx, { id: toolUseId ?? '', name: name ?? '', inputJson: '' });
    } else if (event.contentBlockDelta?.delta) {
      const delta = event.contentBlockDelta.delta;
      const idx = event.contentBlockDelta.contentBlockIndex ?? 0;
      if (delta.text !== undefined) {
        yield { type: 'delta', text: delta.text };
      } else if (delta.toolUse?.input !== undefined) {
        const block = toolBlocks.get(idx);
        if (block) block.inputJson += delta.toolUse.input;
      }
    } else if (event.contentBlockStop !== undefined) {
      const idx = event.contentBlockStop.contentBlockIndex ?? 0;
      const block = toolBlocks.get(idx);
      if (block) {
        let input: unknown = {};
        try { input = JSON.parse(block.inputJson); } catch { /* empty input */ }
        yield {
          type: 'tool_calls',
          toolCalls: [{ id: block.id, name: block.name, input: input as Record<string, unknown> }],
        };
        toolBlocks.delete(idx);
      }
    } else if (event.metadata?.usage) {
      yield {
        type: 'usage',
        usage: {
          inputTokens: event.metadata.usage.inputTokens ?? 0,
          outputTokens: event.metadata.usage.outputTokens ?? 0,
        },
      };
    }
  }
}
