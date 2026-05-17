import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useRef, useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { useConversationStore } from '../stores/conversationStore';
import { getContextLimit, fmtTok } from '../utils/context';
import { service } from '../services';
const ACCEPTED_TYPES = 'image/*,text/*,.pdf,.csv,.json,.md,.ts,.tsx,.js,.jsx,.py';
const REASONING_CYCLE = ['off', 'low', 'medium', 'high'];
const REASONING_LABEL = { off: 'off', low: 'L', medium: 'M', high: 'H' };
const REASONING_COLOR = {
    off: 'text-slate-500',
    low: 'text-yellow-400',
    medium: 'text-orange-400',
    high: 'text-red-400',
};
export default function InputBar({ onSend, onAbort, onClear, onCompact, onTrim, isStreaming, isCompacting, disabled, conversationId }) {
    const [content, setContent] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [reasoning, setReasoning] = useState('off');
    const [mcpOpen, setMcpOpen] = useState(false);
    const [ctxOpen, setCtxOpen] = useState(false);
    const [connecting, setConnecting] = useState(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const mcpRef = useRef(null);
    const ctxRef = useRef(null);
    const { settings, mcpStatus, saveSettings, refreshMcpStatus } = useSettingsStore();
    const updateConversation = useConversationStore((s) => s.updateConversation);
    // ── Context window usage ──────────────────────────────────────────────────
    const analyticsRecords = useAnalyticsStore((s) => s.records);
    const conversations = useConversationStore((s) => s.conversations);
    const activeConv = conversationId ? conversations.find((c) => c.id === conversationId) : null;
    const convModel = activeConv?.model ?? '';
    const convProviderId = activeConv?.providerId ?? '';
    // Provider-configured context window takes priority over built-in table
    const providerContextWindow = convProviderId
        ? settings?.providers?.find((p) => p.id === convProviderId)?.modelContextWindows?.[convModel] ?? null
        : null;
    const contextLimit = providerContextWindow ?? getContextLimit(convModel);
    const usedTokens = conversationId
        ? analyticsRecords
            .filter((r) => r.conversationId === conversationId)
            .reduce((s, r) => s + r.usage.inputTokens + r.usage.outputTokens, 0)
        : 0;
    const ctxPct = contextLimit && usedTokens > 0 ? Math.min((usedTokens / contextLimit) * 100, 100) : null;
    const showCtx = usedTokens > 0;
    // Close MCP popover on outside click
    React.useEffect(() => {
        if (!mcpOpen)
            return;
        const handler = (e) => {
            if (mcpRef.current && !mcpRef.current.contains(e.target))
                setMcpOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [mcpOpen]);
    // Close context popover on outside click
    React.useEffect(() => {
        if (!ctxOpen)
            return;
        const handler = (e) => {
            if (ctxRef.current && !ctxRef.current.contains(e.target))
                setCtxOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [ctxOpen]);
    const handleSend = useCallback(() => {
        const trimmed = content.trim();
        if (!trimmed && attachments.length === 0)
            return;
        onSend(trimmed, attachments.length > 0 ? attachments : undefined);
        setContent('');
        setAttachments([]);
        textareaRef.current?.focus();
    }, [content, attachments, onSend]);
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isStreaming)
                handleSend();
        }
    };
    const handleTextareaChange = (e) => {
        setContent(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 200) + 'px';
    };
    const handleFiles = (files) => {
        if (!files)
            return;
        Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result;
                const base64 = result.includes(',') ? result.split(',')[1] : result;
                setAttachments((prev) => [
                    ...prev,
                    {
                        id: crypto.randomUUID(),
                        name: file.name,
                        mimeType: file.type || 'application/octet-stream',
                        data: base64,
                        size: file.size,
                    },
                ]);
            };
            // Images and PDFs stored as base64; text files stored as plain text.
            // Providers handle PDFs natively (Anthropic/Gemini) or extract text themselves (OpenAI).
            if (file.type.startsWith('image/') || file.type === 'application/pdf')
                reader.readAsDataURL(file);
            else
                reader.readAsText(file);
        });
    };
    const handleDrop = (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); };
    const handlePaste = (e) => { if (e.clipboardData.files.length > 0)
        handleFiles(e.clipboardData.files); };
    const removeAttachment = (id) => setAttachments((prev) => prev.filter((a) => a.id !== id));
    const cycleReasoning = () => setReasoning((r) => REASONING_CYCLE[(REASONING_CYCLE.indexOf(r) + 1) % REASONING_CYCLE.length]);
    const mcpServers = settings?.mcpServers ?? [];
    // Per-conversation active servers: when activeMcpServerIds is set on the conversation,
    // use that set; otherwise fall back to globally-enabled servers.
    const convActiveMcpIds = activeConv?.activeMcpServerIds
        ? new Set(activeConv.activeMcpServerIds)
        : null;
    const isServerActiveForConv = (id) => convActiveMcpIds ? convActiveMcpIds.has(id) : (mcpServers.find((s) => s.id === id)?.enabled ?? false);
    const enabledCount = mcpServers.filter((s) => isServerActiveForConv(s.id)).length;
    const canSend = (content.trim().length > 0 || attachments.length > 0) && !isStreaming && !disabled;
    return (_jsxs("div", { className: "px-4 pb-3 pt-1 flex-shrink-0", onDrop: handleDrop, onDragOver: (e) => e.preventDefault(), children: [attachments.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-2 mb-2", children: attachments.map((att) => (_jsxs("div", { className: "flex items-center gap-1.5 bg-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300", children: [att.mimeType.startsWith('image/') ? (_jsx("img", { src: `data:${att.mimeType};base64,${att.data}`, alt: att.name, className: "w-8 h-8 object-cover rounded" })) : (_jsx("svg", { className: "w-4 h-4 text-slate-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }) })), _jsx("span", { className: "max-w-[120px] truncate", children: att.name }), _jsx("button", { onClick: () => removeAttachment(att.id), className: "text-slate-500 hover:text-slate-200 ml-0.5", children: "\u00D7" })] }, att.id))) })), _jsxs("div", { className: "flex items-end gap-2 bg-slate-800 border border-slate-600 focus-within:border-blue-500 rounded-2xl px-3 py-2 transition-colors", children: [_jsx("textarea", { ref: textareaRef, value: content, onChange: handleTextareaChange, onKeyDown: handleKeyDown, onPaste: handlePaste, placeholder: disabled ? 'Select a conversation to chat…' : 'Enter a message here, press ↵ to send', disabled: disabled || isStreaming, rows: 1, className: "flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm resize-none outline-none max-h-48 overflow-y-auto leading-relaxed disabled:opacity-50", style: { minHeight: '24px' } }), isStreaming ? (_jsx("button", { onClick: onAbort, className: "p-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex-shrink-0 self-end mb-0.5", title: "Stop generating", children: _jsx("svg", { className: "w-4 h-4", fill: "currentColor", viewBox: "0 0 24 24", children: _jsx("rect", { x: "6", y: "6", width: "12", height: "12", rx: "1" }) }) })) : (_jsx("button", { onClick: handleSend, disabled: !canSend, className: "p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors flex-shrink-0 self-end mb-0.5", title: "Send (Enter)", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8" }) }) }))] }), _jsxs("div", { className: "flex items-center gap-0.5 mt-1.5 px-1", children: [_jsx(ToolbarButton, { icon: _jsx(AttachIcon, {}), label: "Attach file", onClick: () => fileInputRef.current?.click(), disabled: isStreaming }), _jsx("input", { ref: fileInputRef, type: "file", accept: ACCEPTED_TYPES, multiple: true, className: "hidden", onChange: (e) => handleFiles(e.target.files) }), _jsx(ToolbarButton, { icon: _jsx(CommandIcon, {}), label: "Prompt library (coming soon)", comingSoon: true }), _jsx(ToolbarButton, { icon: _jsx(ReasoningIcon, { level: reasoning }), label: reasoning === 'off' ? 'Reasoning: off (coming soon)' : `Reasoning: ${reasoning} (coming soon)`, comingSoon: true, onClick: cycleReasoning, active: reasoning !== 'off', activeClass: REASONING_COLOR[reasoning] }), _jsx(ToolbarButton, { icon: _jsx(WebIcon, {}), label: "Web search (coming soon)", comingSoon: true }), mcpServers.length > 0 && (_jsxs("div", { className: "relative", ref: mcpRef, children: [_jsxs("button", { onClick: () => { setMcpOpen((o) => !o); if (!mcpOpen)
                                    refreshMcpStatus(); }, className: `flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors ${mcpOpen || enabledCount > 0
                                    ? 'text-blue-400 hover:bg-slate-700'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'}`, title: "MCP servers", children: [_jsx(McpIcon, {}), _jsxs("span", { className: "font-medium", children: [enabledCount, "/", mcpServers.length] })] }), mcpOpen && (_jsxs("div", { className: "absolute bottom-full mb-2 left-0 w-72 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 py-1.5", children: [_jsxs("div", { className: "flex items-center justify-between px-3 pt-1 pb-1.5", children: [_jsx("p", { className: "text-[10px] text-slate-500 uppercase tracking-wider font-medium", children: "MCP Servers" }), convActiveMcpIds && (_jsx("button", { className: "text-[10px] text-amber-400 hover:text-amber-300 transition-colors", title: "Clear per-conversation overrides and use global settings", onClick: () => conversationId && updateConversation(conversationId, { activeMcpServerIds: undefined }), children: "reset to global" }))] }), mcpServers.map((s) => {
                                        const connected = !!mcpStatus[s.id];
                                        return (_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 hover:bg-slate-700/60 transition-colors", children: [_jsx("span", { className: `w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? 'bg-green-400' : 'bg-slate-600'}` }), _jsx("span", { className: "text-xs text-slate-200 flex-1 truncate", children: s.name }), _jsx("button", { disabled: connecting === s.id, onClick: async () => {
                                                        setConnecting(s.id);
                                                        try {
                                                            if (connected)
                                                                await service.mcp.disconnect(s.id);
                                                            else
                                                                await service.mcp.connect(s);
                                                            await refreshMcpStatus();
                                                        }
                                                        catch (err) {
                                                            alert(`MCP: ${err}`);
                                                        }
                                                        finally {
                                                            setConnecting(null);
                                                        }
                                                    }, className: `text-[10px] px-1.5 py-0.5 rounded transition-colors disabled:opacity-40 ${connected ? 'text-red-400 hover:bg-red-900/30' : 'text-green-400 hover:bg-green-900/30'}`, children: connecting === s.id ? '…' : connected ? 'Disc.' : 'Conn.' }), _jsx("button", { onClick: () => {
                                                        const active = isServerActiveForConv(s.id);
                                                        if (conversationId && activeConv) {
                                                            // Build updated per-conversation list
                                                            const globalEnabled = mcpServers.filter((sv) => sv.enabled).map((sv) => sv.id);
                                                            const current = convActiveMcpIds ? [...convActiveMcpIds] : globalEnabled;
                                                            const next = active
                                                                ? current.filter((id) => id !== s.id)
                                                                : [...current, s.id];
                                                            // If next matches global enabled exactly, clear the override
                                                            const nextSet = new Set(next);
                                                            const globalSet = new Set(globalEnabled);
                                                            const matchesGlobal = next.length === globalEnabled.length &&
                                                                globalEnabled.every((id) => nextSet.has(id));
                                                            updateConversation(conversationId, {
                                                                activeMcpServerIds: matchesGlobal ? undefined : next,
                                                            });
                                                        }
                                                        else {
                                                            // No active conversation — fall back to toggling global setting
                                                            saveSettings({ mcpServers: settings.mcpServers.map((sv) => sv.id === s.id ? { ...sv, enabled: !sv.enabled } : sv) });
                                                        }
                                                    }, className: `text-[10px] px-1.5 py-0.5 rounded border transition-colors ${isServerActiveForConv(s.id)
                                                        ? 'border-blue-500 text-blue-300 bg-blue-900/30'
                                                        : 'border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-300'}`, title: isServerActiveForConv(s.id) ? 'Exclude from this chat' : 'Include in this chat', children: isServerActiveForConv(s.id) ? 'On' : 'Off' })] }, s.id));
                                    })] }))] })), _jsx(ToolbarButton, { icon: _jsx(AgentIcon, {}), label: "Agent / folder access (coming soon)", comingSoon: true }), _jsx("div", { className: "flex-1" }), showCtx && (_jsxs("div", { ref: ctxRef, className: "relative", children: [_jsxs("button", { type: "button", onClick: () => setCtxOpen((o) => !o), className: `flex items-center gap-1.5 px-2 rounded hover:bg-slate-800 transition-colors ${ctxPct !== null && ctxPct >= 90 ? 'text-red-400' :
                                    ctxPct !== null && ctxPct >= 70 ? 'text-amber-400' :
                                        'text-slate-500 hover:text-slate-300'}`, title: contextLimit
                                    ? `${usedTokens.toLocaleString()} / ${contextLimit.toLocaleString()} tokens (${ctxPct.toFixed(0)}%) — click to manage`
                                    : `${usedTokens.toLocaleString()} tokens used — click to manage`, children: [_jsx("div", { className: "w-16 h-1 rounded-full bg-slate-700 overflow-hidden", children: contextLimit ? (_jsx("div", { className: `h-full rounded-full transition-all duration-500 ${ctxPct >= 90 ? 'bg-red-500' : ctxPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`, style: { width: `${ctxPct}%` } })) : (_jsx("div", { className: "h-full w-1/4 rounded-full bg-slate-500 opacity-60" })) }), _jsx("span", { className: "text-[10px]", children: contextLimit ? `${fmtTok(usedTokens)}/${fmtTok(contextLimit)}` : `${fmtTok(usedTokens)} tok` })] }), ctxOpen && (_jsxs("div", { className: "absolute bottom-full right-0 mb-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-3 space-y-2 z-20", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1", children: "Manage Context" }), _jsxs("div", { className: "text-xs text-slate-400 pb-1", children: [usedTokens.toLocaleString(), " tokens used", contextLimit ? ` of ${contextLimit.toLocaleString()} (${ctxPct.toFixed(0)}%)` : ''] }), isCompacting ? (_jsx("p", { className: "text-xs text-slate-400 italic", children: "Summarizing\u2026" })) : (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", onClick: () => { setCtxOpen(false); onCompact?.(); }, disabled: isStreaming, className: "w-full text-left px-3 py-2 rounded-lg text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-40 transition-colors", children: [_jsx("span", { className: "font-medium", children: "\uD83D\uDCCB Summarize" }), _jsx("p", { className: "text-slate-500 mt-0.5", children: "AI summarizes the chat, then replaces all messages with the summary" })] }), _jsxs("button", { type: "button", onClick: () => { setCtxOpen(false); onTrim?.(); }, disabled: isStreaming, className: "w-full text-left px-3 py-2 rounded-lg text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 disabled:opacity-40 transition-colors", children: [_jsx("span", { className: "font-medium", children: "\u2702\uFE0F Trim oldest" }), _jsx("p", { className: "text-slate-500 mt-0.5", children: "Removes the oldest messages to free up context space" })] })] }))] }))] })), onClear && (_jsx(ToolbarButton, { icon: _jsx(ClearIcon, {}), label: "Clear chat", onClick: () => { if (confirm('Clear all messages in this conversation?'))
                            onClear(); }, disabled: isStreaming, hoverClass: "hover:text-red-400" })), _jsx(ToolbarButton, { icon: _jsx(MoreIcon, {}), label: "More options (coming soon)", comingSoon: true })] })] }));
}
// ─── Toolbar button helper ─────────────────────────────────────────────────
function ToolbarButton({ icon, label, onClick, disabled, comingSoon, active, activeClass, hoverClass, }) {
    return (_jsx("button", { onClick: onClick, disabled: disabled || comingSoon, title: label, className: `p-1.5 rounded-lg transition-colors text-sm
        ${comingSoon ? 'opacity-40 cursor-not-allowed text-slate-500' : ''}
        ${!comingSoon && !disabled ? `${hoverClass ?? 'hover:text-slate-200'} hover:bg-slate-700` : ''}
        ${active ? activeClass ?? 'text-blue-400' : comingSoon ? '' : 'text-slate-500'}
        disabled:opacity-40`, children: icon }));
}
// ─── Icons ─────────────────────────────────────────────────────────────────
const AttachIcon = () => (_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" }) }));
const CommandIcon = () => (_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M7 20l4-16m2 16l4-16M6 9h14M4 15h14" }) }));
const ReasoningIcon = ({ level }) => (_jsx("span", { className: `text-[11px] font-bold leading-none w-4 text-center inline-block ${REASONING_COLOR[level]}`, children: level === 'off' ? (_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" }) })) : REASONING_LABEL[level] }));
const WebIcon = () => (_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" }) }));
const McpIcon = () => (_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" }) }));
const AgentIcon = () => (_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" }) }));
const ClearIcon = () => (_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }));
const MoreIcon = () => (_jsxs("svg", { className: "w-4 h-4", fill: "currentColor", viewBox: "0 0 24 24", children: [_jsx("circle", { cx: "5", cy: "12", r: "1.5" }), _jsx("circle", { cx: "12", cy: "12", r: "1.5" }), _jsx("circle", { cx: "19", cy: "12", r: "1.5" })] }));
//# sourceMappingURL=InputBar.js.map