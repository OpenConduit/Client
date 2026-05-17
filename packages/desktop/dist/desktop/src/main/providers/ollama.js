import { streamOpenAI } from './openai';
export function normalizeOllamaBaseUrl(url) {
    const base = (url ?? 'http://localhost:11434').replace(/\/v1\/?$/, '');
    return `${base}/v1`;
}
export function toOllamaModelId(model) {
    return model.replace(/\s+·\s+.+$/, '').trim();
}
function toOllamaError(err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|fetch failed|Failed to fetch|Connection error|404/.test(message)) {
        return new Error('Ollama not detected — download at ollama.com');
    }
    return err instanceof Error ? err : new Error(message);
}
export async function* streamOllama(config, messages, model, params, systemPrompt, tools) {
    const ollamaConfig = {
        ...config,
        apiKey: config.apiKey ?? 'ollama',
        baseUrl: normalizeOllamaBaseUrl(config.baseUrl),
    };
    try {
        yield* streamOpenAI(ollamaConfig, messages, toOllamaModelId(model), params, systemPrompt, tools);
    }
    catch (err) {
        throw toOllamaError(err);
    }
}
//# sourceMappingURL=ollama.js.map