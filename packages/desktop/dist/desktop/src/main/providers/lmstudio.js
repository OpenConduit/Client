// LM Studio uses the OpenAI-compatible API — we just re-export with a default base URL
import { streamOpenAI } from './openai';
function normalizeLmStudioBaseUrl(url) {
    const base = (url ?? 'http://localhost:1234').replace(/\/v1\/?$/, '');
    return `${base}/v1`;
}
export async function* streamLmStudio(config, messages, model, params, systemPrompt, tools) {
    const lmConfig = {
        ...config,
        apiKey: config.apiKey ?? 'lm-studio',
        baseUrl: normalizeLmStudioBaseUrl(config.baseUrl),
    };
    yield* streamOpenAI(lmConfig, messages, model, params, systemPrompt, tools);
}
//# sourceMappingURL=lmstudio.js.map