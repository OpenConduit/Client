import { contextBridge, ipcRenderer } from 'electron';
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
  },
});
