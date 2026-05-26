import type {
  AppSettings,
  ChatRequest,
  SimpleCompletionRequest,
  FolderEntry,
  McpServerConfig,
  McpTool,
  SimpleCompletionRequest,
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
  const __SENTRY_DSN__: string;
  interface Window {
    api: {
      chat: {
        send: (request: ChatRequest) => Promise<{ messageId: string }>;
        /** Headless LLM call. Returns full response text without creating conversation messages. */
        complete: (request: SimpleCompletionRequest) => Promise<{ text: string }>;
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
        /** Ping each local provider (LM Studio, Ollama) and return running status + loaded models. */
        probe: () => Promise<Record<string, { running: boolean; loadedModels: string[] }>>;
      };
      updater: {
        checkForUpdates: () => Promise<UpdateInfo>;
        submitFeedback: (payload: Omit<FeedbackPayload, 'appVersion' | 'platform'>) => Promise<void>;
        openExternal: (url: string) => Promise<void>;
        /** Subscribe to be notified when an update has started downloading. Returns an unsub fn. */
        onUpdateDownloading: (cb: () => void) => (() => void);
        /** Subscribe to be notified when an update has been downloaded. Returns an unsub fn. */
        onUpdateDownloaded: (cb: () => void) => (() => void);
        /** Subscribe to be notified when a download error occurs. Returns an unsub fn. */
        onUpdateError: (cb: (message: string) => void) => (() => void);
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
        /**
         * Download and install an extension from the marketplace.
         * `downloadUrl` must point to an `.ocx` file (ZIP containing manifest.json
         * + dist/index.js). Extracted to userData/extensions/<id>/.
         * Call loadInstalledExtensions() after this resolves.
         */
        install: (id: string, downloadUrl: string) => Promise<{ success: boolean; error?: string }>;
        /**
         * Remove a previously installed extension from userData/extensions/<id>/.
         * Call loadInstalledExtensions() after this resolves.
         */
        uninstall: (id: string) => Promise<void>;
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
      copilot: {
        /** Start GitHub device-flow OAuth; returns codes + verification URL to show the user. */
        startAuth: () => Promise<{
          device_code: string;
          user_code: string;
          verification_uri: string;
          expires_in: number;
          interval: number;
        }>;
        /** Poll for OAuth completion. Call every `interval` seconds until status !== 'pending'. */
        pollAuth: (deviceCode: string) => Promise<{
          status: 'pending' | 'complete' | 'expired' | 'error';
          token?: string;
          error?: string;
        }>;
        /** Fetch Copilot premium-request quota for the authenticated GitHub token. */
        getUsage: (githubToken: string) => Promise<{
          premiumRequestsUsed: number;
          premiumRequestsIncluded: number;
          premiumRequestsPurchased: number;
        } | null>;
      };
      extensionTools: {
        /** Listen for the main process requesting an extension tool call. Returns an unsub fn. */
        onCall: (cb: (data: { callId: string; toolName: string; input: Record<string, unknown> }) => void) => UnsubFn;
        /** Send the result of an extension tool call back to the main process. */
        sendResult: (data: { callId: string; result: string; isError: boolean }) => void;
      };
      diagnostics: {
        /** Write a key/value pair into the Crashpad minidump for crash diagnosis. */
        setParam: (key: string, value: string) => void;
        /** Report a renderer-side JS error to the main process for crash telemetry. */
        reportError: (message: string, stack?: string) => void;
      };
      crash: {
        /** Returns true if a crash report has been stored and is available to send. */
        hasStored: () => Promise<boolean>;
        /** Sends the stored crash report to telemetry and clears it. */
        sendStored: () => Promise<void>;
      };
      machine: {
        /** Returns the persistent anonymous machine ID used for telemetry deduplication. */
        getId: () => Promise<string>;
      };
      folder: {
        /** Opens a native directory picker; resolves to the selected path or null. */
        pick: () => Promise<string | null>;
        /** Recursively reads text files under folderPath; resolves to FolderEntry[]. */
        readFiles: (folderPath: string) => Promise<FolderEntry[]>;
        /** Creates or overwrites a file at relativePath inside folderPath. */
        writeFile: (folderPath: string, relativePath: string, content: string) => Promise<void>;
        /** Deletes a file or directory (recursively) at relativePath inside folderPath. */
        deleteEntry: (folderPath: string, relativePath: string) => Promise<void>;
      };
      sync?: {
        /** Initialise (or re-initialise) the local git repo using the path stored in settings. */
        configure: () => Promise<{ success: boolean; error?: string }>;
        /** Serialise payload to files, commit, and push to remote if configured. */
        push: (payload: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
        /**
         * Pull latest commits from remote, then return the data files as a payload.
         * If no remote is configured, reads the current repo state.
         */
        pull: () => Promise<{ success: boolean; payload?: Record<string, unknown>; error?: string }>;
        /** Returns current repo status (initialized, remoteConfigured, lastCommitAt). */
        status: () => Promise<{ initialized: boolean; remoteConfigured: boolean; lastCommitAt: number | null }>;
      };
      conversation: {
        /** Upload a conversation snapshot to share.openconduit.ai. Returns the id and public URL. */
        share: (conversation: unknown) => Promise<{ id: string; url: string }>;
        /** Save conversation as self-contained HTML to a user-chosen file. */
        exportHtml: (conversation: unknown) => Promise<boolean>;
        /** List all shares created from this machine. */
        listShares: () => Promise<import('../main/store/settings').ShareRecord[]>;
        /** Delete a share from the server and local list. */
        deleteShare: (id: string) => Promise<void>;
      };
      collab: {
        /** Create a new live room; optionally seed it with an existing conversation. */
        create: (seed?: unknown) => Promise<{ roomId: string; wsUrl: string; inviteUrl: string }>;
        /** Connect to a room and send a join event. */
        join: (roomId: string, name: string, color: string) => Promise<void>;
        /** Disconnect from the current room. */
        leave: () => Promise<void>;
        /** Send a raw ClientEvent to the room. */
        send: (event: import('../main/collaboration/types').ClientEvent) => Promise<void>;
        /** Request the send lock (turn-based). */
        lockRequest: () => Promise<void>;
        /** Release the send lock. */
        lockRelease: () => Promise<void>;
        /** Subscribe to server events pushed from the room. Returns an unsub fn. */
        onEvent: (cb: (event: import('../main/collaboration/types').ServerEvent) => void) => UnsubFn;
        /** Subscribe to deep-link join invites (openconduit://join?roomId=…). Returns an unsub fn. */
        onInvite: (cb: (roomId: string) => void) => UnsubFn;
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
