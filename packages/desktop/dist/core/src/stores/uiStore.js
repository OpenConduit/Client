import { create } from 'zustand';
export const useUiStore = create()((set) => ({
    activeConversationId: null,
    setActiveConversation: (id) => set({ activeConversationId: id }),
    isStreaming: false,
    setIsStreaming: (v) => set({ isStreaming: v }),
    showSettings: false,
    setShowSettings: (v) => set({ showSettings: v }),
    sidebarOpen: true,
    setSidebarOpen: (v) => set({ sidebarOpen: v }),
    pendingApprovals: [],
    addPendingApproval: (req) => set((s) => ({ pendingApprovals: [...s.pendingApprovals, req] })),
    removePendingApproval: (toolId) => set((s) => ({
        pendingApprovals: s.pendingApprovals.filter((a) => a.toolCall.id !== toolId),
    })),
    showSystemPrompt: false,
    setShowSystemPrompt: (v) => set({ showSystemPrompt: v }),
    showParameters: false,
    setShowParameters: (v) => set({ showParameters: v }),
    isCompacting: false,
    setIsCompacting: (v) => set({ isCompacting: v }),
    isCompareMode: false,
    setCompareMode: (v) => set({ isCompareMode: v }),
}));
//# sourceMappingURL=uiStore.js.map