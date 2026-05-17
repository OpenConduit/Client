// ─── Provider Types ────────────────────────────────────────────────────────
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
    CHAT_TOOL_PENDING: 'chat:tool:pending', // sent before awaiting approval so UI can show Approve/Deny
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
};
//# sourceMappingURL=types.js.map