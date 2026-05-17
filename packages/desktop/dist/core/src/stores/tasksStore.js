import { create } from 'zustand';
export const useTasksStore = create()((set) => ({
    tasks: [],
    conversationId: null,
    setTasks: (tasks, conversationId) => set({ tasks, conversationId }),
    clearTasks: () => set({ tasks: [], conversationId: null }),
}));
//# sourceMappingURL=tasksStore.js.map