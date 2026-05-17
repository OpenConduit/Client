import { GoogleGenAI } from '@google/genai';
import type { McpTool, Message, ModelParameters, ProviderConfig, TokenUsage, ToolCall } from '../../shared/types';

type GeminiContent = {
  role: 'user' | 'model';
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
};

function toGeminiContents(messages: Message[]): GeminiContent[] {
  const result: GeminiContent[] = [];

  for (const m of messages) {
    if (m.role === 'user') {
      const parts: GeminiContent['parts'] = [];
      if (m.content) parts.push({ text: m.content });
      if (m.attachments) {
        for (const att of m.attachments) {
          if (att.mimeType.startsWith('image/')) {
            parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
          }
        }
      }
      if (parts.length) result.push({ role: 'user', parts });
    } else if (m.role === 'assistant' && m.content) {
      result.push({ role: 'model', parts: [{ text: m.content }] });
    }
    // tool_result messages are skipped — Gemini tool use handled separately
  }

  return result;
}

function toGeminiTools(tools: McpTool[]): object[] {
  if (!tools.length) return [];
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      })),
    },
  ];
}

export async function* streamGemini(
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
  const ai = new GoogleGenAI({
    apiKey: config.apiKey ?? '',
    ...(config.baseUrl ? { httpOptions: { baseUrl: config.baseUrl } } : {}),
  });

  const contents = toGeminiContents(messages);
  const geminiTools = toGeminiTools(tools);

  const stream = await ai.models.generateContentStream({
    model,
    contents,
    config: {
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
      temperature: params.temperature,
      topP: params.topP,
      ...(params.maxTokens ? { maxOutputTokens: params.maxTokens } : {}),
      ...(geminiTools.length ? { tools: geminiTools } : {}),
    },
  });

  let usageEmitted = false;

  for await (const chunk of stream) {
    const candidate = chunk.candidates?.[0];
    if (!candidate) continue;

    // Text delta
    const text = candidate.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (text) yield { type: 'delta', text };

    // Thinking (not natively supported by Gemini yet, reserved for future)

    // Function calls
    const fnCalls = candidate.content?.parts?.filter((p) => p.functionCall) ?? [];
    if (fnCalls.length) {
      const toolCalls: ToolCall[] = fnCalls.map((p) => ({
        id: crypto.randomUUID(),
        name: p.functionCall!.name ?? '',
        input: (p.functionCall!.args ?? {}) as Record<string, unknown>,
        result: null as unknown,
        isError: false,
      }));
      yield { type: 'tool_calls', toolCalls };
    }

    // Usage — emit once from the final chunk
    if (!usageEmitted && chunk.usageMetadata) {
      const u = chunk.usageMetadata;
      if (u.promptTokenCount != null && u.candidatesTokenCount != null) {
        usageEmitted = true;
        yield {
          type: 'usage',
          usage: {
            inputTokens: u.promptTokenCount,
            outputTokens: u.candidatesTokenCount,
          } satisfies TokenUsage,
        };
      }
    }
  }
}
