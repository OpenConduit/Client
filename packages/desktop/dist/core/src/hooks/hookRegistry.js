const _beforeSend = new Map();
const _onResponse = new Map();
const _onStreamChunk = new Map();
const _onToolCall = new Map();
export const hookRegistry = {
    // Registration
    registerBeforeSend(name, fn) {
        _beforeSend.set(name, fn);
    },
    unregisterBeforeSend(name) {
        _beforeSend.delete(name);
    },
    registerOnResponse(name, fn) {
        _onResponse.set(name, fn);
    },
    unregisterOnResponse(name) {
        _onResponse.delete(name);
    },
    registerOnStreamChunk(name, fn) {
        _onStreamChunk.set(name, fn);
    },
    unregisterOnStreamChunk(name) {
        _onStreamChunk.delete(name);
    },
    registerOnToolCall(name, fn) {
        _onToolCall.set(name, fn);
    },
    unregisterOnToolCall(name) {
        _onToolCall.delete(name);
    },
    // Runners
    async runBeforeSend(request) {
        let req = request;
        for (const fn of _beforeSend.values()) {
            req = await fn(req);
        }
        return req;
    },
    async runOnResponse(message) {
        for (const fn of _onResponse.values()) {
            await fn(message);
        }
    },
    runOnStreamChunk(chunk) {
        for (const fn of _onStreamChunk.values()) {
            fn(chunk);
        }
    },
    async runOnToolCall(toolCall) {
        let allow = true;
        for (const fn of _onToolCall.values()) {
            const result = await fn(toolCall);
            if (result === false)
                allow = false;
        }
        return allow;
    },
};
//# sourceMappingURL=hookRegistry.js.map