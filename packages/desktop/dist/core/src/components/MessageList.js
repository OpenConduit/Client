import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
export default function MessageList({ messages, onApprove, onDeny, onSendAnswers }) {
    const bottomRef = useRef(null);
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages.length, messages[messages.length - 1]?.content]);
    if (messages.length === 0) {
        return (_jsxs("div", { className: "flex-1 flex flex-col items-center justify-center text-slate-500 select-none", children: [_jsx("svg", { className: "w-12 h-12 mb-4 text-slate-700", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" }) }), _jsx("p", { className: "text-sm font-medium text-slate-600", children: "Start a conversation" }), _jsx("p", { className: "text-xs text-slate-700 mt-1", children: "Select a provider and model in the top bar" })] }));
    }
    return (_jsxs("div", { className: "flex-1 overflow-y-auto py-4", children: [messages
                .filter((m) => m.role !== 'tool_result')
                .map((msg) => (_jsx(MessageBubble, { message: msg, onApprove: onApprove, onDeny: onDeny, onSendAnswers: onSendAnswers }, msg.id))), _jsx("div", { ref: bottomRef })] }));
}
//# sourceMappingURL=MessageList.js.map