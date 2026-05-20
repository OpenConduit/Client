import { contextBridge, ipcRenderer } from 'electron';
import fs from 'node:fs';
import type {
  AppSettings,
  ChatRequest,
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
  },

  updater: {
    checkForUpdates: (): Promise<UpdateInfo> =>
      ipcRenderer.invoke(IPC.UPDATE_CHECK),
    submitFeedback: (payload: Omit<FeedbackPayload, 'appVersion' | 'platform'>): Promise<void> =>
      ipcRenderer.invoke(IPC.FEEDBACK_SUBMIT, payload),
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url),
  },
  config: {
    exportSettings: (redact: boolean): Promise<boolean> =>
      ipcRenderer.invoke(IPC.SETTINGS_EXPORT, redact),
    importSettings: (): Promise<AppSettings | null> =>
      ipcRenderer.invoke(IPC.SETTINGS_IMPORT),
    openSettingsFile: (): Promise<void> =>
      ipcRenderer.invoke('settings:open-file'),
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
  },
});
