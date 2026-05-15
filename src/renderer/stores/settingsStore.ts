import { create } from 'zustand';
import type { AppSettings } from '../../shared/types';

interface SettingsState {
  settings: AppSettings | null;
  models: Record<string, string[]>;
  mcpStatus: Record<string, boolean>;
  loadSettings: () => Promise<void>;
  saveSettings: (partial: Partial<AppSettings>) => Promise<void>;
  loadModels: (providerId: string) => Promise<void>;
  refreshMcpStatus: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, _get) => ({
  settings: null,
  models: {},
  mcpStatus: {},

  loadSettings: async () => {
    const settings = await window.api.settings.get();
    set({ settings });
  },

  saveSettings: async (partial) => {
    const updated = await window.api.settings.set(partial);
    set({ settings: updated });
  },

  loadModels: async (providerId: string) => {
    const list = await window.api.models.list(providerId);
    set((s) => ({ models: { ...s.models, [providerId]: list } }));
  },

  refreshMcpStatus: async () => {
    const status = await window.api.mcp.getStatus();
    set({ mcpStatus: status });
  },
}));
