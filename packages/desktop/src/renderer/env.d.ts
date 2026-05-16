import type {
  AppSettings,
  ChatRequest,
  McpServerConfig,
  McpTool,
  StreamChunk,
  StreamEnd,
  StreamError,
  ToolApprovalRequest,
  ToolCall,
  UpdateInfo,
  FeedbackPayload,
} from '../shared/types';

type UnsubFn = () => void;

declare global {
  const __APP_VERSION__: string;
  interface Window {
    api: {
      chat: {
        send: (request: ChatRequest) => Promise<{ messageId: string }>;
        abort: (conversationId: string) => void;
        onChunk: (cb: (data: StreamChunk) => void) => UnsubFn;
        onEnd: (cb: (data: StreamEnd) => void) => UnsubFn;
        onError: (cb: (data: StreamError) => void) => UnsubFn;
        onToolPending: (cb: (data: { conversationId: string; messageId: string; toolCalls: ToolCall[] }) => void) => UnsubFn;
        onThinkingChunk: (cb: (data: { conversationId: string; messageId: string; delta: string }) => void) => UnsubFn;
      };
      tools: {
        onApprovalRequest: (cb: (data: ToolApprovalRequest) => void) => UnsubFn;
        sendApproval: (data: { toolId: string; approved: boolean }) => void;
      };
      settings: {
        get: () => Promise<AppSettings>;
        set: (partial: Partial<AppSettings>) => Promise<AppSettings>;
      };
      mcp: {
        connect: (config: McpServerConfig) => Promise<void>;
        disconnect: (id: string) => Promise<void>;
        listTools: (serverIds: string[]) => Promise<McpTool[]>;
        getStatus: () => Promise<Record<string, boolean>>;
      };
      models: {
        list: (providerId: string) => Promise<string[]>;
      };
      updater: {
        checkForUpdates: () => Promise<UpdateInfo>;
        submitFeedback: (payload: Omit<FeedbackPayload, 'appVersion' | 'platform'>) => Promise<void>;
        openExternal: (url: string) => Promise<void>;
      };
      config: {
        exportSettings: (redact: boolean) => Promise<boolean>;
        importSettings: () => Promise<AppSettings | null>;
      };
    };
  }
}
