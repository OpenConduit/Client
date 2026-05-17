import { create } from 'zustand';
import type { ToolApprovalRequest } from '../types';

interface UiState {
  activeConversationId: string | null;
  setActiveConversation: (id: string | null) => void;
  isStreaming: boolean;
  setIsStreaming: (v: boolean) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  pendingApprovals: ToolApprovalRequest[];
  addPendingApproval: (req: ToolApprovalRequest) => void;
  removePendingApproval: (toolId: string) => void;
  showSystemPrompt: boolean;
  setShowSystemPrompt: (v: boolean) => void;
  showParameters: boolean;
  setShowParameters: (v: boolean) => void;
  isCompacting: boolean;
  setIsCompacting: (v: boolean) => void;
  isCompareMode: boolean;
  setCompareMode: (v: boolean) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  activeConversationId: null,
  setActiveConversation: (id) => set({ activeConversationId: id }),

  isStreaming: false,
  setIsStreaming: (v) => set({ isStreaming: v }),

  showSettings: false,
  setShowSettings: (v) => set({ showSettings: v }),

  sidebarOpen: true,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  pendingApprovals: [],
  addPendingApproval: (req) =>
    set((s) => ({ pendingApprovals: [...s.pendingApprovals, req] })),
  removePendingApproval: (toolId) =>
    set((s) => ({
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
