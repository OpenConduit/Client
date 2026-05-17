import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
const isMac = navigator.userAgent.includes('Mac OS X');
function ModelPickerButton({ settings, models, loadModels, conversationId, conv }) {
    const { updateConversation } = useConversationStore();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);
    const noDrag = { WebkitAppRegion: 'no-drag' };
    // Load all provider models when the dropdown opens
    useEffect(() => {
        if (open) {
            settings.providers.forEach((p) => { if (!models[p.id])
                loadModels(p.id); });
            setSearch('');
        }
    }, [open, settings.providers, models, loadModels]);
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
    const activeProfile = conv.routingProfileId
        ? (settings.routingProfiles ?? []).find((p) => p.id === conv.routingProfileId)
        : undefined;
    const providerName = settings.providers.find((p) => p.id === conv.providerId)?.name ?? '';
    const label = activeProfile
        ? `${activeProfile.name}`
        : (providerName && conv.model ? `${providerName} · ${conv.model}` : 'Select model…');
    const lowerSearch = search.toLowerCase();
    const profiles = (settings.routingProfiles ?? []).filter((p) => !lowerSearch || p.name.toLowerCase().includes(lowerSearch));
    const selectModel = useCallback((pid, m) => {
        updateConversation(conversationId, { providerId: pid, model: m, routingProfileId: undefined });
        setOpen(false);
    }, [conversationId, updateConversation]);
    const selectProfile = useCallback((profileId) => {
        updateConversation(conversationId, { routingProfileId: profileId });
        setOpen(false);
    }, [conversationId, updateConversation]);
    return (_jsxs("div", { ref: ref, className: "relative", style: noDrag, children: [_jsxs("button", { onClick: () => setOpen((o) => !o), className: "flex items-center gap-1.5 bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none hover:border-blue-500 cursor-pointer max-w-[220px] transition-colors", children: [_jsx("span", { className: "truncate", children: label }), _jsx("svg", { className: "w-3 h-3 text-slate-500 flex-shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) })] }), open && (_jsxs("div", { className: "absolute right-0 top-full mt-1 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden", children: [_jsx("div", { className: "p-2 border-b border-slate-700", children: _jsx("input", { autoFocus: true, value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Search models\u2026", className: "w-full bg-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none placeholder-slate-500" }) }), _jsxs("div", { className: "overflow-y-auto max-h-80", children: [profiles.length > 0 && (_jsxs("div", { children: [_jsx("div", { className: "px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide", children: "Routing Profiles" }), profiles.map((profile) => (_jsxs("button", { onClick: () => selectProfile(profile.id), className: "w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors text-slate-300", children: [_jsx("span", { className: "text-blue-400" }), _jsx("span", { className: "truncate flex-1", children: profile.name }), conv.routingProfileId === profile.id && (_jsx("span", { className: "text-blue-400 flex-shrink-0", children: "\u2713" }))] }, profile.id))), _jsx("div", { className: "border-t border-slate-700 my-1" })] })), settings.providers.map((provider) => {
                                const all = [
                                    ...(provider.customModels ?? []),
                                    ...(models[provider.id] ?? []).filter((m) => !provider.customModels?.includes(m)),
                                ];
                                const filtered = all.filter((m) => !lowerSearch || m.toLowerCase().includes(lowerSearch) || provider.name.toLowerCase().includes(lowerSearch));
                                if (filtered.length === 0)
                                    return null;
                                return (_jsxs("div", { children: [_jsx("div", { className: "px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide", children: provider.name }), filtered.map((m) => {
                                            const isActive = !conv.routingProfileId && conv.providerId === provider.id && conv.model === m;
                                            return (_jsxs("button", { onClick: () => selectModel(provider.id, m), className: `w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-300'}`, children: [_jsx("span", { className: `w-3 flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-0'}`, children: "\u2713" }), _jsx("span", { className: "truncate", children: m })] }, m));
                                        })] }, provider.id));
                            })] })] }))] }));
}
export default function TopBar({ conversationId }) {
    const { conversations, updateConversation } = useConversationStore();
    const { settings, models, loadModels } = useSettingsStore();
    const { setSidebarOpen, sidebarOpen, setShowSettings, setCompareMode } = useUiStore();
    const conv = conversations.find((c) => c.id === conversationId);
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState('');
    const providerId = conv?.providerId ?? settings?.defaultProviderId ?? '';
    useEffect(() => {
        if (providerId && !models[providerId]) {
            loadModels(providerId);
        }
    }, [providerId, models, loadModels]);
    const handleTitleSave = () => {
        if (conversationId && titleDraft.trim()) {
            updateConversation(conversationId, { title: titleDraft.trim() });
        }
        setEditingTitle(false);
    };
    const dragStyle = { WebkitAppRegion: 'drag' };
    const noDragStyle = { WebkitAppRegion: 'no-drag' };
    return (_jsxs("header", { style: dragStyle, className: `flex items-center gap-3 px-4 py-2.5 border-b border-slate-700 bg-slate-900 flex-shrink-0${!sidebarOpen && isMac ? ' pl-[80px]' : ''}`, children: [_jsx("button", { onClick: () => setSidebarOpen(!sidebarOpen), style: noDragStyle, className: "p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors", title: "Toggle sidebar", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6h16M4 12h16M4 18h16" }) }) }), _jsx("div", { className: "flex-1 min-w-0", children: editingTitle ? (_jsx("input", { autoFocus: true, value: titleDraft, onChange: (e) => setTitleDraft(e.target.value), onBlur: handleTitleSave, onKeyDown: (e) => {
                        if (e.key === 'Enter')
                            handleTitleSave();
                        if (e.key === 'Escape')
                            setEditingTitle(false);
                    }, style: noDragStyle, className: "bg-slate-700 text-slate-100 rounded px-2 py-0.5 text-sm w-full max-w-xs outline-none" })) : (_jsx("button", { onClick: () => {
                        setTitleDraft(conv?.title ?? '');
                        setEditingTitle(true);
                    }, style: noDragStyle, className: "text-sm font-medium text-slate-300 hover:text-slate-100 truncate max-w-xs text-left transition-colors", title: "Click to rename", children: conv?.title ?? 'OpenConduit' })) }), settings && conversationId && conv && (_jsx(ModelPickerButton, { settings: settings, models: models, loadModels: loadModels, conversationId: conversationId, conv: conv })), _jsx("button", { onClick: () => setCompareMode(true), style: noDragStyle, className: "p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors", title: "Compare models", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" }) }) }), _jsx("button", { onClick: () => setShowSettings(true), style: noDragStyle, className: "p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors", title: "Settings", children: _jsxs("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [_jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" }), _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" })] }) })] }));
}
//# sourceMappingURL=TopBar.js.map