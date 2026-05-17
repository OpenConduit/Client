import { BrowserWindow, ipcMain, WebContents, app, shell, dialog } from 'electron';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import {
  IPC,
  ChatRequest,
  AppSettings,
  McpServerConfig,
  Message,
  ToolCall,
  StreamChunk,
  StreamEnd,
  StreamError,
  ToolApprovalRequest,
  UpdateInfo,
  FeedbackPayload,
} from '../shared/types';
import { getSettings, setSettings } from './store/settings';
import {
  connectMcpServer,
  disconnectMcpServer,
  listAllTools,
  callTool,
  getMcpStatus,
} from './mcp/client';
import { streamAnthropic } from './providers/anthropic';
import { streamOpenAI } from './providers/openai';
import { streamLmStudio } from './providers/lmstudio';
import { streamGemini } from './providers/gemini';

const abortControllers = new Map<string, AbortController>();
const pendingApprovals = new Map<string, (approved: boolean) => void>();

export function registerIpcHandlers(): void {
  // Tool approval responses
  ipcMain.on(
    IPC.TOOL_APPROVAL_RESPONSE,
    (_e, { toolId, approved }: { toolId: string; approved: boolean }) => {
      const resolve = pendingApprovals.get(toolId);
      if (resolve) {
        pendingApprovals.delete(toolId);
        resolve(approved);
      }
    },
  );

  // ─── Settings ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.SETTINGS_GET, () => getSettings());
  ipcMain.handle(IPC.SETTINGS_SET, (_e, partial: Partial<AppSettings>) =>
    setSettings(partial),
  );

  // ─── MCP ─────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.MCP_CONNECT, async (_e, config: McpServerConfig) => {
    await connectMcpServer(config);
  });
  ipcMain.handle(IPC.MCP_DISCONNECT, async (_e, id: string) => {
    await disconnectMcpServer(id);
  });
  ipcMain.handle(IPC.MCP_LIST_TOOLS, async (_e, serverIds: string[]) => {
    return listAllTools(serverIds);
  });
  ipcMain.handle(IPC.MCP_STATUS, () => getMcpStatus());

  // ─── Models ──────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.MODELS_LIST, async (_e, providerId: string) => {
    const settings = getSettings();
    const provider = settings.providers.find((p) => p.id === providerId);
    if (!provider) return [];

    if (provider.type === 'openai' || provider.type === 'lmstudio') {
      try {
        const OpenAI = (await import('openai')).default;
        const lmBaseUrl =
          provider.type === 'lmstudio'
            ? (provider.baseUrl ?? 'http://localhost:1234').replace(/\/v1\/?$/, '') + '/v1'
            : provider.baseUrl;
        const client = new OpenAI({
          apiKey: provider.apiKey ?? 'lm-studio',
          baseURL: lmBaseUrl,
        });
        const models = await client.models.list();
        return models.data.map((m: { id: string }) => m.id).sort();
      } catch {
        return [];
      }
    }

    if (provider.type === 'anthropic') {
      const custom = provider.customModels ?? [];
      try {
        const isAzure = !!(provider.baseUrl?.includes('azure.com'));
        let client;
        if (isAzure) {
          const AnthropicFoundry = (await import('@anthropic-ai/foundry-sdk')).default;
          client = new AnthropicFoundry({
            apiKey: provider.apiKey,
            baseURL: provider.baseUrl,
            ...(provider.apiVersion ? { apiVersion: provider.apiVersion } : {}),
          });
        } else {
          const Anthropic = (await import('@anthropic-ai/sdk')).default;
          client = new Anthropic({
            apiKey: provider.apiKey,
            ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
          });
        }
        const page = await client.models.list({ limit: 100 });
        const fetched = page.data.map((m: { id: string }) => m.id);
        const merged = Array.from(new Set([...fetched, ...custom])).sort();
        return merged;
      } catch {
        return custom;
      }
    }

    if (provider.type === 'gemini') {
      const custom = provider.customModels ?? [];
      const defaults = [
        'gemini-2.5-pro-preview-05-06',
        'gemini-2.5-flash-preview-04-17',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
      ];
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: provider.apiKey ?? '' });
        const fetched: string[] = [];
        for await (const m of await ai.models.list()) {
          const name = (m as { name?: string }).name;
          if (name) fetched.push(name.replace('models/', ''));
        }
        if (fetched.length > 0) {
          return Array.from(new Set([...fetched, ...custom])).sort();
        }
      } catch { /* fall through */ }
      return Array.from(new Set([...defaults, ...custom])).sort();
    }

    return provider.customModels ?? [];
  });

  ipcMain.handle(IPC.OPEN_EXTERNAL, async (_e, url: string): Promise<void> => {
    // Validate it's a proper https URL before opening
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Only http/https URLs are allowed');
    }
    await shell.openExternal(url);
  });

  // ─── Settings Export / Import ───────────────────────────────────────────────
  ipcMain.handle(IPC.SETTINGS_EXPORT, async (_e, redact: boolean): Promise<boolean> => {
    const win = BrowserWindow.getFocusedWindow();
    const suffix = redact ? 'ai-chat-settings-clean.json' : 'ai-chat-settings-full.json';
    const { canceled, filePath: dest } = await dialog.showSaveDialog(win!, {
      title: redact ? 'Export Settings (no API keys)' : 'Export Settings (full)',
      defaultPath: suffix,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !dest) return false;
    const settings = getSettings();
    const output = redact
      ? {
          ...settings,
          providers: settings.providers.map(({ apiKey: _k, ...rest }) => rest),
          mcpServers: settings.mcpServers.map(({ headers: _h, env: _e, ...rest }) => rest),
        }
      : settings;
    await fs.writeFile(dest, JSON.stringify(output, null, 2), 'utf-8');
    return true;
  });

  ipcMain.handle(IPC.SETTINGS_IMPORT, async (_e): Promise<AppSettings | null> => {
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: 'Import Settings',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return null;
    const raw = await fs.readFile(filePaths[0], 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    // Basic sanity check — must have at least the providers array
    if (!Array.isArray(parsed.providers)) throw new Error('Invalid settings file');
    return setSettings(parsed);
  });

  // ─── Backend constants (not user-configurable) ────────────────────────────
  const GITHUB_REPO = 'OpenConduit/Client';
  // Set WORKER_URL to your deployed Cloudflare Worker once live; leave empty to use GitHub directly.
  const WORKER_URL = 'https://openconduit.chumchal-account.workers.dev';

  // ─── Update Check ────────────────────────────────────────────────────────
  ipcMain.handle(IPC.UPDATE_CHECK, async (): Promise<UpdateInfo> => {
    const currentVersion = app.getVersion();
    const userAgent = `openconduit/${currentVersion}`;
    const channel = (getSettings().updateChannel ?? 'stable') as 'stable' | 'beta' | 'alpha';

    // Try Worker first (if configured), fall back to GitHub Releases API
    if (WORKER_URL) {
      try {
        const res = await fetch(`${WORKER_URL}/latest?channel=${channel}`, {
          headers: { 'User-Agent': userAgent },
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          const data = await res.json() as { version: string; notes?: string; url?: string };
          const hasUpdate = data.version !== currentVersion;
          return { hasUpdate, latestVersion: data.version, currentVersion, releaseNotes: data.notes, downloadUrl: data.url };
        }
      } catch { /* fall through to GitHub */ }
    }

    try {
      if (channel === 'stable') {
        // Stable: use /releases/latest (excludes pre-releases)
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
          headers: { 'User-Agent': userAgent, Accept: 'application/vnd.github+json' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`GitHub API returned HTTP ${res.status}`);
        const data = await res.json() as { tag_name: string; body?: string; html_url: string };
        const latestVersion = data.tag_name.replace(/^v/, '');
        return { hasUpdate: latestVersion !== currentVersion, latestVersion, currentVersion, releaseNotes: data.body, downloadUrl: data.html_url };
      } else {
        // Beta/Alpha: scan all releases for the newest matching pre-release tag
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`, {
          headers: { 'User-Agent': userAgent, Accept: 'application/vnd.github+json' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`GitHub API returned HTTP ${res.status}`);
        const releases = await res.json() as Array<{ tag_name: string; prerelease: boolean; body?: string; html_url: string }>;
        // Accept releases tagged with the channel name or any looser pre-release when channel is beta
        const match = releases.find((r) => {
          if (!r.prerelease) return false;
          const tag = r.tag_name.toLowerCase();
          if (channel === 'beta') return tag.includes('beta');
          // alpha channel accepts alpha and beta builds
          return tag.includes('alpha') || tag.includes('beta');
        });
        if (!match) {
          // No pre-release found — fall back to stable behaviour
          const fallback = releases.find((r) => !r.prerelease);
          if (fallback) {
            const latestVersion = fallback.tag_name.replace(/^v/, '');
            return { hasUpdate: latestVersion !== currentVersion, latestVersion, currentVersion, releaseNotes: fallback.body, downloadUrl: fallback.html_url };
          }
          throw new Error('No releases found');
        }
        const latestVersion = match.tag_name.replace(/^v/, '');
        return { hasUpdate: latestVersion !== currentVersion, latestVersion, currentVersion, releaseNotes: match.body, downloadUrl: match.html_url };
      }
    } catch (err) {
      throw new Error(`Update check failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // ─── Feedback Submit ──────────────────────────────────────────────────────
  ipcMain.handle(IPC.FEEDBACK_SUBMIT, async (_e, payload: Omit<FeedbackPayload, 'appVersion' | 'platform'>): Promise<void> => {
    const fullPayload: FeedbackPayload = { ...payload, appVersion: app.getVersion(), platform: process.platform };

    // Try Worker first (silent POST), fall back to pre-filled GitHub issue URL
    if (WORKER_URL) {
      try {
        const res = await fetch(`${WORKER_URL}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': `openconduit/${app.getVersion()}` },
          body: JSON.stringify(fullPayload),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) return;
      } catch { /* fall through to GitHub */ }
    }

    // Fallback: open pre-filled GitHub issue in browser
    const label = payload.type === 'bug' ? 'bug' : 'enhancement';
    const body = `${payload.description}\n\n---\n_App version: ${app.getVersion()} · Platform: ${process.platform}_`;
    const url = `https://github.com/${GITHUB_REPO}/issues/new?title=${encodeURIComponent(payload.title)}&body=${encodeURIComponent(body)}&labels=${label}`;
    await shell.openExternal(url);
  });

  // ─── Abort ───────────────────────────────────────────────────────────────
  ipcMain.on(IPC.CHAT_ABORT, (_e, conversationId: string) => {
    abortControllers.get(conversationId)?.abort();
  });

  // ─── Chat Send ───────────────────────────────────────────────────────────
  ipcMain.handle(IPC.CHAT_SEND, async (e, request: ChatRequest) => {
    const wc = e.sender;
    const { conversationId, providerId, model, parameters, systemPrompt, enabledMcpServerIds } =
      request;
    const messageId = uuidv4();
    const abort = new AbortController();
    abortControllers.set(conversationId, abort);

    const settings = getSettings();
    const provider = settings.providers.find((p) => p.id === providerId);
    if (!provider) {
      wc.send(IPC.CHAT_STREAM_ERROR, {
        conversationId,
        messageId,
        error: `Provider "${providerId}" not found. Please add it in Settings.`,
      } as StreamError);
      abortControllers.delete(conversationId);
      return { messageId };
    }

    // Fire-and-forget async streaming
    (async () => {
      try {
        let messages: Message[] = [...request.messages];
        const MAX_ITERATIONS = 10;

        // Auto-connect any enabled MCP servers that aren't connected yet
        if (enabledMcpServerIds.length > 0) {
          const currentStatus = getMcpStatus();
          const serverConfigs = settings.mcpServers.filter(
            (s) => enabledMcpServerIds.includes(s.id) && !currentStatus[s.id],
          );
          for (const serverConfig of serverConfigs) {
            try {
              await connectMcpServer(serverConfig);
            } catch {
              // best-effort — tool list will just be empty for this server
            }
          }
        }

        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
          if (abort.signal.aborted) break;

          const tools =
            enabledMcpServerIds.length > 0 ? await listAllTools(enabledMcpServerIds) : [];

          const getStream = () => {
            switch (provider.type) {
              case 'anthropic':
                return streamAnthropic(provider, messages, model, parameters, systemPrompt, tools);
              case 'openai':
                return streamOpenAI(provider, messages, model, parameters, systemPrompt, tools);
              case 'lmstudio':
                return streamLmStudio(provider, messages, model, parameters, systemPrompt, tools);
              case 'gemini':
                return streamGemini(provider, messages, model, parameters, systemPrompt, tools);
            }
          };

          let fullText = '';
          let thinkingText = '';
          let toolCalls: ToolCall[] = [];
          let turnUsage: import('../shared/types').TokenUsage | undefined;

          for await (const event of getStream()) {
            if (abort.signal.aborted) break;
            if (event.type === 'delta') {
              fullText += event.text;
              wc.send(IPC.CHAT_STREAM_CHUNK, {
                conversationId,
                messageId,
                delta: event.text,
              } as StreamChunk);
            } else if (event.type === 'thinking') {
              thinkingText += event.text;
              wc.send(IPC.CHAT_STREAM_THINKING, {
                conversationId,
                messageId,
                delta: event.text,
              });
            } else if (event.type === 'tool_calls') {
              toolCalls = event.toolCalls;
            } else if (event.type === 'usage') {
              turnUsage = event.usage;
            }
          }

          if (abort.signal.aborted) break;

          if (toolCalls.length === 0) {
            // No tool calls — conversation turn is complete
            wc.send(IPC.CHAT_STREAM_END, {
              conversationId,
              messageId,
              toolCalls: [],
              usage: turnUsage,
            } as StreamEnd);
            break;
          }

          // ── Send pending tool calls to renderer NOW so Approve/Deny UI appears
          // before we block on requestApproval. Without this the renderer never
          // sees the tool calls and the approval dialog can never be shown.
          wc.send(IPC.CHAT_TOOL_PENDING, { conversationId, messageId, toolCalls });

          // Process each tool call
          const processedCalls: ToolCall[] = [];
          for (const tc of toolCalls) {
            if (abort.signal.aborted) break;

            let approved = true;
            if (settings.requireToolApproval) {
              // Skip approval if the server has autoApprove enabled
              const serverConfig = settings.mcpServers.find((s) => s.id === tc.serverId);
              if (!serverConfig?.autoApprove) {
                approved = await requestApproval(wc, conversationId, messageId, tc);
              }
            }

            if (!approved) {
              processedCalls.push({
                ...tc,
                approved: false,
                result: 'Denied by user',
                isError: false,
                pending: false,
              });
              continue;
            }

            const mcpTool = tools.find((t) => t.name === tc.name);
            const serverId = tc.serverId ?? mcpTool?.serverId;
            if (!serverId) {
              processedCalls.push({
                ...tc,
                result: `No MCP server found for tool "${tc.name}"`,
                isError: true,
                pending: false,
              });
              continue;
            }

            const result = await callTool(serverId, tc.name, tc.input);
            processedCalls.push({
              ...tc,
              serverId,
              approved: true,
              result: result.result,
              isError: result.isError,
              pending: false,
            });
          }

          // Send tool call results to renderer
          wc.send(IPC.CHAT_STREAM_END, {
            conversationId,
            messageId,
            toolCalls: processedCalls,
            usage: turnUsage,
          } as StreamEnd);

          // Build messages for the next iteration (tool results → re-query provider)
          const assistantMsg: Message = {
            id: messageId,
            role: 'assistant',
            content: fullText,
            thinking: thinkingText || undefined,
            toolCalls: processedCalls,
            timestamp: Date.now(),
          };
          const toolResultMsg: Message = {
            id: uuidv4(),
            role: 'tool_result',
            content: '',
            toolCalls: processedCalls,
            timestamp: Date.now(),
          };
          messages = [...messages, assistantMsg, toolResultMsg];
        }
      } catch (err: unknown) {
        if (!abort.signal.aborted) {
          wc.send(IPC.CHAT_STREAM_ERROR, {
            conversationId,
            messageId,
            error: err instanceof Error ? err.message : String(err),
          } as StreamError);
        }
      } finally {
        abortControllers.delete(conversationId);
      }
    })();

    return { messageId };
  });
}

function requestApproval(
  wc: WebContents,
  conversationId: string,
  messageId: string,
  toolCall: ToolCall,
): Promise<boolean> {
  return new Promise((resolve) => {
    pendingApprovals.set(toolCall.id, resolve);
    wc.send(IPC.TOOL_APPROVAL_REQUEST, {
      conversationId,
      messageId,
      toolCall,
    } as ToolApprovalRequest);
  });
}
