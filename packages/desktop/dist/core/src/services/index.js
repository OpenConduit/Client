let _instance = null;
/**
 * Called once at app startup (before React renders) to provide the platform
 * implementation of AppService. In the desktop app this is `window.api`.
 * In the enterprise web app it will be an HTTP/WebSocket adapter.
 */
export function initService(impl) {
    _instance = impl;
}
/**
 * Lazy proxy — each namespace (chat, settings, mcp, …) is resolved at
 * call-time, so stores and hooks that import this module at the top level
 * still work even though initService() runs after module evaluation.
 */
export const service = {
    get chat() { return _instance.chat; },
    get tools() { return _instance.tools; },
    get settings() { return _instance.settings; },
    get mcp() { return _instance.mcp; },
    get models() { return _instance.models; },
    get updater() { return _instance.updater; },
    get config() { return _instance.config; },
    get routing() { return _instance.routing; },
};
//# sourceMappingURL=index.js.map