import type { ChatRequest, Message, StreamChunk, ToolCall } from '../types';

export type BeforeSendHook = (request: ChatRequest) => ChatRequest | Promise<ChatRequest>;
export type OnResponseHook = (message: Message) => void | Promise<void>;
export type OnStreamChunkHook = (chunk: StreamChunk) => void;
export type OnToolCallHook = (toolCall: ToolCall) => boolean | Promise<boolean>;

const _beforeSend = new Map<string, BeforeSendHook>();
const _onResponse = new Map<string, OnResponseHook>();
const _onStreamChunk = new Map<string, OnStreamChunkHook>();
const _onToolCall = new Map<string, OnToolCallHook>();

export const hookRegistry = {
  // Registration
  registerBeforeSend(name: string, fn: BeforeSendHook) {
    _beforeSend.set(name, fn);
  },
  unregisterBeforeSend(name: string) {
    _beforeSend.delete(name);
  },

  registerOnResponse(name: string, fn: OnResponseHook) {
    _onResponse.set(name, fn);
  },
  unregisterOnResponse(name: string) {
    _onResponse.delete(name);
  },

  registerOnStreamChunk(name: string, fn: OnStreamChunkHook) {
    _onStreamChunk.set(name, fn);
  },
  unregisterOnStreamChunk(name: string) {
    _onStreamChunk.delete(name);
  },

  registerOnToolCall(name: string, fn: OnToolCallHook) {
    _onToolCall.set(name, fn);
  },
  unregisterOnToolCall(name: string) {
    _onToolCall.delete(name);
  },

  // Runners
  async runBeforeSend(request: ChatRequest): Promise<ChatRequest> {
    let req = request;
    for (const fn of _beforeSend.values()) {
      req = await fn(req);
    }
    return req;
  },

  async runOnResponse(message: Message): Promise<void> {
    for (const fn of _onResponse.values()) {
      await fn(message);
    }
  },

  runOnStreamChunk(chunk: StreamChunk): void {
    for (const fn of _onStreamChunk.values()) {
      fn(chunk);
    }
  },

  async runOnToolCall(toolCall: ToolCall): Promise<boolean> {
    let allow = true;
    for (const fn of _onToolCall.values()) {
      const result = await fn(toolCall);
      if (result === false) allow = false;
    }
    return allow;
  },
};
