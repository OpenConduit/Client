import React, { useState } from 'react';
import { useTasksStore } from '../stores/tasksStore';
import type { AiTask } from '../types';

const STATUS_CONFIG: Record<AiTask['status'], { icon: React.ReactNode; label: string; color: string }> = {
  pending: {
    icon: (
      <svg className="w-3.5 h-3.5 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" strokeWidth={2} />
      </svg>
    ),
    label: 'Pending',
    color: 'text-slate-400',
  },
  'in-progress': {
    icon: (
      <svg className="w-3.5 h-3.5 shrink-0 text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 12a8 8 0 018-8V4m0 0a8 8 0 018 8h0M12 4v2" />
      </svg>
    ),
    label: 'In progress',
    color: 'text-blue-300',
  },
  done: {
    icon: (
      <svg className="w-3.5 h-3.5 shrink-0 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    label: 'Done',
    color: 'text-slate-500 line-through',
  },
  cancelled: {
    icon: (
      <svg className="w-3.5 h-3.5 shrink-0 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    label: 'Cancelled',
    color: 'text-slate-600 line-through',
  },
};

export default function TasksPanel() {
  const { tasks, clearTasks } = useTasksStore();
  const [open, setOpen] = useState(true);

  if (tasks.length === 0) return null;

  const doneCount = tasks.filter((t) => t.status === 'done' || t.status === 'cancelled').length;
  const inProgress = tasks.filter((t) => t.status === 'in-progress').length;

  return (
    <div className="absolute top-14 right-3 z-20 w-64 rounded-xl border border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur-sm text-xs overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none border-b border-slate-700/60 hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        {/* Beaker / lab icon */}
        <svg className="w-3.5 h-3.5 text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        <span className="font-semibold text-slate-200 flex-1">AI Tasks</span>
        {/* Progress badge */}
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
          inProgress > 0 ? 'bg-blue-600/30 text-blue-300' : 'bg-slate-700 text-slate-400'
        }`}>
          {doneCount}/{tasks.length}
        </span>
        {/* Chevron */}
        <svg
          className={`w-3 h-3 text-slate-500 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Task list */}
      {open && (
        <div>
          <ul className="py-1.5 max-h-72 overflow-y-auto">
            {tasks.map((task) => {
              const cfg = STATUS_CONFIG[task.status];
              return (
                <li key={task.id} className="flex items-start gap-2 px-3 py-1.5 hover:bg-slate-800/40 transition-colors">
                  <span className="mt-0.5">{cfg.icon}</span>
                  <span className={`leading-snug ${cfg.color}`}>{task.text}</span>
                </li>
              );
            })}
          </ul>

          {/* Footer */}
          <div className="border-t border-slate-700/60 px-3 py-1.5 flex items-center justify-between">
            <span className="text-slate-600 text-[10px]">Tracked by AI</span>
            <button
              onClick={clearTasks}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
