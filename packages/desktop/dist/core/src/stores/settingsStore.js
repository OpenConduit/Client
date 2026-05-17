import { create } from 'zustand';
import { service } from '../services';
export const useSettingsStore = create()((set, _get) => ({
    settings: null,
    models: {},
    mcpStatus: {},
    loadSettings: async () => {
        const settings = await service.settings.get();
        set({ settings });
    },
    saveSettings: async (partial) => {
        const updated = await service.settings.set(partial);
        set({ settings: updated });
    },
    loadModels: async (providerId) => {
        const list = await service.models.list(providerId);
        set((s) => ({ models: { ...s.models, [providerId]: list } }));
    },
    refreshMcpStatus: async () => {
        const status = await service.mcp.getStatus();
        set({ mcpStatus: status });
    },
}));
//# sourceMappingURL=settingsStore.js.map