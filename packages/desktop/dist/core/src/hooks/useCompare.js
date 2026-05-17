import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { service } from '../services';
import { useSettingsStore } from '../stores/settingsStore';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
function makeColumn(providerId, model) {
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
    const [columns, setColumns] = useState(() => [
        makeColumn('', ''),
        makeColumn('', ''),
    ]);
    // messageId → column.id — allows routing incoming stream events
    const msgToCol = useRef(new Map());
    const sessionId = useRef(uuidv4());
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
                if (!colId)
                    return;
                setColumns((cols) => cols.map((c) => {
                    if (c.id !== colId)
                        return c;
                    const msgs = [...c.messages];
                    const last = msgs[msgs.length - 1];
                    if (last?.role === 'assistant') {
                        msgs[msgs.length - 1] = { ...last, content: last.content + chunk.delta };
                    }
                    return { ...c, messages: msgs };
                }));
            }),
            service.chat.onEnd((end) => {
                const colId = msgToCol.current.get(end.messageId);
                if (!colId)
                    return;
                msgToCol.current.delete(end.messageId);
                setColumns((cols) => {
                    const col = cols.find((c) => c.id === colId);
                    if (col && end.usage) {
                        useAnalyticsStore.getState().addRecord({
                            conversationId: `compare-${sessionId.current}-${colId}`,
                            providerId: col.providerId,
                            model: col.model,
                            usage: end.usage,
                        }, useSettingsStore.getState().settings?.modelPricing);
                    }
                    return cols.map((c) => {
                        if (c.id !== colId)
                            return c;
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
                if (!colId)
                    return;
                msgToCol.current.delete(err.messageId);
                setColumns((cols) => cols.map((c) => c.id === colId
                    ? { ...c, messageId: null, isStreaming: false, error: err.error, endedAt: Date.now() }
                    : c));
            }),
        ];
        return () => unsubs.forEach((u) => u());
    }, []);
    const anyStreaming = columns.some((c) => c.isStreaming);
    const sendToAll = useCallback(async (prompt) => {
        if (anyStreaming || !settings)
            return;
        const newSession = uuidv4();
        sessionId.current = newSession;
        const userMsg = { role: 'user', content: prompt };
        // Append user message + empty assistant placeholder, mark streaming
        setColumns((cols) => cols.map((c) => ({
            ...c,
            messages: [
                ...c.messages,
                userMsg,
                { role: 'assistant', content: '' },
            ],
            messageId: null,
            isStreaming: !!(c.providerId && c.model) || !!c.routingProfileId,
            error: null,
            startedAt: Date.now(),
            endedAt: null,
        })));
        // Capture snapshot for the requests
        const colsSnapshot = [...columns];
        await Promise.allSettled(colsSnapshot.map(async (col) => {
            const convId = `compare-${newSession}-${col.id}`;
            // Resolve routing profile → actual provider/model if needed
            let resolvedProviderId = col.providerId;
            let resolvedModel = col.model;
            if (col.routingProfileId) {
                const profile = settings.routingProfiles?.find((p) => p.id === col.routingProfileId);
                const cfg = profile?.config;
                if (cfg?.enabled &&
                    cfg.routerProviderId &&
                    cfg.routerModel &&
                    (cfg.tierRouting?.enabled || cfg.providerRouting?.enabled)) {
                    try {
                        const decision = await service.routing.evaluate({
                            message: prompt,
                            routerProviderId: cfg.routerProviderId,
                            routerModel: cfg.routerModel,
                            config: cfg,
                            originalProviderId: settings.defaultProviderId ?? col.providerId,
                            originalModel: settings.defaultModel ?? col.model,
                        });
                        resolvedProviderId = decision.finalProviderId;
                        resolvedModel = decision.finalModel;
                        // Persist routed model so the column label reflects it
                        setColumns((cols) => cols.map((c) => c.id === col.id
                            ? { ...c, providerId: resolvedProviderId, model: resolvedModel }
                            : c));
                    }
                    catch {
                        // Routing failed — fall through without a resolved model
                    }
                }
            }
            if (!resolvedProviderId || !resolvedModel) {
                setColumns((cols) => cols.map((c) => c.id === col.id
                    ? { ...c, isStreaming: false, error: 'No model selected', endedAt: Date.now() }
                    : c));
                return;
            }
            // Build full message history for this column (prior turns + new user msg)
            const history = [
                ...col.messages.filter((m) => m.role !== 'assistant' || !!m.content),
                { role: 'user', content: prompt },
            ].map((m) => ({
                id: uuidv4(),
                role: m.role,
                content: m.content,
                timestamp: Date.now(),
            }));
            try {
                const { messageId } = await service.chat.send({
                    conversationId: convId,
                    messages: history,
                    providerId: resolvedProviderId,
                    model: resolvedModel,
                    parameters: settings.defaultParameters,
                    enabledMcpServerIds: [],
                });
                msgToCol.current.set(messageId, col.id);
                setColumns((cols) => cols.map((c) => (c.id === col.id ? { ...c, messageId } : c)));
            }
            catch (e) {
                setColumns((cols) => cols.map((c) => c.id === col.id
                    ? {
                        ...c,
                        isStreaming: false,
                        error: e instanceof Error ? e.message : 'Request failed',
                        endedAt: Date.now(),
                    }
                    : c));
            }
        }));
    }, 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anyStreaming, settings, columns]);
    const abortAll = useCallback(() => {
        columns.forEach((col) => {
            if (col.isStreaming) {
                service.chat.abort(`compare-${sessionId.current}-${col.id}`);
            }
        });
        setColumns((cols) => cols.map((c) => ({ ...c, isStreaming: false })));
    }, [columns]);
    const clearAll = useCallback(() => {
        setColumns((cols) => cols.map((c) => ({
            ...c,
            messages: [],
            messageId: null,
            isStreaming: false,
            error: null,
            startedAt: null,
            endedAt: null,
        })));
    }, []);
    const updateColumn = useCallback((id, updates) => {
        setColumns((cols) => cols.map((c) => c.id === id
            ? { ...c, ...updates, messages: [], messageId: null, error: null }
            : c));
    }, []);
    const addColumn = useCallback(() => {
        if (columns.length >= 4)
            return;
        setColumns((cols) => [
            ...cols,
            makeColumn(settings?.defaultProviderId ?? '', settings?.defaultModel ?? ''),
        ]);
    }, [columns.length, settings]);
    const removeColumn = useCallback((id) => {
        if (columns.length <= 2)
            return;
        setColumns((cols) => cols.filter((c) => c.id !== id));
    }, [columns.length]);
    /** Seed a real conversation from a column's full thread, then exit compare mode. */
    const continueWith = useCallback((col) => {
        const lastAssistant = [...col.messages].reverse().find((m) => m.role === 'assistant');
        if (!lastAssistant?.content)
            return;
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
    }, [addConversation, setActiveConversation, setCompareMode]);
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
//# sourceMappingURL=useCompare.js.map