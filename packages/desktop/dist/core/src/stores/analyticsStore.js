import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
function computeCost(usage, pricing, providerId, model) {
    const key = `${providerId}/${model}`;
    const p = pricing?.[key];
    if (!p)
        return null;
    return ((usage.inputTokens / 1_000_000) * p.inputPer1M +
        (usage.outputTokens / 1_000_000) * p.outputPer1M);
}
export const useAnalyticsStore = create()(persist((set) => ({
    records: [],
    addRecord: ({ conversationId, providerId, model, usage }, pricing) => {
        const record = {
            id: uuidv4(),
            timestamp: Date.now(),
            conversationId,
            providerId,
            model,
            usage,
            costUsd: computeCost(usage, pricing, providerId, model),
        };
        set((s) => ({ records: [record, ...s.records] }));
    },
    clearRecords: () => set({ records: [] }),
}), { name: 'openconduit-analytics' }));
//# sourceMappingURL=analyticsStore.js.map