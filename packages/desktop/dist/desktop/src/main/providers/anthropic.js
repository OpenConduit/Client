import Anthropic from '@anthropic-ai/sdk';
import AnthropicFoundry from '@anthropic-ai/foundry-sdk';
function toAnthropicMessages(messages) {
    const result = [];
    for (let i = 0; i < messages.length; i++) {
        const m = messages[i];
        if (m.role === 'user') {
            const content = [];
            if (m.content)
                content.push({ type: 'text', text: m.content });
            if (m.attachments) {
                for (const att of m.attachments) {
                    if (att.mimeType.startsWith('image/')) {
                        content.push({
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: att.mimeType,
                                data: att.data,
                            },
                        });
                    }
                    else if (att.mimeType === 'application/pdf' && att.data) {
                        content.push({
                            type: 'document',
                            source: { type: 'base64', media_type: 'application/pdf', data: att.data },
                        });
                    }
                    else if (att.data) {
                        content.push({ type: 'text', text: `[Attached file: ${att.name}]\n${att.data}` });
                    }
                }
            }
            result.push({ role: 'user', content });
        }
        else if (m.role === 'assistant') {
            const content = [];
            if (m.content)
                content.push({ type: 'text', text: m.content });
            if (m.toolCalls?.length) {
                // Only include tool_use blocks when the immediately following message is a
                // tool_result that covers those IDs. Orphaned blocks (no result in history,
                // e.g. from a previous session before the store fix) would cause Anthropic
                // to reject the entire request.
                const nextMsg = messages[i + 1];
                const resultIds = new Set(nextMsg?.role === 'tool_result' ? (nextMsg.toolCalls ?? []).map((tc) => tc.id) : []);
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
                result.push({ role: 'assistant', content });
            }
        }
        else if (m.role === 'tool_result') {
            // Anthropic requires tool results as a user message with tool_result blocks
            const toolResultBlocks = (m.toolCalls ?? []).map((tc) => ({
                type: 'tool_result',
                tool_use_id: tc.id,
                content: typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result ?? ''),
                is_error: tc.isError,
            }));
            if (toolResultBlocks.length) {
                result.push({ role: 'user', content: toolResultBlocks });
            }
        }
    }
    return result;
}
function toAnthropicTools(tools) {
    return tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
    }));
}
export async function* streamAnthropic(config, messages, model, params, systemPrompt, tools) {
    const isAzure = !!(config.baseUrl && config.baseUrl.includes('azure.com'));
    // Use the official Azure AI Foundry client when an Azure endpoint is configured
    const client = isAzure
        ? new AnthropicFoundry({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
            ...(config.apiVersion ? { apiVersion: config.apiVersion } : {}),
            dangerouslyAllowBrowser: false,
        })
        : new Anthropic({
            apiKey: config.apiKey,
            ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
        });
    // Anthropic does not allow both temperature and top_p simultaneously.
    // Prefer temperature; only send top_p if temperature is not set.
    const tempParam = params.temperature !== undefined ? { temperature: params.temperature } : {};
    const topPParam = params.temperature === undefined && params.topP !== undefined ? { top_p: params.topP } : {};
    const streamParams = {
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
            }
            else if (event.delta.type === 'thinking_delta') {
                yield { type: 'thinking', text: event.delta.thinking };
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
            cacheReadTokens: finalMsg.usage.cache_read_input_tokens ?? 0,
            cacheWriteTokens: finalMsg.usage.cache_creation_input_tokens ?? 0,
        },
    };
    const toolCalls = [];
    for (const block of finalMsg.content) {
        if (block.type === 'tool_use') {
            toolCalls.push({
                id: block.id,
                name: block.name,
                input: block.input,
                pending: true,
            });
        }
    }
    if (toolCalls.length)
        yield { type: 'tool_calls', toolCalls };
}
//# sourceMappingURL=anthropic.js.map