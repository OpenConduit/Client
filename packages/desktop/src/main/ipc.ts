import { BrowserWindow, ipcMain, WebContents, app, shell, dialog, autoUpdater } from 'electron';
import fs from 'fs/promises';
import path from 'node:path';
import semver from 'semver';
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
  RoutingConfig,
  RoutingDecision,
} from '../shared/types';
import { getSettings, setSettings, settingsStore, storeLastCrash, getStoredCrash, clearStoredCrash } from './store/settings';
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
import { callWebTool, BUILTIN_SERVER_ID } from './webtools';
import { normalizeOllamaBaseUrl, streamOllama } from './providers/ollama';
import { streamGemini } from './providers/gemini';
import { evaluateRouting } from './routing';

const EXTENSION_SERVER_ID = '__extension__';
const TELEMETRY_PRIMARY = 'https://updates.openconduit.ai';
const TELEMETRY_BACKUP  = 'https://openconduit-release-api.chumchal-account.workers.dev';

// ─── Telemetry helpers ────────────────────────────────────────────────────────
// These are exported so main.ts can call them at boot and on crash.
// All sends are fire-and-forget; failures are silently swallowed.

async function postTelemetry(payload: object): Promise<void> {
  const ua = `openconduit/${app.getVersion()}`;
  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json', 'User-Agent': ua };
  // Try primary first; fall back to backup if it fails or times out.
  for (const base of [TELEMETRY_PRIMARY, TELEMETRY_BACKUP]) {
    try {
      const res = await fetch(`${base}/telemetry`, {
        method: 'POST', headers, body,
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok || res.status < 500) return; // success or client error — don't retry
    } catch { /* try backup */ }
  }
}

export async function fireTelemetrySessionStart(): Promise<void> {
  if (!app.isPackaged) return; // never send telemetry in dev
  const settings = getSettings();
  if (!settings.telemetry?.usageReports) return;
  await postTelemetry({
    event: 'session_start',
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    providerTypes: settings.providers.map((p) => p.type),
    mcpEnabled: settings.mcpServers.length > 0,
    routingEnabled: !!(settings.routing as { enabled?: boolean } | undefined)?.enabled,
    updateChannel: settings.updateChannel ?? 'stable',
    features: {
      aiTaskTracking: !!(settings.labs?.aiTaskTracking),
      aiClarifyingQuestions: !!(settings.labs?.aiClarifyingQuestions),
    },
  });
}

export async function fireTelemetryCrash(error: Error, extra?: { crashDumpsDir?: string }): Promise<void> {
  // Always persist the crash locally so users can manually send it later
  const sanitize = (s: string) =>
    s.replace(/\(\/[^\s)]+\)/g, '(<path>)').replace(/at \/[^\s]+/g, 'at <path>').slice(0, 3000);
  storeLastCrash({
    appVersion: app.getVersion(),
    platform: process.platform,
    electronVersion: process.versions.electron,
    errorType: error.name,
    errorMessage: error.message.replace(/(?:\/[\w.-]+){2,}/g, '<path>').slice(0, 300),
    stackTrace: sanitize(error.stack ?? ''),
    timestamp: new Date().toISOString(),
    ...(extra?.crashDumpsDir ? { crashDumpsDir: extra.crashDumpsDir } : {}),
  });

  if (!app.isPackaged) return; // never auto-send telemetry in dev
  const settings = getSettings();
  if (!settings.telemetry?.crashReports) return;
  await postTelemetry({
    event: 'crash',
    appVersion: app.getVersion(),
    platform: process.platform,
    electronVersion: process.versions.electron,
    errorType: error.name,
    errorMessage: error.message.replace(/(?:\/[\w.-]+){2,}/g, '<path>').slice(0, 300),
    stackTrace: sanitize(error.stack ?? ''),
  });
}

const abortControllers = new Map<string, AbortController>();
const pendingApprovals = new Map<string, (approved: boolean) => void>();
const pendingExtensionToolCalls = new Map<string, (result: { result: string; isError: boolean }) => void>();

async function writeLog(level: string, category: string, message: string, data?: unknown): Promise<void> {
  try {
    const logsDir = path.join(app.getPath('userData'), 'logs');
    await fs.mkdir(logsDir, { recursive: true });
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    const dataStr = data !== undefined ? ' ' + JSON.stringify(data) : '';
    const line = `[${time}] [${level.toUpperCase().padEnd(5)}] [${category}] ${message}${dataStr}\n`;
    await fs.appendFile(path.join(logsDir, `debug-${dateStr}.log`), line, 'utf-8');
  } catch { /* non-fatal */ }
}

/** Write to the log file AND push to the in-app debug console panel in all renderer windows. */
function broadcastConsole(level: string, category: string, message: string, data?: unknown): void {
  void writeLog(level, category, message, data);
  const entry = { ts: Date.now(), level, message, data, category };
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('log:console', entry);
  }
}

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

  // Extension tool execution results (renderer → main)
  ipcMain.on(
    'chat:extension-tool-result',
    (_e, { callId, result, isError }: { callId: string; result: string; isError: boolean }) => {
      const resolve = pendingExtensionToolCalls.get(callId);
      if (resolve) {
        pendingExtensionToolCalls.delete(callId);
        resolve({ result, isError });
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

    if (provider.type === 'ollama') {
      try {
        const base = normalizeOllamaBaseUrl(provider.baseUrl).replace(/\/v1\/?$/, '');
        const response = await fetch(`${base}/api/tags`);
        if (!response.ok) return [];
        const body = await response.json() as {
          models?: Array<{ name?: string; details?: { parameter_size?: string } }>;
        };
        return (body.models ?? [])
          .map((m) => {
            const name = m.name?.trim();
            if (!name) return null;
            const size = m.details?.parameter_size?.trim();
            return size ? `${name} · ${size}` : name;
          })
          .filter((m): m is string => !!m)
          .sort((a, b) => a.localeCompare(b));
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

  // ─── Web Tool Test ──────────────────────────────────────────────────────────

  ipcMain.handle('webtool:test', async (_e, type: 'fetch' | 'search'): Promise<{ ok: boolean; message: string }> => {
    try {
      const settings = getSettings();
      if (type === 'fetch') {
        const { fetchUrlWithBrowser } = await import('./webtools/browser');
        const text = await fetchUrlWithBrowser('https://example.com', false);
        return { ok: true, message: `Fetched ${text.length.toLocaleString()} chars from example.com` };
      } else {
        const { dispatchSearch } = await import('./webtools/engines');
        const s = settings as unknown as Record<string, Record<string, unknown>>;
        const ws = s?.webSearch ?? {};
        const results = await dispatchSearch('test', {
          engine: (ws.engine as import('./webtools/engines').SearchEngine) ?? 'google',
          apiKey: ws.apiKey as string | undefined,
          googleCx: ws.googleCx as string | undefined,
          maxResults: 3,
          showBrowser: false,
          excludeWebsites: [],
        });
        if (results.length === 0) return { ok: false, message: 'Search returned 0 results — check your engine settings.' };
        return { ok: true, message: `Search returned ${results.length} result${results.length !== 1 ? 's' : ''}: "${results[0]?.title}"` };
      }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
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

  ipcMain.handle('settings:open-file', async (): Promise<void> => {
    await shell.openPath(settingsStore.path);
  });

  // ─── Config Bundle Export / Import ──────────────────────────────────────────────
  // Bundle = providers (no apiKey) + MCP servers (no headers/env). Safe to share.
  ipcMain.handle('config:export-bundle', async (
    _e,
    meta: { name?: string; description?: string },
  ): Promise<boolean> => {
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePath: dest } = await dialog.showSaveDialog(win!, {
      title: 'Export Config Bundle',
      defaultPath: 'openconduit-bundle.ocbundle',
      filters: [
        { name: 'OpenConduit Bundle', extensions: ['ocbundle'] },
        { name: 'JSON', extensions: ['json'] },
      ],
    });
    if (canceled || !dest) return false;
    const s = getSettings();
    const bundle = {
      version: 1,
      name: meta?.name || undefined,
      description: meta?.description || undefined,
      providers: s.providers.map(({ apiKey: _k, ...rest }) => rest),
      mcpServers: s.mcpServers.map(({ headers: _h, env: _e, ...rest }) => rest),
    };
    await fs.writeFile(dest, JSON.stringify(bundle, null, 2), 'utf-8');
    return true;
  });

  ipcMain.handle('config:import-bundle', async (): Promise<import('../shared/types').ConfigBundle | null> => {
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: 'Import Config Bundle',
      filters: [{ name: 'OpenConduit Bundle', extensions: ['ocbundle', 'json'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return null;
    const raw = await fs.readFile(filePaths[0], 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!Array.isArray(parsed['providers']) || !Array.isArray(parsed['mcpServers'])) {
      throw new Error('Invalid bundle: missing providers or mcpServers arrays');
    }
    return parsed as unknown as import('../shared/types').ConfigBundle;
  });

  // ─── Routing Evaluation ────────────────────────────────────────────────────
  ipcMain.handle(
    IPC.ROUTING_EVALUATE,
    async (
      _e,
      params: {
        message: string;
        routerProviderId: string;
        routerModel: string;
        config: RoutingConfig;
        originalProviderId: string;
        originalModel: string;
      },
    ): Promise<RoutingDecision> => {
      const settings = getSettings();
      const routerProvider = settings.providers.find((p) => p.id === params.routerProviderId);
      if (!routerProvider) {
        return {
          complexity: 1,
          taskType: 'general',
          finalProviderId: params.originalProviderId,
          finalModel: params.originalModel,
          originalProviderId: params.originalProviderId,
          originalModel: params.originalModel,
          reason: 'Router provider not found — using default model',
        };
      }
      return evaluateRouting({
        message: params.message,
        routerProvider,
        routerModel: params.routerModel,
        config: params.config,
        originalProviderId: params.originalProviderId,
        originalModel: params.originalModel,
      });
    },
  );
  // ─── Extensions ─────────────────────────────────────────────────────────-- //
  /*
   * Scan a directory for installed extensions and append results to `out`.
   * Each sub-directory must contain a `manifest.json` with at minimum `id`
   * and `entryPoint` fields. The full parsed manifest is forwarded to the
   * renderer so the Phase 5 sandboxed loader can pre-register contributions
   * without running the extension bundle first.
  */
  async function scanExtensionDir(
    dir: string,
    out: import('../shared/types').InstalledExtensionInfo[]
  ): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(dir, entry.name, 'manifest.json');
      try {
        const raw = await fs.readFile(manifestPath, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown> & { id?: string; entryPoint?: string };
        if (!parsed.id || !parsed.entryPoint) continue;
        const { entryPoint: relEntry, ...manifestRest } = parsed;
        out.push({
          id: parsed.id,
          name: typeof parsed.name === 'string' ? parsed.name : parsed.id,
          version: typeof parsed.version === 'string' ? parsed.version : '0.0.0',
          entryPoint: path.join(dir, entry.name, relEntry as string),
          // Full manifest forwarded so renderer can use Phase 5 sandboxed path.
          manifest: manifestRest as import('../shared/types').InstalledExtensionInfo['manifest'],
        });
      } catch {
        // Skip extensions with missing or invalid manifests
      }
    }
  }

  ipcMain.handle(IPC.EXTENSIONS_GET_INSTALLED, async (): Promise<import('../shared/types').InstalledExtensionInfo[]> => {
    const results: import('../shared/types').InstalledExtensionInfo[] = [];

    // ── Production: userData/extensions/ ─────────────────────────────────────
    const extensionsDir = path.join(app.getPath('userData'), 'extensions');
    try {
      await scanExtensionDir(extensionsDir, results);
    } catch {
      // extensions/ directory doesn't exist yet — no extensions installed
    }

    // ── Development: OPENCONDUIT_DEV_EXTENSIONS env var ───────────────────────
    // Set this to an absolute path containing extension sub-directories to load
    // extra extensions without copying them to userData. Example:
    //   OPENCONDUIT_DEV_EXTENSIONS=/path/to/core/test-extensions npm start
    const devDir = process.env.OPENCONDUIT_DEV_EXTENSIONS;
    if (devDir) {
      try {
        await scanExtensionDir(devDir, results);
      } catch (err) {
        console.warn('[Extensions] OPENCONDUIT_DEV_EXTENSIONS scan failed:', err);
      }
    }

    return results;
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

    /**
     * Compute hasUpdate / isDowngrade for a candidate version.
     * - Normal upgrade: candidate > current
     * - Downgrade to stable: running a pre-release on stable channel → always
     *   surface the stable release so the user can switch back.
     */
    function resolveUpdate(latestVersion: string): { hasUpdate: boolean; isDowngrade: boolean } {
      if (!semver.valid(latestVersion)) return { hasUpdate: false, isDowngrade: false };
      if (semver.gt(latestVersion, currentVersion)) return { hasUpdate: true, isDowngrade: false };
      // Running a pre-release while on the stable channel — offer the stable release.
      const runningPrerelease = semver.prerelease(currentVersion) !== null;
      if (runningPrerelease && channel === 'stable' && semver.lt(latestVersion, currentVersion)) {
        return { hasUpdate: true, isDowngrade: true };
      }
      return { hasUpdate: false, isDowngrade: false };
    }

    // Try Worker first (if configured), fall back to GitHub Releases API,
    // then fall back to update.electronjs.org (Electron's hosted proxy for GitHub Releases).
    if (WORKER_URL) {
      try {
        const res = await fetch(`${WORKER_URL}/latest?channel=${channel}`, {
          headers: { 'User-Agent': userAgent },
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          const data = await res.json() as { version: string; notes?: string; url?: string };
          const { hasUpdate, isDowngrade } = resolveUpdate(data.version);
          return { hasUpdate, isDowngrade, latestVersion: data.version, currentVersion, releaseNotes: data.notes, downloadUrl: data.url };
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
        const { hasUpdate, isDowngrade } = resolveUpdate(latestVersion);
        return { hasUpdate, isDowngrade, latestVersion, currentVersion, releaseNotes: data.body, downloadUrl: data.html_url };
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
            const { hasUpdate, isDowngrade } = resolveUpdate(latestVersion);
            return { hasUpdate, isDowngrade, latestVersion, currentVersion, releaseNotes: fallback.body, downloadUrl: fallback.html_url };
          }
          throw new Error('No releases found');
        }
        const latestVersion = match.tag_name.replace(/^v/, '');
        const { hasUpdate, isDowngrade } = resolveUpdate(latestVersion);
        return { hasUpdate, isDowngrade, latestVersion, currentVersion, releaseNotes: match.body, downloadUrl: match.html_url };
      }
    } catch { /* fall through to update.electronjs.org backup */ }

    // Backup: update.electronjs.org — Electron's hosted GitHub Releases proxy.
    // Returns 204 (no update) or JSON { url } / { name } when an update exists.
    try {
      const platform = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32' : 'linux';
      const res = await fetch(
        `https://update.electronjs.org/OpenConduit/Client/${platform}-${process.arch}/${currentVersion}`,
        { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(8000) },
      );
      if (res.status === 204) {
        return { hasUpdate: false, latestVersion: currentVersion, currentVersion };
      }
      if (res.ok) {
        const data = await res.json() as { name?: string; url?: string; notes?: string };
        const latestVersion = (data.name ?? currentVersion).replace(/^v/, '');
        const { hasUpdate, isDowngrade } = resolveUpdate(latestVersion);
        return { hasUpdate, isDowngrade, latestVersion, currentVersion, releaseNotes: data.notes, downloadUrl: data.url };
      }
    } catch { /* all sources exhausted */ }

    // All sources exhausted — return gracefully so the UI shows a soft error
    // rather than crashing the settings panel.
    throw new Error(`Update check failed: all sources unreachable (Worker, GitHub API, update.electronjs.org)`);
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

  // ─── Update: Restart & Install ───────────────────────────────────────────
  ipcMain.handle('update:restart', (): void => {
    autoUpdater.quitAndInstall();
  });

  // ─── Update: Trigger Download ─────────────────────────────────────────────
  // Sets the Squirrel feed URL (needed when updateMode is 'manual') and kicks
  // off a download.  The 'update:downloaded' event will be sent to all windows
  // when the download completes so the UI can show "Restart & Install".
  ipcMain.handle('update:trigger-download', async (): Promise<void> => {
    const channel = (getSettings().updateChannel ?? 'stable') as 'stable' | 'beta' | 'alpha';
    const urlPath = `updates/${channel}/${process.platform}/${process.arch}`;
    const primary = `https://updates.openconduit.ai/${urlPath}`;
    const backup  = `https://openconduit-release-api.chumchal-account.workers.dev/${urlPath}`;
    const probe   = process.platform === 'darwin' ? 'RELEASES.json' : 'RELEASES';

    let baseUrl = backup;
    try {
      const res = await fetch(`${primary}/${probe}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok || res.status === 204) baseUrl = primary;
    } catch { /* primary unreachable — use backup */ }

    autoUpdater.setFeedURL({ url: `${baseUrl}/${probe}` });

    // Notify the renderer once so the "Restart & Install" banner appears.
    autoUpdater.once('update-downloaded', () => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('update:downloaded');
      }
    });

    autoUpdater.checkForUpdates();
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
    const messageId = request.messageId ?? uuidv4();
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
        // Strip any empty assistant placeholders that may have been left in the
        // conversation store from a prior failed turn (they serialise to null content
        // which causes LM Studio / strict providers to reject the request).
        let messages: Message[] = [...request.messages].filter(
          (m) => m.role !== 'assistant' || !!(m.content || m.toolCalls?.length),
        );

        // Prepend folder context to the last user message so all providers get it.
        if (request.folderContext && request.folderContext.files.length > 0) {
          const fc = request.folderContext;
          const filesBlock = fc.files
            .map((f) => `<file path="${f.relativePath}">\n${f.content}\n</file>`)
            .join('\n');
          const contextBlock = `[Folder: ${fc.rootName}]\n${filesBlock}\n\n---\n`;
          const lastUserIdx = messages.reduce<number>(
            (found, m, i) => (m.role === 'user' ? i : found), -1,
          );
          if (lastUserIdx >= 0) {
            messages = messages.map((m, i) =>
              i === lastUserIdx ? { ...m, content: contextBlock + m.content } : m,
            );
          }
        }
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
          // Append built-in tools injected by first-party extensions (web_fetch, web_search)
          tools.push(...(request.builtinTools ?? []));

          const getStream = () => {
            switch (provider.type) {
              case 'anthropic':
                return streamAnthropic(provider, messages, model, parameters, systemPrompt, tools);
              case 'openai':
                return streamOpenAI(provider, messages, model, parameters, systemPrompt, tools);
              case 'lmstudio':
                return streamLmStudio(provider, messages, model, parameters, systemPrompt, tools);
              case 'ollama':
                return streamOllama(provider, messages, model, parameters, systemPrompt, tools);
              case 'gemini':
                return streamGemini(provider, messages, model, parameters, systemPrompt, tools);
            }
          };

          let fullText = '';
          let thinkingText = '';
          let toolCalls: ToolCall[] = [];
          let turnUsage: import('../shared/types').TokenUsage | undefined;

          broadcastConsole('info', 'provider', 'Stream request sent', { provider: provider.type, model, iteration, tools: tools.length, messages: messages.length });
          let firstEvent = true;

          for await (const event of getStream()) {
            if (abort.signal.aborted) break;
            if (firstEvent) {
              broadcastConsole('info', 'provider', 'First event received', { type: event.type });
              firstEvent = false;
            }
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

          broadcastConsole('info', 'provider', 'Stream complete', { chars: fullText.length, toolCalls: toolCalls.length, hadUsage: !!turnUsage, firstEventReceived: !firstEvent });

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

            // Route built-in tools (web_fetch, web_search) to the local handler
            if (serverId === BUILTIN_SERVER_ID) {
              const t0 = performance.now();
              const result = await callWebTool(tc, settings);
              const durationMs = Math.round(performance.now() - t0);
              processedCalls.push({
                ...tc,
                serverId: BUILTIN_SERVER_ID,
                approved: true,
                result: result.result,
                isError: result.isError,
                pending: false,
                durationMs,
              });
              continue;
            }

            // Route extension-contributed tools back to the renderer for execution
            if (serverId === EXTENSION_SERVER_ID) {
              const callId = uuidv4();
              const t0 = performance.now();
              const result = await callExtensionTool(wc, callId, tc);
              const durationMs = Math.round(performance.now() - t0);
              processedCalls.push({
                ...tc,
                serverId: EXTENSION_SERVER_ID,
                approved: true,
                result: result.result,
                isError: result.isError,
                pending: false,
                durationMs,
              });
              continue;
            }

            if (!serverId) {
              processedCalls.push({
                ...tc,
                result: `No MCP server found for tool "${tc.name}"`,
                isError: true,
                pending: false,
              });
              continue;
            }

            const t0 = performance.now();
            const result = await callTool(serverId, tc.name, tc.input);
            const durationMs = Math.round(performance.now() - t0);
            processedCalls.push({
              ...tc,
              serverId,
              approved: true,
              result: result.result,
              isError: result.isError,
              pending: false,
              durationMs,
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
        const errMsg = err instanceof Error ? err.message : String(err);
        broadcastConsole('error', 'provider', 'Stream error', { error: errMsg, stack: err instanceof Error ? err.stack : undefined });
        if (!abort.signal.aborted) {
          wc.send(IPC.CHAT_STREAM_ERROR, {
            conversationId,
            messageId,
            error: errMsg,
          } as StreamError);
        }
      } finally {
        abortControllers.delete(conversationId);
      }
    })();

    return { messageId };
  });

  // ─── Debug Logging ───────────────────────────────────────────────────────
  // Keep last 7 days of daily log files; auto-prune on first write of each day.
  const logsDir = path.join(app.getPath('userData'), 'logs');
  let prunedToday = false;

  ipcMain.on('log:write', async (_e, entry: {
    ts: number; level: string; message: string; data?: unknown; category?: string;
  }) => {
    try {
      await fs.mkdir(logsDir, { recursive: true });

      const date   = new Date(entry.ts);
      const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
      const time   = date.toTimeString().slice(0, 8) + '.' + String(date.getMilliseconds()).padStart(3, '0');
      const cat    = entry.category ? ` [${entry.category}]` : '';
      const data   = entry.data !== undefined ? ' ' + JSON.stringify(entry.data) : '';
      const line   = `[${time}] [${entry.level.toUpperCase().padEnd(5)}]${cat} ${entry.message}${data}\n`;

      await fs.appendFile(path.join(logsDir, `debug-${dateStr}.log`), line, 'utf-8');

      // Prune files older than 7 days (once per process lifetime)
      if (!prunedToday) {
        prunedToday = true;
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        try {
          const files = await fs.readdir(logsDir);
          await Promise.all(
            files
              .filter((f) => f.startsWith('debug-') && f.endsWith('.log'))
              .map(async (f) => {
                const stat = await fs.stat(path.join(logsDir, f));
                if (stat.mtimeMs < cutoff) await fs.unlink(path.join(logsDir, f));
              }),
          );
        } catch { /* prune failure is non-fatal */ }
      }
    } catch { /* log write failure must never crash the app */ }
  });

  ipcMain.handle('log:open', async (): Promise<void> => {
    await fs.mkdir(logsDir, { recursive: true });
    await shell.openPath(logsDir);
  });

  // ─── Folder access ───────────────────────────────────────────────────────

  ipcMain.handle('folder:pick', async (): Promise<string | null> => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win ?? BrowserWindow.getAllWindows()[0], {
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'out', '.cache',
    '__pycache__', '.venv', 'venv', '.svelte-kit', '.turbo', '.vercel']);
  const TEXT_EXTS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.txt', '.css', '.scss',
    '.sass', '.less', '.html', '.htm', '.xml', '.yaml', '.yml', '.toml', '.ini', '.env',
    '.sh', '.bash', '.zsh', '.fish', '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
    '.c', '.cpp', '.cc', '.h', '.hpp', '.cs', '.vue', '.svelte', '.astro', '.sql',
    '.graphql', '.gql', '.prisma', '.proto', '.tf', '.hcl', '.lua', '.r',
  ]);
  const MAX_FOLDER_FILES = 100;
  const MAX_FILE_BYTES = 128 * 1024;   // 128 KB per file
  const MAX_TOTAL_BYTES = 1024 * 1024; // 1 MB total

  ipcMain.handle('folder:read-files', async (_e, folderPath: string) => {
    const entries: { relativePath: string; content: string; size: number }[] = [];
    let totalBytes = 0;

    async function walk(dir: string): Promise<void> {
      if (entries.length >= MAX_FOLDER_FILES) return;
      let items: import('fs').Dirent[];
      try {
        items = await fs.readdir(dir, { withFileTypes: true });
      } catch { return; }

      for (const item of items) {
        if (entries.length >= MAX_FOLDER_FILES || totalBytes >= MAX_TOTAL_BYTES) break;
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          if (!SKIP_DIRS.has(item.name) && !item.name.startsWith('.')) {
            await walk(full);
          }
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          if (!TEXT_EXTS.has(ext)) continue;
          let stat: import('fs').Stats;
          try { stat = await fs.stat(full); } catch { continue; }
          if (stat.size > MAX_FILE_BYTES || stat.size === 0) continue;
          try {
            const content = await fs.readFile(full, 'utf-8');
            const rel = path.relative(folderPath, full).split(path.sep).join('/');
            entries.push({ relativePath: rel, content, size: stat.size });
            totalBytes += stat.size;
          } catch { /* skip unreadable */ }
        }
      }
    }

    await walk(folderPath);
    return entries;
  });

  // ─── Folder write / delete ────────────────────────────────────────────────

  /** Resolves and validates that targetPath is strictly inside baseFolder. */
  function assertInsideFolder(baseFolder: string, relativePath: string): string {
    const resolved = path.resolve(baseFolder, relativePath);
    const base = path.resolve(baseFolder);
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
      throw new Error('Path traversal detected');
    }
    return resolved;
  }

  ipcMain.handle('folder:write-file', async (_e, folderPath: string, relativePath: string, content: string): Promise<void> => {
    const target = assertInsideFolder(folderPath, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf-8');
  });

  ipcMain.handle('folder:delete-entry', async (_e, folderPath: string, relativePath: string): Promise<void> => {
    const target = assertInsideFolder(folderPath, relativePath);
    await fs.rm(target, { recursive: true, force: true });
  });

  // ─── Crash report: manual send ───────────────────────────────────────────
  ipcMain.handle('crash:has-stored', (): boolean => {
    return getStoredCrash() !== undefined;
  });

  ipcMain.handle('crash:send-stored', async (): Promise<void> => {
    const crash = getStoredCrash();
    if (!crash) return;
    await postTelemetry({
      event: 'crash',
      appVersion: crash.appVersion,
      platform: crash.platform,
      electronVersion: crash.electronVersion,
      errorType: crash.errorType,
      errorMessage: crash.errorMessage,
      stackTrace: crash.stackTrace,
    });
    clearStoredCrash();
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

/**
 * Ask the renderer to execute an extension-contributed tool handler.
 * Sends `chat:extension-tool-call` and waits for `chat:extension-tool-result`.
 */
function callExtensionTool(
  wc: WebContents,
  callId: string,
  toolCall: ToolCall,
): Promise<{ result: string; isError: boolean }> {
  return new Promise((resolve) => {
    pendingExtensionToolCalls.set(callId, resolve);
    wc.send('chat:extension-tool-call', {
      callId,
      toolName: toolCall.name,
      input: toolCall.input,
    });
  });
}
