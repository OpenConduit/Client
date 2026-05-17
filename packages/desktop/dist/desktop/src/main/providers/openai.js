import OpenAI from 'openai';
async function pdfToText(base64) {
    try {
        const buf = Buffer.from(base64, 'base64');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod = await import('pdf-parse');
        const parse = mod.default ?? mod;
        const result = await parse(buf);
        return result.text;
    }
    catch {
        return '[PDF text could not be extracted]';
    }
}
function toOpenAIMessages(messages, systemPrompt) {
    const result = [];
    if (systemPrompt)
        result.push({ role: 'system', content: systemPrompt });
    for (const m of messages) {
        if (m.role === 'user') {
            const parts = [];
            if (m.content)
                parts.push({ type: 'text', text: m.content });
            if (m.attachments) {
                for (const att of m.attachments) {
                    if (att.mimeType.startsWith('image/')) {
                        parts.push({
                            type: 'image_url',
                            image_url: { url: `data:${att.mimeType};base64,${att.data}` },
                        });
                    }
                    else if (att.data) {
                        // PDFs arrive pre-converted to text (see pre-processing in streamOpenAI)
                        parts.push({ type: 'text', text: `[Attached file: ${att.name}]\n${att.data}` });
                    }
                }
            }
            result.push({ role: 'user', content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts });
        }
        else if (m.role === 'assistant') {
            const msg = {
                role: 'assistant',
                content: m.content || null,
            };
            if (m.toolCalls?.length) {
                msg.tool_calls = m.toolCalls.map((tc) => ({
                    id: tc.id,
                    type: 'function',
                    function: { name: tc.name, arguments: JSON.stringify(tc.input) },
                }));
            }
            result.push(msg);
        }
        else if (m.role === 'tool_result') {
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
function toOpenAITools(tools) {
    return tools.map((t) => ({
        type: 'function',
        function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema,
        },
    }));
}
export async function* streamOpenAI(config, messages, model, params, systemPrompt, tools) {
    // OpenAI doesn't support native PDF — pre-process messages to extract text
    const processedMessages = await Promise.all(messages.map(async (m) => {
        if (m.role !== 'user' || !m.attachments?.some((a) => a.mimeType === 'application/pdf'))
            return m;
        const attachments = await Promise.all(m.attachments.map(async (att) => {
            if (att.mimeType !== 'application/pdf' || !att.data)
                return att;
            const text = await pdfToText(att.data);
            return { ...att, mimeType: 'text/plain', data: text };
        }));
        return { ...m, attachments };
    }));
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
        messages: toOpenAIMessages(processedMessages, systemPrompt),
        ...(tools.length ? { tools: toOpenAITools(tools), tool_choice: 'auto' } : {}),
    });
    const accumulatedToolCalls = new Map();
    let usageData = null;
    for await (const chunk of stream) {
        // OpenAI sends a final chunk with usage when stream_options.include_usage is set
        if (chunk.usage) {
            usageData = {
                inputTokens: chunk.usage.prompt_tokens,
                outputTokens: chunk.usage.completion_tokens,
            };
        }
        const delta = chunk.choices[0]?.delta;
        if (!delta)
            continue;
        if (delta.content)
            yield { type: 'delta', text: delta.content };
        if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
                const existing = accumulatedToolCalls.get(tc.index) ?? { id: '', name: '', args: '' };
                if (tc.id)
                    existing.id = tc.id;
                if (tc.function?.name)
                    existing.name = tc.function.name;
                if (tc.function?.arguments)
                    existing.args += tc.function.arguments;
                accumulatedToolCalls.set(tc.index, existing);
            }
        }
    }
    if (usageData)
        yield { type: 'usage', usage: usageData };
    if (accumulatedToolCalls.size > 0) {
        const toolCalls = [];
        for (const [, tc] of accumulatedToolCalls) {
            let input = {};
            try {
                input = JSON.parse(tc.args);
            }
            catch { /* ignore */ }
            toolCalls.push({ id: tc.id, name: tc.name, input, pending: true });
        }
        yield { type: 'tool_calls', toolCalls };
    }
}
//# sourceMappingURL=openai.js.map