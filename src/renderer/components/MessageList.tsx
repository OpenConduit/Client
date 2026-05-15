import React, { useEffect, useRef } from 'react';
import type { Message } from '../../shared/types';
import MessageBubble from './MessageBubble';

interface Props {
  messages: Message[];
  onApprove: (toolId: string) => void;
  onDeny: (toolId: string) => void;
  onSendAnswers: (questions: import('../../shared/types').AiQuestion[], answers: Record<string, string>) => void;
}

export default function MessageList({ messages, onApprove, onDeny, onSendAnswers }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messages[messages.length - 1]?.content]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 select-none">
        <svg className="w-12 h-12 mb-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <p className="text-sm font-medium text-slate-600">Start a conversation</p>
        <p className="text-xs text-slate-700 mt-1">Select a provider and model in the top bar</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-4">
      {messages
        .filter((m) => m.role !== 'tool_result')
        .map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onApprove={onApprove}
            onDeny={onDeny}
            onSendAnswers={onSendAnswers}
          />
        ))}
      <div ref={bottomRef} />
    </div>
  );
}
