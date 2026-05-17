// ─── Provider Types ────────────────────────────────────────────────────────

export type ProviderType = 'anthropic' | 'openai' | 'lmstudio' | 'ollama' | 'gemini';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  apiVersion?: string; // e.g. '2025-04-15' for Azure AI Foundry
  defaultModel?: string;
  customModels?: string[]; // user-defined model IDs, merged with fetched list
  modelContextWindows?: Record<string, number>; // model name → max context tokens (overrides built-in lookup)
}

// ─── MCP Types ─────────────────────────────────────────────────────────────

export type McpTransport = 'http-sse' | 'http-streamable' | 'stdio';

export interface McpServerConfig {
  id: string;
  name: string;
  transport: McpTransport;
  // HTTP-SSE
  url?: string;
  headers?: Record<string, string>;
  // stdio
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  autoApprove?: boolean; // skip per-call approval for this server's tools
}

export interface McpTool {
  serverId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  toolName: string;
  serverId: string;
  result: unknown;
  isError: boolean;
}

// ─── Message Types ─────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'tool_result' | 'system';

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  /** Base64-encoded data (desktop/local). */
  data?: string;
  /** R2 object key (cloud storage). */
  r2Key?: string;
  size: number;
}

export interface ToolCall {
  id: string;
  name: string;
  serverId?: string;
  input: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
  approved?: boolean;
  pending?: boolean;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  thinking?: string;          // extended thinking / reasoning trace
  aiQuestions?: AiQuestion[]; // clarifying questions the AI wants answered
  attachments?: Attachment[];
  toolCalls?: ToolCall[];
  timestamp: number;
  isStreaming?: boolean;
  model?: string;
  providerId?: string;
  /** Token usage for this assistant turn (populated after stream ends) */
  usage?: TokenUsage;
  /** Populated when intelligent routing overrode the default model. */
  routingDecision?: RoutingDecision;
}

// ─── Conversation Types ────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  systemPrompt?: string;
  providerId?: string;
  model?: string;
  parameters?: ModelParameters;
  /** When set, routing is driven by this profile instead of the global routing config. */
  routingProfileId?: string;
  /** Cloud: persona assigned to this conversation. */
  personaId?: string;
  /** Cloud: workspace this conversation belongs to. */
  workspaceId?: string;
  /**
   * Per-conversation MCP server overrides.
   * When set, only these server IDs are used for this conversation (ignoring global enabled state).
   * When undefined, falls back to globally-enabled servers.
   */
  activeMcpServerIds?: string[];
}

// ─── Token Usage ──────────────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;   // Anthropic cache read
  cacheWriteTokens?: number;  // Anthropic cache write
}

/** Per-model pricing entered by the user (USD per 1M tokens) */
export interface ModelPricing {
  /** key: "<providerId>/<model>" */
  [key: string]: {
    inputPer1M: number;
    outputPer1M: number;
  };
}

// ─── Analytics ────────────────────────────────────────────────────────────

/** One record per completed assistant turn */
export interface UsageRecord {
  id: string;
  timestamp: number;
  conversationId: string;
  providerId: string;
  model: string;
  usage: TokenUsage;
  /** Computed cost in USD, null if no pricing configured for this model */
  costUsd: number | null;
}

// ─── Model Parameters ──────────────────────────────────────────────────────

export interface ModelParameters {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

// ─── Labs / Experimental ──────────────────────────────────────────────────

export interface AiTask {
  id: string;
  text: string;
  status: 'pending' | 'in-progress' | 'done' | 'cancelled';
}

/** A clarifying question the AI wants the user to answer before proceeding */
export interface AiQuestion {
  id: string;
  question: string;
  /** If present, render as a choice picker instead of free text */
  options?: string[];
  /** When true with options, user can pick multiple; default single-select */
  multiSelect?: boolean;
  /** When true alongside options, show an "Other…" free-text fallback */
  allowOther?: boolean;
}

// ─── Intelligent Routing ───────────────────────────────────────────────────

export type RoutingTaskType = 'writing' | 'code' | 'tools' | 'reasoning' | 'general';

/** Maps a minimum complexity score to an explicit provider + model */
export interface RoutingTier {
  /** Minimum complexity score (1–3) that triggers this tier */
  minComplexity: 1 | 2 | 3;
  providerId: string;
  model: string;
  /** Display label, e.g. "Simple", "Complex" */
  label?: string;
}

/** Maps a task type category to a preferred provider + model */
export interface RoutingProviderRule {
  taskType: RoutingTaskType;
  providerId: string;
  model: string;
}

export interface RoutingConfig {
  enabled: boolean;
  /** Provider used to run the cheap router classification call */
  routerProviderId?: string;
  /** Model used for classification, e.g. "claude-haiku-3-5", "gpt-4o-mini" */
  routerModel?: string;
  tierRouting: {
    enabled: boolean;
    /** Tiers sorted by minComplexity desc — first match wins */
    tiers: RoutingTier[];
  };
  providerRouting: {
    enabled: boolean;
    rules: RoutingProviderRule[];
  };
}

/** A saved, named routing configuration that can be applied per-conversation. */
export interface RoutingProfile {
  id: string;
  name: string;
  config: RoutingConfig;
}

/** Result of a single routing evaluation, stored on the assistant Message */
export interface RoutingDecision {
  complexity: 1 | 2 | 3;
  taskType: RoutingTaskType;
  /** Provider ultimately used (may differ from conversation default) */
  finalProviderId: string;
  finalModel: string;
  /** Original conversation default — for "saved vs …" display */
  originalProviderId: string;
  originalModel: string;
  /** Short human-readable reason, e.g. "Complexity 3 → powerful tier" */
  reason: string;
}

// ─── App Settings ──────────────────────────────────────────────────────────

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  providers: ProviderConfig[];
  mcpServers: McpServerConfig[];
  defaultProviderId?: string;
  defaultModel?: string;
  defaultParameters: ModelParameters;
  requireToolApproval: boolean;
  /** Stable, shipped features */
  features: Record<string, never>; // placeholder — features graduate here from labs
  /** Experimental features still under development */
  labs: {
    aiTaskTracking: boolean;
    aiClarifyingQuestions: boolean;
    debugMode: boolean;
  };
  /** User-entered per-model pricing for cost tracking (USD per 1M tokens) */
  modelPricing?: ModelPricing;
  /** Which release channel to check for updates */
  updateChannel?: 'stable' | 'beta' | 'alpha';
  /** Intelligent model routing configuration (global default) */
  routing?: RoutingConfig;
  /** Named routing profiles — can be assigned per-conversation via routingProfileId */
  routingProfiles?: RoutingProfile[];
}

// ─── IPC Channel Names ─────────────────────────────────────────────────────

export const IPC = {
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Chat
  CHAT_SEND: 'chat:send',
  CHAT_STREAM_CHUNK: 'chat:stream:chunk',
  CHAT_STREAM_THINKING: 'chat:stream:thinking', // incremental thinking delta
  CHAT_STREAM_END: 'chat:stream:end',
  CHAT_STREAM_ERROR: 'chat:stream:error',
  CHAT_ABORT: 'chat:abort',
  CHAT_TOOL_PENDING: 'chat:tool:pending',  // sent before awaiting approval so UI can show Approve/Deny

  // Tool approval
  TOOL_APPROVAL_REQUEST: 'tool:approval:request',
  TOOL_APPROVAL_RESPONSE: 'tool:approval:response',

  // MCP
  MCP_LIST_TOOLS: 'mcp:list-tools',
  MCP_CONNECT: 'mcp:connect',
  MCP_DISCONNECT: 'mcp:disconnect',
  MCP_STATUS: 'mcp:status',

  // Models
  MODELS_LIST: 'models:list',

  // Updates & feedback
  UPDATE_CHECK: 'update:check',
  FEEDBACK_SUBMIT: 'feedback:submit',
  OPEN_EXTERNAL: 'open:external',

  // Config export/import
  SETTINGS_EXPORT: 'settings:export',
  SETTINGS_IMPORT: 'settings:import',

  // Routing
  ROUTING_EVALUATE: 'routing:evaluate',
} as const;

// ─── Chat Request / Response ────────────────────────────────────────────────

export interface ChatRequest {
  /** Optionally pre-supply the messageId so the renderer can add the
   *  placeholder message before calling send, eliminating the race condition
   *  where a STREAM_ERROR can arrive before the placeholder exists. */
  messageId?: string;
  conversationId: string;
  messages: Message[];
  providerId: string;
  model: string;
  parameters: ModelParameters;
  systemPrompt?: string;
  enabledMcpServerIds: string[];
}

export interface StreamChunk {
  conversationId: string;
  messageId: string;
  delta: string;
}

export interface StreamEnd {
  conversationId: string;
  messageId: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
}

export interface StreamError {
  conversationId: string;
  messageId: string;
  error: string;
}

export interface ToolApprovalRequest {
  conversationId: string;
  messageId: string;
  toolCall: ToolCall;
}

// ─── Update / Feedback ──────────────────────────────────────────────────────

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseNotes?: string;
  downloadUrl?: string;
}

export interface FeedbackPayload {
  type: 'bug' | 'feature';
  title: string;
  description: string;
  appVersion: string;
  platform: string;
}
