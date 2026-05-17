import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
export default function SystemPromptEditor({ conversationId }) {
    const { conversations, updateConversation } = useConversationStore();
    const { showSystemPrompt, setShowSystemPrompt } = useUiStore();
    const conv = conversations.find((c) => c.id === conversationId);
    return (_jsxs("div", { className: "border-t border-slate-700 flex-shrink-0", children: [_jsxs("button", { onClick: () => setShowSystemPrompt(!showSystemPrompt), className: "w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors", children: [_jsx("svg", { className: `w-3 h-3 transition-transform ${showSystemPrompt ? 'rotate-90' : ''}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) }), "System Prompt", conv?.systemPrompt && (_jsx("span", { className: "ml-auto text-blue-400 text-[10px]", children: "active" }))] }), showSystemPrompt && (_jsx("div", { className: "px-4 pb-3", children: _jsx("textarea", { value: conv?.systemPrompt ?? '', onChange: (e) => updateConversation(conversationId, { systemPrompt: e.target.value || undefined }), placeholder: "You are a helpful assistant\u2026", rows: 4, className: "w-full bg-slate-800 border border-slate-600 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none outline-none leading-relaxed" }) }))] }));
}
//# sourceMappingURL=SystemPromptEditor.js.map