import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { TokenUsage } from '../types';
import { service } from '../services';
import { useSettingsStore } from '../stores/settingsStore';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
import { useAnalyticsStore } from '../stores/analyticsStore';

export interface CompareMessage {
  role: 'user' | 'assistant';
  content: string;
  usage?: TokenUsage;
}

export interface CompareColumn {
  id: string;
  providerId: string;
  model: string;
  /** Current in-flight messageId — used to route incoming stream events. */
  messageId: string | null;
  /** Full conversation thread for this column. */
  messages: CompareMessage[];
  isStreaming: boolean;
  error: string | null;
  startedAt: number | null;
  endedAt: number | null;
}

function makeColumn(providerId: string, model: string): CompareColumn {
  return {
    id: uuidv4(),
    providerId,
    model,
    messageId: null,
    messages: [],
    isStreaming: false,
    error: null,
    startedAt: null,
    endedAt: null,
  };
}

export function useCompare() {
  const { settings } = useSettingsStore();
  const { addConversation } = useConversationStore();
  const { setActiveConversation, setCompareMode } = useUiStore();

  const [columns, setColumns] = useState<CompareColumn[]>(() => [
    makeColumn('', ''),
    makeColumn('', ''),
  ]);

  // messageId → column.id — allows routing incoming stream events
  const msgToCol = useRef<Map<string, string>>(new Map());
  const sessionId = useRef<string>(uuidv4());

  // Bootstrap columns from default provider/model once settings load
  useEffect(() => {
    if (settings && columns.every((c) => !c.providerId)) {
      const pid = settings.defaultProviderId ?? '';
      const model = settings.defaultModel ?? '';
      setColumns([makeColumn(pid, model), makeColumn(pid, model)]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.defaultProviderId]);

  // Register streaming listeners — only act when messageId is registered in msgToCol.
  useEffect(() => {
    const unsubs = [
      service.chat.onChunk((chunk) => {
        const colId = msgToCol.current.get(chunk.messageId);
        if (!colId) return;
        setColumns((cols) =>
          cols.map((c) => {
            if (c.id !== colId) return c;
            const msgs = [...c.messages];
            const last = msgs[msgs.length - 1];
            if (last?.role === 'assistant') {
              msgs[msgs.length - 1] = { ...last, content: last.content + chunk.delta };
            }
            return { ...c, messages: msgs };
          }),
        );
      }),

      service.chat.onEnd((end) => {
        const colId = msgToCol.current.get(end.messageId);
        if (!colId) return;
        msgToCol.current.delete(end.messageId);
        setColumns((cols) => {
          const col = cols.find((c) => c.id === colId);
          if (col && end.usage) {
            useAnalyticsStore.getState().addRecord(
              {
                conversationId: `compare-${sessionId.current}-${colId}`,
                providerId: col.providerId,
                model: col.model,
                usage: end.usage,
              },
              useSettingsStore.getState().settings?.modelPricing,
            );
          }
          return cols.map((c) => {
            if (c.id !== colId) return c;
            const msgs = [...c.messages];
            const last = msgs[msgs.length - 1];
            if (last?.role === 'assistant' && end.usage) {
              msgs[msgs.length - 1] = { ...last, usage: end.usage };
            }
            return { ...c, messages: msgs, messageId: null, isStreaming: false, endedAt: Date.now() };
          });
        });
      }),

      service.chat.onError((err) => {
        const colId = msgToCol.current.get(err.messageId);
        if (!colId) return;
        msgToCol.current.delete(err.messageId);
        setColumns((cols) =>
          cols.map((c) =>
            c.id === colId
              ? { ...c, messageId: null, isStreaming: false, error: err.error, endedAt: Date.now() }
              : c,
          ),
        );
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const anyStreaming = columns.some((c) => c.isStreaming);

  const sendToAll = useCallback(
    async (prompt: string) => {
      if (anyStreaming || !settings) return;

      const newSession = uuidv4();
      sessionId.current = newSession;

      const userMsg: CompareMessage = { role: 'user', content: prompt };

      // Append user message + empty assistant placeholder, mark streaming
      setColumns((cols) =>
        cols.map((c): CompareColumn => ({
          ...c,
          messages: [
            ...c.messages,
            userMsg,
            { role: 'assistant', content: '' },
          ],
          messageId: null,
          isStreaming: !!(c.providerId && c.model),
          error: null,
          startedAt: Date.now(),
          endedAt: null,
        })),
      );

      // Capture snapshot for the requests
      const colsSnapshot = [...columns];

      await Promise.allSettled(
        colsSnapshot.map(async (col) => {
          if (!col.providerId || !col.model) return;
          const convId = `compare-${newSession}-${col.id}`;

          // Build full message history for this column (prior turns + new user msg)
          const history = [
            ...col.messages,
            { role: 'user' as const, content: prompt },
          ].map((m) => ({
            id: uuidv4(),
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: Date.now(),
          }));

          try {
            const { messageId } = await service.chat.send({
              conversationId: convId,
              messages: history,
              providerId: col.providerId,
              model: col.model,
              parameters: settings.defaultParameters,
              enabledMcpServerIds: [],
            });
            msgToCol.current.set(messageId, col.id);
            setColumns((cols) =>
              cols.map((c) => (c.id === col.id ? { ...c, messageId } : c)),
            );
          } catch (e) {
            setColumns((cols) =>
              cols.map((c) =>
                c.id === col.id
                  ? {
                      ...c,
                      isStreaming: false,
                      error: e instanceof Error ? e.message : 'Request failed',
                      endedAt: Date.now(),
                    }
                  : c,
              ),
            );
          }
        }),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anyStreaming, settings, columns],
  );

  const abortAll = useCallback(() => {
    columns.forEach((col) => {
      if (col.isStreaming) {
        service.chat.abort(`compare-${sessionId.current}-${col.id}`);
      }
    });
    setColumns((cols) => cols.map((c) => ({ ...c, isStreaming: false })));
  }, [columns]);

  const clearAll = useCallback(() => {
    setColumns((cols) =>
      cols.map((c): CompareColumn => ({
        ...c,
        messages: [],
        messageId: null,
        isStreaming: false,
        error: null,
        startedAt: null,
        endedAt: null,
      })),
    );
  }, []);

  const updateColumn = useCallback(
    (id: string, updates: Partial<Pick<CompareColumn, 'providerId' | 'model'>>) => {
      setColumns((cols) =>
        cols.map((c) =>
          c.id === id
            ? { ...c, ...updates, messages: [], messageId: null, error: null }
            : c,
        ),
      );
    },
    [],
  );

  const addColumn = useCallback(() => {
    if (columns.length >= 4) return;
    setColumns((cols) => [
      ...cols,
      makeColumn(settings?.defaultProviderId ?? '', settings?.defaultModel ?? ''),
    ]);
  }, [columns.length, settings]);

  const removeColumn = useCallback(
    (id: string) => {
      if (columns.length <= 2) return;
      setColumns((cols) => cols.filter((c) => c.id !== id));
    },
    [columns.length],
  );

  /** Seed a real conversation from a column's full thread, then exit compare mode. */
  const continueWith = useCallback(
    (col: CompareColumn) => {
      const lastAssistant = [...col.messages].reverse().find((m) => m.role === 'assistant');
      if (!lastAssistant?.content) return;
      const conv = addConversation({
        providerId: col.providerId,
        model: col.model,
        title: col.messages.find((m) => m.role === 'user')?.content.slice(0, 60) ?? 'Comparison',
        messages: col.messages.map((m) => ({
          id: uuidv4(),
          role: m.role,
          content: m.content,
          timestamp: Date.now(),
          ...(m.role === 'assistant' ? { model: col.model, providerId: col.providerId, usage: m.usage } : {}),
        })),
      });
      setActiveConversation(conv.id);
      setCompareMode(false);
    },
    [addConversation, setActiveConversation, setCompareMode],
  );

  return {
    columns,
    anyStreaming,
    sendToAll,
    abortAll,
    clearAll,
    updateColumn,
    addColumn,
    removeColumn,
    continueWith,
  };
}
