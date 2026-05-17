import React, { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message, AiQuestion } from '../types';
import ToolCallCard from './ToolCallCard';
import QuestionsCard from './QuestionsCard';
import ArtifactBlock from './ArtifactBlock';
import { useSettingsStore } from '../stores/settingsStore';

interface Props {
  message: Message;
  conversationId?: string;
  onApprove?: (toolId: string) => void;
  onDeny?: (toolId: string) => void;
  onSendAnswers?: (questions: AiQuestion[], answers: Record<string, string>) => void;
}

const MessageBubble = memo(function MessageBubble({ message, conversationId, onApprove, onDeny, onSendAnswers }: Props) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const debugMode = useSettingsStore((s) => s.settings?.labs?.debugMode ?? false);

  function handleCopy() {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function downloadRaw() {
    const blob = new Blob([JSON.stringify(message, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `message-${message.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} px-4 py-1.5`}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white mr-2.5 mt-0.5 flex-shrink-0">
          AI
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Thinking block (Anthropic extended thinking) */}
        {isAssistant && message.thinking && (
          <div className="w-full mb-1.5">
            <button
              onClick={() => setThinkingOpen((o) => !o)}
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors select-none"
            >
              {/* Brain icon */}
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>Thinking</span>
              <svg
                className={`w-3 h-3 transition-transform duration-150 ${thinkingOpen ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {thinkingOpen && (
              <div className="mt-1 rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 text-xs text-slate-400 italic leading-relaxed whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                {message.thinking}
              </div>
            )}
          </div>
        )}
        {/* Bubble */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-slate-800 text-slate-100 rounded-bl-sm border border-slate-700'
          }`}
        >
          {/* Attachments */}
          {message.attachments?.map((att) => (
            <div key={att.id} className="mb-2">
              {att.mimeType.startsWith('image/') ? (
                <img
                  src={`data:${att.mimeType};base64,${att.data}`}
                  alt={att.name}
                  className="max-w-full max-h-64 rounded-lg"
                />
              ) : (
                <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-300">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {att.name}
                </div>
              )}
            </div>
          ))}

          {/* Content */}
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-ai">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children }) {
                    const match = /language-(\w+)/.exec(className ?? '');
                    const codeStr = String(children).replace(/\n$/, '');
                    if (match) {
                      return (
                        <ArtifactBlock
                          language={match[1]}
                          code={codeStr}
                          conversationId={conversationId}
                        />
                      );
                    }
                    return (
                      <code className="bg-slate-700 text-pink-300 px-1.5 py-0.5 rounded text-[12px] font-mono">
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Streaming cursor */}
          {message.isStreaming && !message.toolCalls?.length && (
            <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5 rounded-sm align-middle" />
          )}
        </div>

        {/* Tool calls */}
        {message.toolCalls?.map((tc) => (
          <div key={tc.id} className="w-full mt-1">
            <ToolCallCard
              toolCall={tc}
              onApprove={onApprove}
              onDeny={onDeny}
            />
          </div>
        ))}

        {/* AI clarifying questions */}
        {message.aiQuestions?.length && onSendAnswers && (
          <div className="w-full">
            <QuestionsCard
              questions={message.aiQuestions}
              onSubmit={(answers) => onSendAnswers(message.aiQuestions!, answers)}
            />
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-2 mt-1 px-1">
          {message.model && (
            <span className="text-[10px] text-slate-500">{message.model}</span>
          )}
          {/* Routing indicator */}
          {isAssistant && message.routingDecision &&
            (message.routingDecision.finalModel !== message.routingDecision.originalModel ||
              message.routingDecision.finalProviderId !== message.routingDecision.originalProviderId) && (
            <span className="relative group cursor-help flex items-center gap-1">
              <span className="text-[10px] text-slate-600">·</span>
              <span className="text-[10px] text-slate-600">
                c{message.routingDecision.complexity}
              </span>
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[220px] rounded bg-slate-800 border border-slate-700 px-2 py-1 text-[10px] text-slate-300 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg">
                <span className="block font-medium text-slate-200 mb-0.5">{message.routingDecision.reason}</span>
                <span className="text-slate-400">task · {message.routingDecision.taskType}</span>
              </span>
            </span>
          )}
          <span className="text-[10px] text-slate-600">
            {(() => {
              const d = new Date(message.timestamp);
              const now = new Date();
              const isToday =
                d.getFullYear() === now.getFullYear() &&
                d.getMonth() === now.getMonth() &&
                d.getDate() === now.getDate();
              return isToday
                ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
                    ' ' +
                    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            })()}
          </span>
          {isAssistant && message.usage && (
            <span className="text-[10px] text-slate-600" title={`${message.usage.inputTokens.toLocaleString()} in / ${message.usage.outputTokens.toLocaleString()} out`}>
              {(message.usage.inputTokens + message.usage.outputTokens).toLocaleString()} tok
            </span>
          )}
          {isAssistant && !message.isStreaming && (
            <button
              onClick={handleCopy}
              title="Copy message"
              className="ml-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-0.5"
            >
              {copied ? (
                <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}
          {debugMode && isAssistant && (
            <button
              onClick={downloadRaw}
              title="Download raw message JSON"
              className="ml-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-0.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              raw
            </button>
          )}
        </div>

        {/* Routing debug panel — only when Labs › Debug Mode is on */}
        {debugMode && isAssistant && message.routingDecision && (
          <div className="mt-1.5 mx-1 rounded border border-blue-700/30 bg-blue-950/20 px-2.5 py-1.5 text-[10px] text-slate-400 font-mono space-y-0.5">
            <div className="text-blue-400/70 font-sans font-semibold tracking-wide mb-1">routing debug</div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
              <span>
                <span className="text-slate-500">complexity </span>
                <span className={
                  message.routingDecision.complexity === 3 ? 'text-red-400' :
                  message.routingDecision.complexity === 2 ? 'text-yellow-400' :
                  'text-green-400'
                }>{message.routingDecision.complexity}</span>
              </span>
              <span>
                <span className="text-slate-500">task </span>
                <span className="text-slate-300">{message.routingDecision.taskType}</span>
              </span>
            </div>
            <div>
              <span className="text-slate-500">original </span>
              <span className="text-slate-300">{message.routingDecision.originalProviderId} / {message.routingDecision.originalModel}</span>
            </div>
            <div>
              <span className="text-slate-500">final    </span>
              <span className={
                message.routingDecision.finalModel !== message.routingDecision.originalModel ||
                message.routingDecision.finalProviderId !== message.routingDecision.originalProviderId
                  ? 'text-blue-300' : 'text-slate-300'
              }>{message.routingDecision.finalProviderId} / {message.routingDecision.finalModel}</span>
            </div>
            <div>
              <span className="text-slate-500">reason   </span>
              <span className="text-slate-300">{message.routingDecision.reason}</span>
            </div>
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 ml-2.5 mt-0.5 flex-shrink-0">
          U
        </div>
      )}
    </div>
  );
});

export default MessageBubble;
