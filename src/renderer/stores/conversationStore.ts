import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Conversation, Message, ToolCall } from '../../shared/types';

interface ConversationState {
  conversations: Conversation[];
  addConversation: (conv?: Partial<Conversation>) => Conversation;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  addMessage: (convId: string, msg: Message) => void;
  updateMessage: (convId: string, msgId: string, updates: Partial<Message>) => void;
  appendToMessage: (convId: string, msgId: string, delta: string) => void;
  appendThinkingToMessage: (convId: string, msgId: string, delta: string) => void;
  finalizeMessage: (convId: string, msgId: string, toolCalls: ToolCall[]) => void;
  clearMessages: (convId: string) => void;
  replaceMessages: (convId: string, messages: Message[]) => void;
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      conversations: [] as Conversation[],

      addConversation: (partial = {}) => {
        const conv: Conversation = {
          id: uuidv4(),
          title: 'New Conversation',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          ...partial,
        };
        set((s) => ({ conversations: [conv, ...s.conversations] }));
        return conv;
      },

      updateConversation: (id, updates) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c,
          ),
        }));
      },

      deleteConversation: (id) => {
        set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) }));
      },

      addMessage: (convId, msg) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now() }
              : c,
          ),
        }));
      },

      updateMessage: (convId, msgId, updates) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, ...updates } : m,
                  ),
                  updatedAt: Date.now(),
                }
              : c,
          ),
        }));
      },

      appendToMessage: (convId, msgId, delta) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, content: m.content + delta } : m,
                  ),
                }
              : c,
          ),
        }));
      },

      appendThinkingToMessage: (convId, msgId, delta) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, thinking: (m.thinking ?? '') + delta } : m,
                  ),
                }
              : c,
          ),
        }));
      },

      finalizeMessage: (convId, msgId, toolCalls) => {
        set((s) => {
          const finalCalls = toolCalls.length ? toolCalls : (
            s.conversations.find((c) => c.id === convId)
              ?.messages.find((m) => m.id === msgId)?.toolCalls ?? []
          );

          const updatedConversations = s.conversations.map((c) => {
            if (c.id !== convId) return c;

            let messages = c.messages.map((m) =>
              m.id === msgId
                ? { ...m, isStreaming: false, toolCalls: finalCalls.length ? finalCalls : m.toolCalls }
                : m,
            );

            // If there are tool calls, append a tool_result message so the history
            // is valid when sent back to Anthropic on the next user turn.
            if (finalCalls.length > 0) {
              // Only add if not already present (avoid duplicates on re-render)
              const alreadyHasResult = messages.some(
                (m) => m.role === 'tool_result' && m.toolCalls?.some((tc) => tc.id === finalCalls[0].id),
              );
              if (!alreadyHasResult) {
                messages = [
                  ...messages,
                  {
                    id: uuidv4(),
                    role: 'tool_result' as const,
                    content: '',
                    toolCalls: finalCalls,
                    timestamp: Date.now(),
                  },
                ];
              }
            }

            return { ...c, messages, updatedAt: Date.now() };
          });

          return { conversations: updatedConversations };
        });
      },

      clearMessages: (convId) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId ? { ...c, messages: [], updatedAt: Date.now() } : c,
          ),
        }));
      },

      replaceMessages: (convId, messages) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId ? { ...c, messages, updatedAt: Date.now() } : c,
          ),
        }));
      },
    }),
    { name: 'openconduit-conversations' },
  ),
);
