import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from './shared/types';
contextBridge.exposeInMainWorld('api', {
    chat: {
        send: (request) => ipcRenderer.invoke(IPC.CHAT_SEND, request),
        abort: (conversationId) => ipcRenderer.send(IPC.CHAT_ABORT, conversationId),
        onChunk: (cb) => {
            const handler = (_, data) => cb(data);
            ipcRenderer.removeAllListeners(IPC.CHAT_STREAM_CHUNK);
            ipcRenderer.on(IPC.CHAT_STREAM_CHUNK, handler);
            return () => ipcRenderer.removeListener(IPC.CHAT_STREAM_CHUNK, handler);
        },
        onEnd: (cb) => {
            const handler = (_, data) => cb(data);
            ipcRenderer.removeAllListeners(IPC.CHAT_STREAM_END);
            ipcRenderer.on(IPC.CHAT_STREAM_END, handler);
            return () => ipcRenderer.removeListener(IPC.CHAT_STREAM_END, handler);
        },
        onError: (cb) => {
            const handler = (_, data) => cb(data);
            ipcRenderer.removeAllListeners(IPC.CHAT_STREAM_ERROR);
            ipcRenderer.on(IPC.CHAT_STREAM_ERROR, handler);
            return () => ipcRenderer.removeListener(IPC.CHAT_STREAM_ERROR, handler);
        },
        onToolPending: (cb) => {
            const handler = (_, data) => cb(data);
            ipcRenderer.removeAllListeners(IPC.CHAT_TOOL_PENDING);
            ipcRenderer.on(IPC.CHAT_TOOL_PENDING, handler);
            return () => ipcRenderer.removeListener(IPC.CHAT_TOOL_PENDING, handler);
        },
        onThinkingChunk: (cb) => {
            const handler = (_, data) => cb(data);
            ipcRenderer.removeAllListeners(IPC.CHAT_STREAM_THINKING);
            ipcRenderer.on(IPC.CHAT_STREAM_THINKING, handler);
            return () => ipcRenderer.removeListener(IPC.CHAT_STREAM_THINKING, handler);
        },
    },
    tools: {
        onApprovalRequest: (cb) => {
            const handler = (_, data) => cb(data);
            ipcRenderer.on(IPC.TOOL_APPROVAL_REQUEST, handler);
            return () => ipcRenderer.removeListener(IPC.TOOL_APPROVAL_REQUEST, handler);
        },
        sendApproval: (data) => ipcRenderer.send(IPC.TOOL_APPROVAL_RESPONSE, data),
    },
    settings: {
        get: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
        set: (partial) => ipcRenderer.invoke(IPC.SETTINGS_SET, partial),
    },
    mcp: {
        connect: (config) => ipcRenderer.invoke(IPC.MCP_CONNECT, config),
        disconnect: (id) => ipcRenderer.invoke(IPC.MCP_DISCONNECT, id),
        listTools: (serverIds) => ipcRenderer.invoke(IPC.MCP_LIST_TOOLS, serverIds),
        getStatus: () => ipcRenderer.invoke(IPC.MCP_STATUS),
    },
    models: {
        list: (providerId) => ipcRenderer.invoke(IPC.MODELS_LIST, providerId),
    },
    updater: {
        checkForUpdates: () => ipcRenderer.invoke(IPC.UPDATE_CHECK),
        submitFeedback: (payload) => ipcRenderer.invoke(IPC.FEEDBACK_SUBMIT, payload),
        openExternal: (url) => ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url),
    },
    config: {
        exportSettings: (redact) => ipcRenderer.invoke(IPC.SETTINGS_EXPORT, redact),
        importSettings: () => ipcRenderer.invoke(IPC.SETTINGS_IMPORT),
    },
    routing: {
        evaluate: (params) => ipcRenderer.invoke(IPC.ROUTING_EVALUATE, params),
    },
});
//# sourceMappingURL=preload.js.map