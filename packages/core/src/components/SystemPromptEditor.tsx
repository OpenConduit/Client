import React from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';

interface Props {
  conversationId: string;
}

export default function SystemPromptEditor({ conversationId }: Props) {
  const { conversations, updateConversation } = useConversationStore();
  const { showSystemPrompt, setShowSystemPrompt } = useUiStore();
  const conv = conversations.find((c) => c.id === conversationId);

  return (
    <div className="border-t border-slate-700 flex-shrink-0">
      <button
        onClick={() => setShowSystemPrompt(!showSystemPrompt)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${showSystemPrompt ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        System Prompt
        {conv?.systemPrompt && (
          <span className="ml-auto text-blue-400 text-[10px]">active</span>
        )}
      </button>

      {showSystemPrompt && (
        <div className="px-4 pb-3">
          <textarea
            value={conv?.systemPrompt ?? ''}
            onChange={(e) =>
              updateConversation(conversationId, { systemPrompt: e.target.value || undefined })
            }
            placeholder="You are a helpful assistant…"
            rows={4}
            className="w-full bg-slate-800 border border-slate-600 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none outline-none leading-relaxed"
          />
        </div>
      )}
    </div>
  );
}
