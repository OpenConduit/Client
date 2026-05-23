import type { McpTool, Message, ModelParameters, ProviderConfig, ReasoningLevel, TokenUsage, ToolCall } from '../../shared/types';

// ── Copilot JWT token cache ────────────────────────────────────────────────────
// GitHub OAuth token → { token, expiresAt, apiBase }
const tokenCache = new Map<string, { token: string; expiresAt: number; apiBase: string }>();

interface CopilotTokenResponse {
  token: string;
  expires_at: number;
  endpoints?: { api?: string };
}

async function getCopilotTokenAndEndpoint(githubToken: string): Promise<{ token: string; apiBase: string }> {
  const cached = tokenCache.get(githubToken);
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return { token: cached.token, apiBase: cached.apiBase };
  }

  const res = await fetch('https://api.github.com/copilot_internal/v2/token', {
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: 'application/json',
      'Editor-Version': 'vscode/1.90.0',
      'Editor-Plugin-Version': 'GitHub.copilot-chat/0.28.0',
      'User-Agent': 'OpenConduit/2.0',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get Copilot token: ${res.status} ${text}`);
  }

  const data = await res.json() as CopilotTokenResponse;
  const apiBase = data.endpoints?.api ?? 'https://api.githubcopilot.com';
  tokenCache.set(githubToken, { token: data.token, expiresAt: data.expires_at * 1000, apiBase });
  return { token: data.token, apiBase };
}

export async function getCopilotToken(githubToken: string): Promise<string> {
  return (await getCopilotTokenAndEndpoint(githubToken)).token;
}

// ── Device flow auth ──────────────────────────────────────────────────────────

const GITHUB_CLIENT_ID = 'Iv1.b507a08c87ecfe98'; // GitHub Copilot CLI client ID (public)

export interface CopilotDeviceFlowStart {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface CopilotDeviceFlowResult {
  status: 'pending' | 'complete' | 'expired' | 'error';
  token?: string;
  error?: string;
}

export async function startCopilotAuth(): Promise<CopilotDeviceFlowStart> {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, scope: 'read:user' }),
  });
  if (!res.ok) throw new Error(`GitHub device flow failed: ${res.status}`);
  return res.json() as Promise<CopilotDeviceFlowStart>;
}

export async function pollCopilotAuth(deviceCode: string): Promise<CopilotDeviceFlowResult> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });
  if (!res.ok) return { status: 'error', error: `HTTP ${res.status}` };

  const data = await res.json() as { access_token?: string; error?: string };
  if (data.access_token) return { status: 'complete', token: data.access_token };
  if (data.error === 'authorization_pending') return { status: 'pending' };
  if (data.error === 'expired_token') return { status: 'expired' };
  return { status: 'error', error: data.error };
}

// ── Model listing ─────────────────────────────────────────────────────────────

export async function listCopilotModels(githubToken: string): Promise<string[]> {
  const { token, apiBase } = await getCopilotTokenAndEndpoint(githubToken);
  const res = await fetch(`${apiBase}/models`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Copilot-Integration-Id': 'vscode-chat',
      'Editor-Version': 'vscode/1.90.0',
    },
  });
  if (!res.ok) throw new Error(`Copilot models fetch failed: ${res.status}`);
  const data = await res.json() as { data?: Array<{ id: string; capabilities?: { type?: string } }> };
  return (data.data ?? [])
    .filter((m) => m.capabilities?.type === 'chat' || !m.capabilities?.type)
    .map((m) => m.id)
    .sort();
}

// ── Usage / quota ─────────────────────────────────────────────────────────────

export interface CopilotUsage {
  premiumRequestsUsed: number;
  premiumRequestsIncluded: number;
  premiumRequestsPurchased: number;
}

export async function getCopilotUsage(githubToken: string): Promise<CopilotUsage | null> {
  // GitHub exposes usage on different endpoints depending on plan/API version — try both.
  const candidates = [
    'https://api.github.com/user/copilot_billing',
    'https://api.github.com/copilot_internal/v2/billing/usage',
  ];

  for (const url of candidates) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
    } catch { continue; }

    if (!res.ok) continue;

    const data = await res.json() as Record<string, unknown>;
    // Log so we can see what each endpoint actually returns during development
    console.log('[copilot usage]', url, JSON.stringify(data));

    if (typeof data.premium_requests_used === 'number') {
      return {
        premiumRequestsUsed: data.premium_requests_used,
        premiumRequestsIncluded: (data.premium_requests_included as number) ?? 0,
        premiumRequestsPurchased: (data.premium_requests_purchased as number) ?? 0,
      };
    }
  }

  return null;
}

// ── OpenAI-compatible message / tool formatting ───────────────────────────────

type OAIPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

type OAIMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | OAIPart[] }
  | { role: 'assistant'; content: string | null; tool_calls?: OAIToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

interface OAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

function toOAIMessages(messages: Message[], systemPrompt?: string): OAIMessage[] {
  const result: OAIMessage[] = [];
  if (systemPrompt) result.push({ role: 'system', content: systemPrompt });

  for (const m of messages) {
    if (m.role === 'user') {
      const parts: OAIPart[] = [];
      if (m.content) parts.push({ type: 'text', text: m.content });
      for (const att of m.attachments ?? []) {
        if (att.mimeType.startsWith('image/')) {
          parts.push({ type: 'image_url', image_url: { url: `data:${att.mimeType};base64,${att.data}` } });
        } else {
          parts.push({ type: 'text', text: `[Attached file: ${att.name}]\n${att.data}` });
        }
      }
      const content = parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts;
      result.push({ role: 'user', content });
    } else if (m.role === 'assistant') {
      const msg: OAIMessage & { tool_calls?: OAIToolCall[] } = { role: 'assistant', content: m.content || null };
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
        result.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(tc.result ?? '') });
      }
    }
  }
  return result;
}

function toOAITools(tools: McpTool[]) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));
}

// ── Streaming ─────────────────────────────────────────────────────────────────

export async function* streamCopilot(
  config: ProviderConfig,
  messages: Message[],
  model: string,
  params: ModelParameters,
  systemPrompt?: string,
  tools: McpTool[] = [],
  reasoning?: ReasoningLevel,
): AsyncGenerator<
  | { type: 'delta'; text: string }
  | { type: 'tool_calls'; toolCalls: ToolCall[] }
  | { type: 'usage'; usage: TokenUsage }
> {
  const githubToken = config.apiKey ?? '';
  if (!githubToken) throw new Error('GitHub OAuth token not set. Authenticate via Settings → Providers.');

  const { token: copilotToken, apiBase } = await getCopilotTokenAndEndpoint(githubToken);

  const isOSeries = /^o\d/i.test(model);
  const body: Record<string, unknown> = {
    model,
    stream: true,
    stream_options: { include_usage: true },
    messages: toOAIMessages(messages, systemPrompt),
    ...(!isOSeries ? { temperature: params.temperature ?? 0.7, top_p: params.topP } : {}),
    max_completion_tokens: params.maxTokens,
    ...(tools.length ? { tools: toOAITools(tools), tool_choice: 'auto' } : {}),
    ...(isOSeries && reasoning && reasoning !== 'off' ? { reasoning_effort: reasoning } : {}),
  };

  const res = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${copilotToken}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'Copilot-Integration-Id': 'vscode-chat',
      'Editor-Version': 'vscode/1.90.0',
      'Editor-Plugin-Version': 'GitHub.copilot-chat/0.28.0',
      'OpenAI-Intent': 'conversation-ai',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Copilot API error: ${res.status} ${text}`);
  }
  if (!res.body) throw new Error('Copilot API returned no response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  // Accumulate streamed tool call arguments per index slot
  const toolBuffers = new Map<number, { id: string; name: string; args: string }>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') return;

        let chunk: {
          choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
            };
            finish_reason?: string;
          }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        try { chunk = JSON.parse(raw); } catch { continue; }

        const choice = chunk.choices?.[0];
        const delta = choice?.delta;

        if (delta?.content) {
          yield { type: 'delta', text: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (tc.id) {
              toolBuffers.set(idx, { id: tc.id, name: tc.function?.name ?? '', args: '' });
            }
            const slot = toolBuffers.get(idx);
            if (slot) {
              if (tc.function?.name && !tc.id) slot.name = tc.function.name;
              if (tc.function?.arguments) slot.args += tc.function.arguments;
            }
          }
        }

        if (choice?.finish_reason === 'tool_calls' && toolBuffers.size > 0) {
          const toolCalls: ToolCall[] = Array.from(toolBuffers.values()).map((s) => {
            let input: Record<string, unknown> = {};
            try { input = JSON.parse(s.args); } catch { /* keep empty */ }
            return { id: s.id, name: s.name, input };
          });
          yield { type: 'tool_calls', toolCalls };
          toolBuffers.clear();
        }

        if (chunk.usage) {
          yield {
            type: 'usage',
            usage: { inputTokens: chunk.usage.prompt_tokens ?? 0, outputTokens: chunk.usage.completion_tokens ?? 0 },
          };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
