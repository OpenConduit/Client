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
  InstalledExtensionInfo,
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
        /** Subscribe to be notified when an update has been downloaded. Returns an unsub fn. */
        onUpdateDownloaded: (cb: () => void) => (() => void);
        /** Quit and install the downloaded update immediately. */
        restartAndInstall: () => Promise<void>;
        /** Trigger an on-demand Squirrel download; fires update:downloaded when ready. */
        triggerDownload: () => Promise<void>;
      };
      config: {
        exportSettings: (redact: boolean) => Promise<boolean>;
        importSettings: () => Promise<AppSettings | null>;
        openSettingsFile: () => Promise<void>;
        /** Export providers + MCP servers (no secrets) to a shareable .ocbundle file. */
        exportBundle: (meta: { name?: string; description?: string }) => Promise<boolean>;
        /** Open a .ocbundle file and return its contents for merging into settings. */
        importBundle: () => Promise<import('../shared/types').ConfigBundle | null>;
      };
      routing: {
        evaluate: (params: {
          message: string;
          routerProviderId: string;
          routerModel: string;
          config: import('../shared/types').RoutingConfig;
          originalProviderId: string;
          originalModel: string;
        }) => Promise<import('../shared/types').RoutingDecision>;
      };
      extensions: {
        /** Returns metadata for all extensions installed in userData/extensions/. */
        getInstalled: () => Promise<InstalledExtensionInfo[]>;
        /**
         * Reads an extension's bundled JS entry point from the filesystem.
         * The preload handles filesystem access on behalf of the renderer.
         */
        readFile: (filePath: string) => Promise<string>;
      };
      log: {
        /** Fire-and-forget: append an entry to the daily log file in userData/logs/. */
        write: (entry: { ts: number; level: string; message: string; data?: unknown; category?: string }) => void;
        /** Open the userData/logs/ folder in Finder / Explorer. */
        open: () => Promise<void>;
        /** Subscribe to log entries pushed from the main process. Returns an unsub fn. */
        onConsoleEntry: (cb: (entry: { ts: number; level: string; message: string; data?: unknown; category?: string }) => void) => (() => void);
      };
      webtools: {
        /** Run a quick smoke-test of web_fetch or web_search with current settings. */
        test: (type: 'fetch' | 'search') => Promise<{ ok: boolean; message: string }>;
      };
      extensionTools: {
        /** Listen for the main process requesting an extension tool call. Returns an unsub fn. */
        onCall: (cb: (data: { callId: string; toolName: string; input: Record<string, unknown> }) => void) => UnsubFn;
        /** Send the result of an extension tool call back to the main process. */
        sendResult: (data: { callId: string; result: string; isError: boolean }) => void;
      };
      crash: {
        /** Returns true if a crash report has been stored and is available to send. */
        hasStored: () => Promise<boolean>;
        /** Sends the stored crash report to telemetry and clears it. */
        sendStored: () => Promise<void>;
      };
    };
    /**
     * Global SDK surface exposed for dynamically-loaded extension bundles.
     * Extensions can call any registry without importing `@openconduit/core`.
     */
    __openConduit?: {
      extensionRegistry:  typeof import('@openconduit/core').extensionRegistry;
      hookRegistry:       typeof import('@openconduit/core').hookRegistry;
      commandRegistry:    typeof import('@openconduit/core').commandRegistry;
      bottomPanelRegistry: typeof import('@openconduit/core').bottomPanelRegistry;
      settingsRegistry:   typeof import('@openconduit/core').settingsRegistry;
    };
  }
}
