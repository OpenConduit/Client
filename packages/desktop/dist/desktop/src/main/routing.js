/**
 * Intelligent model routing — main-process evaluator.
 *
 * Makes a single non-streaming call to a cheap "router" model that classifies
 * the user's message, then applies tier and/or provider routing rules to
 * select the final provider + model for the actual chat request.
 */
import { normalizeOllamaBaseUrl, toOllamaModelId } from './providers/ollama';
const ROUTER_PROMPT = `You are a routing classifier. Analyze the user message and respond with ONLY a valid JSON object — no other text.

{
  "complexity": <number 1|2|3>,
  "taskType": <"writing"|"code"|"tools"|"reasoning"|"general">
}

Complexity scoring:
  1 = Simple: factual lookup, casual chat, short translation, basic arithmetic
  2 = Moderate: multi-step explanation, code with a few functions, summarisation, structured output
  3 = Complex: deep reasoning chains, research-level analysis, large codebases, multi-agent planning

Task type:
  writing   = creative or professional writing, editing, copywriting
  code      = programming, debugging, technical architecture
  tools     = requests that require external tools / function calls / web search
  reasoning = logical/mathematical reasoning, analysis, decision-making
  general   = everything else`;
async function classifyWithOpenAI(provider, model, userMessage) {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({
        apiKey: provider.apiKey ?? 'lm-studio',
        baseURL: provider.type === 'lmstudio'
            ? (provider.baseUrl ?? 'http://localhost:1234').replace(/\/v1\/?$/, '') + '/v1'
            : provider.type === 'ollama'
                ? normalizeOllamaBaseUrl(provider.baseUrl)
                : provider.baseUrl,
    });
    const response = await client.chat.completions.create({
        model: provider.type === 'ollama' ? toOllamaModelId(model) : model,
        messages: [
            { role: 'system', content: ROUTER_PROMPT },
            { role: 'user', content: userMessage },
        ],
        max_tokens: 60,
        temperature: 0,
        // Only send response_format for real OpenAI — LM Studio and other
        // compatible servers often return 400 for this parameter.
        ...(provider.type === 'openai' ? { response_format: { type: 'json_object' } } : {}),
    });
    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(extractJson(raw));
    return {
        complexity: parsed.complexity ?? 1,
        taskType: parsed.taskType ?? 'general',
    };
}
async function classifyWithAnthropic(provider, model, userMessage) {
    const prompt = `${ROUTER_PROMPT}\n\nUser message: ${userMessage}`;
    if (provider.apiVersion) {
        // Azure AI Foundry endpoint
        const AnthropicFoundry = (await import('@anthropic-ai/foundry-sdk')).default;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = new AnthropicFoundry({
            apiKey: provider.apiKey,
            baseURL: provider.baseUrl,
            ...(provider.apiVersion ? { apiVersion: provider.apiVersion } : {}),
        });
        const response = await client.messages.create({
            model,
            max_tokens: 60,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
        });
        const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
        const parsed = JSON.parse(extractJson(text));
        return { complexity: parsed.complexity ?? 1, taskType: parsed.taskType ?? 'general' };
    }
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: provider.apiKey });
    const response = await client.messages.create({
        model,
        max_tokens: 60,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
    });
    const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
    const parsed = JSON.parse(extractJson(text));
    return { complexity: parsed.complexity ?? 1, taskType: parsed.taskType ?? 'general' };
}
async function classifyWithGemini(provider, model, userMessage) {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: provider.apiKey ?? '' });
    const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: `${ROUTER_PROMPT}\n\nUser message: ${userMessage}` }] }],
        config: { maxOutputTokens: 60, temperature: 0 },
    });
    const text = response.text ?? '{}';
    const parsed = JSON.parse(extractJson(text));
    return { complexity: parsed.complexity ?? 1, taskType: parsed.taskType ?? 'general' };
}
/** Extract the first {...} block from a string (guards against prose wrapper) */
function extractJson(text) {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : '{}';
}
export async function evaluateRouting(params) {
    const { message, routerProvider, routerModel, config, originalProviderId, originalModel } = params;
    let classification = { complexity: 1, taskType: 'general' };
    try {
        if (routerProvider.type === 'openai' ||
            routerProvider.type === 'lmstudio' ||
            routerProvider.type === 'ollama') {
            classification = await classifyWithOpenAI(routerProvider, routerModel, message);
        }
        else if (routerProvider.type === 'anthropic') {
            classification = await classifyWithAnthropic(routerProvider, routerModel, message);
        }
        else if (routerProvider.type === 'gemini') {
            classification = await classifyWithGemini(routerProvider, routerModel, message);
        }
    }
    catch (err) {
        // Classification failed — fall back to original model, no override
        const msg = err instanceof Error ? err.message : String(err);
        return {
            complexity: 1,
            taskType: 'general',
            finalProviderId: originalProviderId,
            finalModel: originalModel,
            originalProviderId,
            originalModel,
            reason: `Router error: ${msg}`,
        };
    }
    // Clamp complexity to valid range
    const complexity = Math.max(1, Math.min(3, Math.round(classification.complexity)));
    const taskType = classification.taskType ?? 'general';
    let finalProviderId = originalProviderId;
    let finalModel = originalModel;
    let reason = '';
    // ── 1. Provider routing (task type) ── takes precedence when enabled ────
    if (config.providerRouting?.enabled && config.providerRouting.rules.length > 0) {
        const rule = config.providerRouting.rules.find((r) => r.taskType === taskType);
        if (rule && rule.providerId && rule.model) {
            finalProviderId = rule.providerId;
            finalModel = rule.model;
            reason = `Task type "${taskType}" → provider rule`;
        }
    }
    // ── 2. Tier routing (complexity) ── overrides provider routing if configured ──
    if (config.tierRouting?.enabled && config.tierRouting.tiers.length > 0) {
        // Sort desc by minComplexity, first tier whose minComplexity ≤ complexity wins
        const sorted = [...config.tierRouting.tiers].sort((a, b) => b.minComplexity - a.minComplexity);
        const tier = sorted.find((t) => complexity >= t.minComplexity);
        if (tier && tier.providerId && tier.model) {
            finalProviderId = tier.providerId;
            finalModel = tier.model;
            reason = reason
                ? `Complexity ${complexity} + task "${taskType}" → tier`
                : `Complexity ${complexity} → ${tier.label || 'tier'}`; // || catches empty string
        }
    }
    if (!reason) {
        reason = `Complexity ${complexity}, task "${taskType}" — no rule matched, using default`;
    }
    return {
        complexity,
        taskType,
        finalProviderId,
        finalModel,
        originalProviderId,
        originalModel,
        reason,
    };
}
//# sourceMappingURL=routing.js.map