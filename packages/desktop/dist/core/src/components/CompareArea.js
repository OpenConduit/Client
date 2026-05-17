import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useEffect, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCompare } from '../hooks/useCompare';
import InputBar from './InputBar';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
function ColumnHeader({ col, canRemove, onUpdate, onRemove }) {
    const { settings, models, loadModels } = useSettingsStore();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);
    // Load all provider models when the dropdown opens
    useEffect(() => {
        if (open) {
            settings?.providers.forEach((p) => { if (!models[p.id])
                loadModels(p.id); });
            setSearch('');
        }
    }, [open, settings?.providers, models, loadModels]);
    // Close on outside click
    useEffect(() => {
        if (!open)
            return;
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target))
                setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);
    const selectModel = useCallback((pid, m) => {
        onUpdate(col.id, { providerId: pid, model: m, routingProfileId: undefined });
        setOpen(false);
    }, [col.id, onUpdate]);
    const selectProfile = useCallback((profileId) => {
        onUpdate(col.id, { routingProfileId: profileId, providerId: '', model: '' });
        setOpen(false);
    }, [col.id, onUpdate]);
    const lowerSearch = search.toLowerCase();
    const activeProfile = col.routingProfileId
        ? settings?.routingProfiles?.find((p) => p.id === col.routingProfileId)
        : undefined;
    const providerName = settings?.providers.find((p) => p.id === col.providerId)?.name ?? '';
    const label = activeProfile
        ? activeProfile.name
        : providerName && col.model
            ? `${providerName} · ${col.model}`
            : 'Select model…';
    const profiles = (settings?.routingProfiles ?? []).filter((p) => !lowerSearch || p.name.toLowerCase().includes(lowerSearch));
    return (_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-850 flex-shrink-0", children: [_jsxs("div", { ref: ref, className: "relative flex-1 min-w-0", children: [_jsxs("button", { onClick: () => setOpen((o) => !o), className: "w-full flex items-center gap-1.5 bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none hover:border-blue-500 cursor-pointer transition-colors", children: [_jsx("span", { className: "truncate flex-1 text-left", children: label }), _jsx("svg", { className: "w-3 h-3 text-slate-500 flex-shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) })] }), open && (_jsxs("div", { className: "absolute left-0 top-full mt-1 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden", children: [_jsx("div", { className: "p-2 border-b border-slate-700", children: _jsx("input", { autoFocus: true, value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Search models\u2026", className: "w-full bg-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none placeholder-slate-500" }) }), _jsxs("div", { className: "overflow-y-auto max-h-72", children: [profiles.length > 0 && (_jsxs("div", { children: [_jsx("div", { className: "px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide", children: "Routing Profiles" }), profiles.map((profile) => (_jsxs("button", { onClick: () => selectProfile(profile.id), className: "w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors text-slate-300", children: [_jsx("span", { className: "text-blue-400", children: "\u21E2" }), _jsx("span", { className: "truncate flex-1", children: profile.name }), col.routingProfileId === profile.id && (_jsx("span", { className: "text-blue-400 flex-shrink-0", children: "\u2713" }))] }, profile.id))), _jsx("div", { className: "border-t border-slate-700 my-1" })] })), settings?.providers.map((provider) => {
                                        const all = [
                                            ...(provider.customModels ?? []),
                                            ...(models[provider.id] ?? []).filter((m) => !provider.customModels?.includes(m)),
                                        ];
                                        const filtered = all.filter((m) => !lowerSearch || m.toLowerCase().includes(lowerSearch) || provider.name.toLowerCase().includes(lowerSearch));
                                        if (filtered.length === 0)
                                            return null;
                                        return (_jsxs("div", { children: [_jsx("div", { className: "px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide", children: provider.name }), filtered.map((m) => {
                                                    const isActive = col.providerId === provider.id && col.model === m;
                                                    return (_jsxs("button", { onClick: () => selectModel(provider.id, m), className: `w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-300'}`, children: [_jsx("span", { className: `w-3 flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-0'}`, children: "\u2713" }), _jsx("span", { className: "truncate", children: m })] }, m));
                                                })] }, provider.id));
                                    })] })] }))] }), canRemove && (_jsx("button", { onClick: () => onRemove(col.id), className: "p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors flex-shrink-0", title: "Remove column", children: _jsx("svg", { className: "w-3.5 h-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) }))] }));
}
function ColumnView({ col, canRemove, onUpdate, onRemove, onContinue }) {
    const scrollRef = useRef(null);
    // Auto-scroll to bottom while streaming
    useEffect(() => {
        if (col.isStreaming && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [col.messages, col.isStreaming]);
    const lastAssistant = [...col.messages].reverse().find((m) => m.role === 'assistant');
    const canContinue = !col.isStreaming && !!lastAssistant?.content;
    const latestUsage = lastAssistant?.usage;
    const latencyMs = col.startedAt && col.endedAt ? col.endedAt - col.startedAt : null;
    return (_jsxs("div", { className: "flex-1 flex flex-col min-w-0 border-r border-slate-700 last:border-r-0", children: [_jsx(ColumnHeader, { col: col, canRemove: canRemove, onUpdate: onUpdate, onRemove: onRemove }), _jsxs("div", { ref: scrollRef, className: "flex-1 overflow-y-auto p-3 flex flex-col gap-3", children: [col.messages.length === 0 ? (_jsx("p", { className: "text-slate-500 text-xs m-auto", children: "Send a prompt to compare." })) : (col.messages.map((msg, i) => (_jsx("div", { className: msg.role === 'user' ? 'flex justify-end' : '', children: msg.role === 'user' ? (_jsx("div", { className: "max-w-[85%] bg-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100", children: msg.content })) : (_jsx("div", { className: "text-sm text-slate-200 prose prose-invert prose-sm max-w-none", children: msg.content ? (_jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], children: msg.content })) : col.isStreaming ? (_jsx("span", { className: "inline-block w-2 h-4 bg-blue-400 animate-pulse rounded-sm" })) : null })) }, i)))), col.error && (_jsxs("p", { className: "text-red-400 text-xs", children: ["\u26A0\uFE0F ", col.error] }))] }), canContinue && (_jsxs("div", { className: "flex items-center justify-between gap-2 px-3 py-2 border-t border-slate-700 bg-slate-900 flex-shrink-0", children: [_jsxs("div", { className: "flex items-center gap-3 text-xs text-slate-500", children: [latencyMs !== null && _jsxs("span", { children: [(latencyMs / 1000).toFixed(1), "s"] }), latestUsage && (_jsxs("span", { children: [latestUsage.inputTokens.toLocaleString(), " in \u00B7 ", latestUsage.outputTokens.toLocaleString(), " out"] }))] }), _jsx("button", { onClick: () => onContinue(col), className: "text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors", children: "Continue with this model \u2192" })] }))] }));
}
// ─── Main CompareArea component ───────────────────────────────────────────────
export default function CompareArea() {
    const { setCompareMode } = useUiStore();
    const { columns, anyStreaming, sendToAll, abortAll, clearAll, updateColumn, addColumn, removeColumn, continueWith, } = useCompare();
    const isMac = navigator.userAgent.includes('Mac OS X');
    const { sidebarOpen } = useUiStore();
    const dragStyle = { WebkitAppRegion: 'drag' };
    const noDragStyle = { WebkitAppRegion: 'no-drag' };
    return (_jsxs("div", { className: "flex-1 flex flex-col min-w-0 bg-slate-900 overflow-hidden", children: [_jsxs("header", { style: dragStyle, className: `flex items-center gap-3 px-4 py-2.5 border-b border-slate-700 bg-slate-900 flex-shrink-0${!sidebarOpen && isMac ? ' pl-[80px]' : ''}`, children: [_jsx("span", { style: noDragStyle, className: "text-sm font-semibold text-slate-200", children: "Compare Models" }), _jsxs("span", { className: "text-xs text-slate-500", children: [columns.length, " columns"] }), _jsx("div", { className: "flex-1" }), columns.length < 4 && (_jsxs("button", { style: noDragStyle, onClick: addColumn, className: "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors", children: [_jsx("svg", { className: "w-3.5 h-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) }), "Add column"] })), _jsx("button", { style: noDragStyle, onClick: () => setCompareMode(false), className: "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors", children: "\u2190 Back to chat" })] }), _jsx("div", { className: "flex-1 flex overflow-hidden", children: columns.map((col) => (_jsx(ColumnView, { col: col, canRemove: columns.length > 2, onUpdate: updateColumn, onRemove: removeColumn, onContinue: continueWith }, col.id))) }), _jsx(InputBar, { onSend: sendToAll, onAbort: abortAll, onClear: clearAll, isStreaming: anyStreaming, conversationId: null })] }));
}
//# sourceMappingURL=CompareArea.js.map