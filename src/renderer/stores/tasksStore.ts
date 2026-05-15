import { create } from 'zustand';
import type { AiTask } from '../../shared/types';

interface TasksState {
  tasks: AiTask[];
  conversationId: string | null;
  /** Replace the full task list (called after each AI response that emits <ai-tasks>) */
  setTasks: (tasks: AiTask[], conversationId: string) => void;
  /** Clear tasks when conversation changes or is cleared */
  clearTasks: () => void;
}

export const useTasksStore = create<TasksState>()((set) => ({
  tasks: [],
  conversationId: null,
  setTasks: (tasks, conversationId) => set({ tasks, conversationId }),
  clearTasks: () => set({ tasks: [], conversationId: null }),
}));
