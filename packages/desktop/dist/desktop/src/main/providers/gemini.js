import { GoogleGenAI } from '@google/genai';
function toGeminiContents(messages) {
    const result = [];
    for (const m of messages) {
        if (m.role === 'user') {
            const parts = [];
            if (m.content)
                parts.push({ text: m.content });
            if (m.attachments) {
                for (const att of m.attachments) {
                    if (att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf') {
                        // Images and PDFs both supported as inlineData by Gemini 1.5+
                        parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
                    }
                    else if (att.data) {
                        parts.push({ text: `[Attached file: ${att.name}]\n${att.data}` });
                    }
                }
            }
            if (parts.length)
                result.push({ role: 'user', parts });
        }
        else if (m.role === 'assistant' && m.content) {
            result.push({ role: 'model', parts: [{ text: m.content }] });
        }
        // tool_result messages are skipped — Gemini tool use handled separately
    }
    return result;
}
function toGeminiTools(tools) {
    if (!tools.length)
        return [];
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
export async function* streamGemini(config, messages, model, params, systemPrompt, tools) {
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
        if (!candidate)
            continue;
        // Text delta
        const text = candidate.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
        if (text)
            yield { type: 'delta', text };
        // Thinking (not natively supported by Gemini yet, reserved for future)
        // Function calls
        const fnCalls = candidate.content?.parts?.filter((p) => p.functionCall) ?? [];
        if (fnCalls.length) {
            const toolCalls = fnCalls.map((p) => ({
                id: crypto.randomUUID(),
                name: p.functionCall.name ?? '',
                input: (p.functionCall.args ?? {}),
                result: null,
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
                    },
                };
            }
        }
    }
}
//# sourceMappingURL=gemini.js.map