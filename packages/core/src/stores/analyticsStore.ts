import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { ModelPricing, TokenUsage, UsageRecord } from '../types';

interface AnalyticsState {
  records: UsageRecord[];
  /** Add a usage record; computes cost if pricing is available */
  addRecord: (
    params: {
      conversationId: string;
      providerId: string;
      model: string;
      usage: TokenUsage;
    },
    pricing: ModelPricing | undefined,
  ) => void;
  clearRecords: () => void;
}

function computeCost(
  usage: TokenUsage,
  pricing: ModelPricing | undefined,
  providerId: string,
  model: string,
): number | null {
  const key = `${providerId}/${model}`;
  const p = pricing?.[key];
  if (!p) return null;
  return (
    (usage.inputTokens / 1_000_000) * p.inputPer1M +
    (usage.outputTokens / 1_000_000) * p.outputPer1M
  );
}

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set) => ({
      records: [] as UsageRecord[],
      addRecord: ({ conversationId, providerId, model, usage }, pricing) => {
        const record: UsageRecord = {
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
    }),
    { name: 'openconduit-analytics' },
  ),
);
