import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js';
import ToolCallCard from './ToolCallCard';
import QuestionsCard from './QuestionsCard';
import { useSettingsStore } from '../stores/settingsStore';
const MessageBubble = memo(function MessageBubble({ message, onApprove, onDeny, onSendAnswers }) {
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
    return (_jsxs("div", { className: `flex w-full ${isUser ? 'justify-end' : 'justify-start'} px-4 py-1.5`, children: [!isUser && (_jsx("div", { className: "w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white mr-2.5 mt-0.5 flex-shrink-0", children: "AI" })), _jsxs("div", { className: `max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`, children: [isAssistant && message.thinking && (_jsxs("div", { className: "w-full mb-1.5", children: [_jsxs("button", { onClick: () => setThinkingOpen((o) => !o), className: "flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors select-none", children: [_jsx("svg", { className: "w-3.5 h-3.5 shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" }) }), _jsx("span", { children: "Thinking" }), _jsx("svg", { className: `w-3 h-3 transition-transform duration-150 ${thinkingOpen ? 'rotate-90' : ''}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) })] }), thinkingOpen && (_jsx("div", { className: "mt-1 rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2.5 text-xs text-slate-400 italic leading-relaxed whitespace-pre-wrap font-mono max-h-64 overflow-y-auto", children: message.thinking }))] })), _jsxs("div", { className: `rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isUser
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-slate-800 text-slate-100 rounded-bl-sm border border-slate-700'}`, children: [message.attachments?.map((att) => (_jsx("div", { className: "mb-2", children: att.mimeType.startsWith('image/') ? (_jsx("img", { src: `data:${att.mimeType};base64,${att.data}`, alt: att.name, className: "max-w-full max-h-64 rounded-lg" })) : (_jsxs("div", { className: "flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-300", children: [_jsx("svg", { className: "w-4 h-4 flex-shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) }), att.name] })) }, att.id))), isUser ? (_jsx("p", { className: "whitespace-pre-wrap", children: message.content })) : (_jsx("div", { className: "prose-ai", children: _jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], components: {
                                        code({ className, children }) {
                                            const match = /language-(\w+)/.exec(className ?? '');
                                            const codeStr = String(children).replace(/\n$/, '');
                                            if (match) {
                                                try {
                                                    const highlighted = hljs.highlight(codeStr, { language: match[1] });
                                                    return (_jsx("pre", { className: "bg-slate-900 rounded-lg overflow-x-auto my-3", children: _jsx("code", { className: `hljs language-${match[1]} text-[12px] p-4 block font-mono leading-relaxed`, dangerouslySetInnerHTML: { __html: highlighted.value } }) }));
                                                }
                                                catch {
                                                    // fall through
                                                }
                                            }
                                            return (_jsx("code", { className: "bg-slate-700 text-pink-300 px-1.5 py-0.5 rounded text-[12px] font-mono", children: children }));
                                        },
                                    }, children: message.content }) })), message.isStreaming && !message.toolCalls?.length && (_jsx("span", { className: "inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5 rounded-sm align-middle" }))] }), message.toolCalls?.map((tc) => (_jsx("div", { className: "w-full mt-1", children: _jsx(ToolCallCard, { toolCall: tc, onApprove: onApprove, onDeny: onDeny }) }, tc.id))), message.aiQuestions?.length && onSendAnswers && (_jsx("div", { className: "w-full", children: _jsx(QuestionsCard, { questions: message.aiQuestions, onSubmit: (answers) => onSendAnswers(message.aiQuestions, answers) }) })), _jsxs("div", { className: "flex items-center gap-2 mt-1 px-1", children: [message.model && (_jsx("span", { className: "text-[10px] text-slate-500", children: message.model })), isAssistant && message.routingDecision &&
                                (message.routingDecision.finalModel !== message.routingDecision.originalModel ||
                                    message.routingDecision.finalProviderId !== message.routingDecision.originalProviderId) && (_jsxs("span", { className: "relative group cursor-help flex items-center gap-1", children: [_jsx("span", { className: "text-[10px] text-slate-600", children: "\u00B7" }), _jsxs("span", { className: "text-[10px] text-slate-600", children: ["c", message.routingDecision.complexity] }), _jsxs("span", { className: "pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[220px] rounded bg-slate-800 border border-slate-700 px-2 py-1 text-[10px] text-slate-300 leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 shadow-lg", children: [_jsx("span", { className: "block font-medium text-slate-200 mb-0.5", children: message.routingDecision.reason }), _jsxs("span", { className: "text-slate-400", children: ["task \u00B7 ", message.routingDecision.taskType] })] })] })), _jsx("span", { className: "text-[10px] text-slate-600", children: (() => {
                                    const d = new Date(message.timestamp);
                                    const now = new Date();
                                    const isToday = d.getFullYear() === now.getFullYear() &&
                                        d.getMonth() === now.getMonth() &&
                                        d.getDate() === now.getDate();
                                    return isToday
                                        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
                                            ' ' +
                                            d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                })() }), isAssistant && message.usage && (_jsxs("span", { className: "text-[10px] text-slate-600", title: `${message.usage.inputTokens.toLocaleString()} in / ${message.usage.outputTokens.toLocaleString()} out`, children: [(message.usage.inputTokens + message.usage.outputTokens).toLocaleString(), " tok"] })), isAssistant && !message.isStreaming && (_jsx("button", { onClick: handleCopy, title: "Copy message", className: "ml-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-0.5", children: copied ? (_jsx("svg", { className: "w-3 h-3 text-green-500", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) })) : (_jsx("svg", { className: "w-3 h-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" }) })) })), debugMode && isAssistant && (_jsxs("button", { onClick: downloadRaw, title: "Download raw message JSON", className: "ml-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-0.5", children: [_jsx("svg", { className: "w-3 h-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" }) }), "raw"] }))] }), debugMode && isAssistant && message.routingDecision && (_jsxs("div", { className: "mt-1.5 mx-1 rounded border border-blue-700/30 bg-blue-950/20 px-2.5 py-1.5 text-[10px] text-slate-400 font-mono space-y-0.5", children: [_jsx("div", { className: "text-blue-400/70 font-sans font-semibold tracking-wide mb-1", children: "routing debug" }), _jsxs("div", { className: "flex flex-wrap gap-x-4 gap-y-0.5", children: [_jsxs("span", { children: [_jsx("span", { className: "text-slate-500", children: "complexity " }), _jsx("span", { className: message.routingDecision.complexity === 3 ? 'text-red-400' :
                                                    message.routingDecision.complexity === 2 ? 'text-yellow-400' :
                                                        'text-green-400', children: message.routingDecision.complexity })] }), _jsxs("span", { children: [_jsx("span", { className: "text-slate-500", children: "task " }), _jsx("span", { className: "text-slate-300", children: message.routingDecision.taskType })] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: "original " }), _jsxs("span", { className: "text-slate-300", children: [message.routingDecision.originalProviderId, " / ", message.routingDecision.originalModel] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: "final    " }), _jsxs("span", { className: message.routingDecision.finalModel !== message.routingDecision.originalModel ||
                                            message.routingDecision.finalProviderId !== message.routingDecision.originalProviderId
                                            ? 'text-blue-300' : 'text-slate-300', children: [message.routingDecision.finalProviderId, " / ", message.routingDecision.finalModel] })] }), _jsxs("div", { children: [_jsx("span", { className: "text-slate-500", children: "reason   " }), _jsx("span", { className: "text-slate-300", children: message.routingDecision.reason })] })] }))] }), isUser && (_jsx("div", { className: "w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 ml-2.5 mt-0.5 flex-shrink-0", children: "U" }))] }));
});
export default MessageBubble;
//# sourceMappingURL=MessageBubble.js.map