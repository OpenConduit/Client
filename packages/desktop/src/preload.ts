import { contextBridge, ipcRenderer, crashReporter } from 'electron';

// ── Crash breadcrumbs ─────────────────────────────────────────────────────────
// Intercept every IPC invoke so the last-called channel is written into the
// Crashpad minidump. This shows up in .dmp files and helps narrow down which
// operation was in-flight when a renderer V8 CHECK failure occurs.
const _origInvoke = ipcRenderer.invoke.bind(ipcRenderer);
ipcRenderer.invoke = (channel: string, ...args: unknown[]): Promise<unknown> => {
  try { crashReporter.addExtraParameter('lastIpc', channel); } catch { /* non-fatal */ }
  return _origInvoke(channel, ...args);
};
import fs from 'node:fs';
import type {
  AppSettings,
  ChatRequest,
  FolderEntry,
  McpServerConfig,
  McpTool,
  StreamChunk,
  StreamEnd,
  StreamError,
  ToolApprovalRequest,
  UpdateInfo,
  FeedbackPayload,
  RoutingConfig,
  RoutingDecision,
  InstalledExtensionInfo,
} from './shared/types';
import { IPC } from './shared/types';

type UnsubFn = () => void;

contextBridge.exposeInMainWorld('api', {
  chat: {
    send: (request: ChatRequest): Promise<{ messageId: string }> =>
      ipcRenderer.invoke(IPC.CHAT_SEND, request),

    complete: (request: import('./shared/types').SimpleCompletionRequest): Promise<{ text: string }> =>
      ipcRenderer.invoke(IPC.CHAT_COMPLETE, request),

    abort: (conversationId: string): void =>
      ipcRenderer.send(IPC.CHAT_ABORT, conversationId),

    onChunk: (cb: (data: StreamChunk) => void): UnsubFn => {
      const handler = (_: Electron.IpcRendererEvent, data: StreamChunk) => cb(data);
      ipcRenderer.removeAllListeners(IPC.CHAT_STREAM_CHUNK);
      ipcRenderer.on(IPC.CHAT_STREAM_CHUNK, handler);
      return () => ipcRenderer.removeListener(IPC.CHAT_STREAM_CHUNK, handler);
    },

    onEnd: (cb: (data: StreamEnd) => void): UnsubFn => {
      const handler = (_: Electron.IpcRendererEvent, data: StreamEnd) => cb(data);
      ipcRenderer.removeAllListeners(IPC.CHAT_STREAM_END);
      ipcRenderer.on(IPC.CHAT_STREAM_END, handler);
      return () => ipcRenderer.removeListener(IPC.CHAT_STREAM_END, handler);
    },

    onError: (cb: (data: StreamError) => void): UnsubFn => {
      const handler = (_: Electron.IpcRendererEvent, data: StreamError) => cb(data);
      ipcRenderer.removeAllListeners(IPC.CHAT_STREAM_ERROR);
      ipcRenderer.on(IPC.CHAT_STREAM_ERROR, handler);
      return () => ipcRenderer.removeListener(IPC.CHAT_STREAM_ERROR, handler);
    },

    onToolPending: (cb: (data: { conversationId: string; messageId: string; toolCalls: import('./shared/types').ToolCall[] }) => void): UnsubFn => {
      const handler = (_: Electron.IpcRendererEvent, data: unknown) => cb(data as Parameters<typeof cb>[0]);
      ipcRenderer.removeAllListeners(IPC.CHAT_TOOL_PENDING);
      ipcRenderer.on(IPC.CHAT_TOOL_PENDING, handler);
      return () => ipcRenderer.removeListener(IPC.CHAT_TOOL_PENDING, handler);
    },

    onThinkingChunk: (cb: (data: { conversationId: string; messageId: string; delta: string }) => void): UnsubFn => {
      const handler = (_: Electron.IpcRendererEvent, data: unknown) => cb(data as Parameters<typeof cb>[0]);
      ipcRenderer.removeAllListeners(IPC.CHAT_STREAM_THINKING);
      ipcRenderer.on(IPC.CHAT_STREAM_THINKING, handler);
      return () => ipcRenderer.removeListener(IPC.CHAT_STREAM_THINKING, handler);
    },
  },

  tools: {
    onApprovalRequest: (cb: (data: ToolApprovalRequest) => void): UnsubFn => {
      const handler = (_: Electron.IpcRendererEvent, data: ToolApprovalRequest) => cb(data);
      ipcRenderer.on(IPC.TOOL_APPROVAL_REQUEST, handler);
      return () => ipcRenderer.removeListener(IPC.TOOL_APPROVAL_REQUEST, handler);
    },

    sendApproval: (data: { toolId: string; approved: boolean }): void =>
      ipcRenderer.send(IPC.TOOL_APPROVAL_RESPONSE, data),
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
    set: (partial: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC.SETTINGS_SET, partial),
  },

  mcp: {
    connect: (config: McpServerConfig): Promise<void> =>
      ipcRenderer.invoke(IPC.MCP_CONNECT, config),
    disconnect: (id: string): Promise<void> => ipcRenderer.invoke(IPC.MCP_DISCONNECT, id),
    listTools: (serverIds: string[]): Promise<McpTool[]> =>
      ipcRenderer.invoke(IPC.MCP_LIST_TOOLS, serverIds),
    getStatus: (): Promise<Record<string, boolean>> => ipcRenderer.invoke(IPC.MCP_STATUS),
  },

  models: {
    list: (providerId: string): Promise<string[]> =>
      ipcRenderer.invoke(IPC.MODELS_LIST, providerId),
    /** Ping each local provider (LM Studio, Ollama) and return running status + loaded models. */
    probe: (): Promise<Record<string, { running: boolean; loadedModels: string[] }>> =>
      ipcRenderer.invoke('models:local-probe'),
  },

  updater: {
    checkForUpdates: (): Promise<UpdateInfo> =>
      ipcRenderer.invoke(IPC.UPDATE_CHECK),
    submitFeedback: (payload: Omit<FeedbackPayload, 'appVersion' | 'platform'>): Promise<void> =>
      ipcRenderer.invoke(IPC.FEEDBACK_SUBMIT, payload),
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url),
    /** Subscribe to be notified when an update has started downloading. Returns an unsub fn. */
    onUpdateDownloading: (cb: () => void): (() => void) => {
      const handler = () => cb();
      ipcRenderer.on('update:downloading', handler);
      return () => ipcRenderer.removeListener('update:downloading', handler);
    },
    /** Subscribe to be notified when an update has been downloaded. Returns an unsub fn. */
    onUpdateDownloaded: (cb: () => void): (() => void) => {
      const handler = () => cb();
      ipcRenderer.on('update:downloaded', handler);
      return () => ipcRenderer.removeListener('update:downloaded', handler);
    },
    /** Subscribe to be notified when a download error occurs. Returns an unsub fn. */
    onUpdateError: (cb: (message: string) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, message: string) => cb(message);
      ipcRenderer.on('update:error', handler);
      return () => ipcRenderer.removeListener('update:error', handler);
    },
    /** Quit and install the downloaded update immediately. */
    restartAndInstall: (): Promise<void> =>
      ipcRenderer.invoke('update:restart'),
    /** Trigger an on-demand Squirrel download; fires update:downloaded when ready. */
    triggerDownload: (): Promise<void> =>
      ipcRenderer.invoke('update:trigger-download'),
  },
  config: {
    exportSettings: (redact: boolean): Promise<boolean> =>
      ipcRenderer.invoke(IPC.SETTINGS_EXPORT, redact),
    importSettings: (): Promise<AppSettings | null> =>
      ipcRenderer.invoke(IPC.SETTINGS_IMPORT),
    openSettingsFile: (): Promise<void> =>
      ipcRenderer.invoke('settings:open-file'),
    /** Export providers + MCP servers (no secrets) to a shareable .ocbundle file. */
    exportBundle: (meta: { name?: string; description?: string }): Promise<boolean> =>
      ipcRenderer.invoke('config:export-bundle', meta),
    /** Open a .ocbundle file and return its contents for merging into settings. */
    importBundle: (): Promise<import('./shared/types').ConfigBundle | null> =>
      ipcRenderer.invoke('config:import-bundle'),
  },
  routing: {
    evaluate: (params: {
      message: string;
      routerProviderId: string;
      routerModel: string;
      config: RoutingConfig;
      originalProviderId: string;
      originalModel: string;
    }): Promise<RoutingDecision> =>
      ipcRenderer.invoke(IPC.ROUTING_EVALUATE, params),
  },

  extensions: {
    /** Returns metadata for all extensions installed in userData/extensions/. */
    getInstalled: (): Promise<InstalledExtensionInfo[]> =>
      ipcRenderer.invoke(IPC.EXTENSIONS_GET_INSTALLED),

    /**
     * Reads an extension's bundled JS entry point from the filesystem.
     * The preload runs in Node context so it can access arbitrary file paths
     * even though the renderer cannot (contextIsolation: true, nodeIntegration: false).
     * The returned source is converted to a Blob URL by the renderer and
     * imported as an ES module.
     */
    readFile: (filePath: string): Promise<string> =>
      Promise.resolve(fs.readFileSync(filePath, 'utf-8')),
  },

  log: {
    /** Fire-and-forget: append an entry to the daily log file in userData/logs/. */
    write: (entry: { ts: number; level: string; message: string; data?: unknown; category?: string }): void =>
      ipcRenderer.send('log:write', entry),
    /** Open the userData/logs/ folder in Finder / Explorer. */
    open: (): Promise<void> =>
      ipcRenderer.invoke('log:open'),
    /** Subscribe to log entries pushed from the main process. Returns an unsub fn. */
    onConsoleEntry: (cb: (entry: { ts: number; level: string; message: string; data?: unknown; category?: string }) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, entry: unknown) => cb(entry as Parameters<typeof cb>[0]);
      ipcRenderer.on('log:console', handler);
      return () => ipcRenderer.removeListener('log:console', handler);
    },
  },

  webtools: {
    /**
     * Run a quick smoke-test of the web fetch or search tool using the current
     * settings and return a human-readable result message.
     */
    test: (type: 'fetch' | 'search'): Promise<{ ok: boolean; message: string }> =>
      ipcRenderer.invoke('webtool:test', type),
  },

  copilot: {
    /** Start GitHub device-flow OAuth; returns codes + verification URL to show the user. */
    startAuth: (): Promise<{
      device_code: string;
      user_code: string;
      verification_uri: string;
      expires_in: number;
      interval: number;
    }> => ipcRenderer.invoke('copilot:start-auth'),
    /** Poll for OAuth completion. Call every `interval` seconds until status !== 'pending'. */
    pollAuth: (deviceCode: string): Promise<{
      status: 'pending' | 'complete' | 'expired' | 'error';
      token?: string;
      error?: string;
    }> => ipcRenderer.invoke('copilot:poll-auth', deviceCode),
    /** Fetch Copilot premium-request quota for the authenticated GitHub token. */
    getUsage: (githubToken: string): Promise<{
      premiumRequestsUsed: number;
      premiumRequestsIncluded: number;
      premiumRequestsPurchased: number;
    } | null> => ipcRenderer.invoke('copilot:get-usage', githubToken),
  },

  extensionTools: {
    /**
     * Listen for the main process asking the renderer to execute an extension
     * tool. Returns an unsubscribe function.
     */
    onCall: (cb: (data: { callId: string; toolName: string; input: Record<string, unknown> }) => void): UnsubFn => {
      const handler = (_: Electron.IpcRendererEvent, data: unknown) =>
        cb(data as Parameters<typeof cb>[0]);
      ipcRenderer.on('chat:extension-tool-call', handler);
      return () => ipcRenderer.removeListener('chat:extension-tool-call', handler);
    },

    /** Send the result of an extension tool call back to the main process. */
    sendResult: (data: { callId: string; result: string; isError: boolean }): void =>
      ipcRenderer.send('chat:extension-tool-result', data),
  },

  crash: {
    /** Returns true if a crash report is stored and available to send. */
    hasStored: (): Promise<boolean> =>
      ipcRenderer.invoke('crash:has-stored'),
    /** Sends the stored crash report to telemetry and clears it. */
    sendStored: (): Promise<void> =>
      ipcRenderer.invoke('crash:send-stored'),
  },

  diagnostics: {
    /**
     * Write an arbitrary key/value pair into the Crashpad extra-parameters
     * table. Values appear in .dmp files and macOS .ips crash reports, making
     * it easy to see renderer lifecycle state at the time of a V8 crash.
     * Keys are capped at 40 chars; values at 127 chars by Crashpad.
     */
    setParam: (key: string, value: string): void => {
      try { crashReporter.addExtraParameter(key.slice(0, 40), value.slice(0, 127)); } catch { /* non-fatal */ }
    },
  },

  folder: {
    /** Opens a native directory picker; resolves to the selected path or null. */
    pick: (): Promise<string | null> =>
      ipcRenderer.invoke('folder:pick'),
    /** Recursively reads text files under folderPath; resolves to FolderEntry[]. */
    readFiles: (folderPath: string): Promise<FolderEntry[]> =>
      ipcRenderer.invoke('folder:read-files', folderPath),
    /** Creates or overwrites a file at relativePath inside folderPath. */
    writeFile: (folderPath: string, relativePath: string, content: string): Promise<void> =>
      ipcRenderer.invoke('folder:write-file', folderPath, relativePath, content),
    /** Deletes a file or directory (recursively) at relativePath inside folderPath. */
    deleteEntry: (folderPath: string, relativePath: string): Promise<void> =>
      ipcRenderer.invoke('folder:delete-entry', folderPath, relativePath),
  },

  sync: {
    /** Initialise (or re-initialise) the local git repo using the path stored in settings. */
    configure: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('sync:configure'),
    /** Serialise payload to files, commit, and push to remote if configured. */
    push: (payload: Record<string, unknown>): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('sync:push', payload),
    /**
     * Pull latest commits from remote, then return the data files as a payload.
     * If no remote is configured, reads the current repo state.
     */
    pull: (): Promise<{ success: boolean; payload?: Record<string, unknown>; error?: string }> =>
      ipcRenderer.invoke('sync:pull'),
    /** Returns current repo status (initialized, remoteConfigured, lastCommitAt). */
    status: (): Promise<{ initialized: boolean; remoteConfigured: boolean; lastCommitAt: number | null }> =>
      ipcRenderer.invoke('sync:status'),
  },

});
