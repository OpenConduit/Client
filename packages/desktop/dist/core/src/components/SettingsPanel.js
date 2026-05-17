import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { service } from '../services';
import { McpMarketplace, ProviderMarketplace } from './MarketplacePanel';
export default function SettingsPanel({ extraTabs, hideTabs, }) {
    const { showSettings, setShowSettings } = useUiStore();
    const { settings, saveSettings, refreshMcpStatus, mcpStatus } = useSettingsStore();
    const [tab, setTab] = useState('general');
    if (!showSettings || !settings)
        return null;
    const builtInTabs = [
        { id: 'general', label: 'General' },
        { id: 'providers', label: 'Providers' },
        { id: 'mcp', label: 'MCP' },
        { id: 'features', label: 'Features' },
        { id: 'labs', label: 'Labs' },
        { id: 'analytics', label: 'Analytics' },
        { id: 'about', label: 'About' },
    ].filter((t) => !hideTabs?.includes(t.id));
    const allTabs = [
        ...builtInTabs,
        ...(extraTabs?.map((t) => ({ id: t.id, label: t.label })) ?? []),
    ];
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex", children: [_jsx("div", { className: "flex-1 bg-black/50", onClick: () => setShowSettings(false) }), _jsxs("div", { className: "w-[600px] max-w-full bg-slate-900 border-l border-slate-700 flex flex-col h-full shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0", children: [_jsx("h2", { className: "text-lg font-semibold text-slate-100", children: "Settings" }), _jsx("button", { onClick: () => setShowSettings(false), className: "p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors", children: _jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsx("div", { className: "flex gap-0.5 px-6 pt-3 flex-shrink-0 border-b border-slate-700/50 overflow-x-auto", children: allTabs.map((t) => (_jsx("button", { onClick: () => setTab(t.id), className: `px-3 py-1.5 rounded-t-lg text-xs font-medium whitespace-nowrap transition-colors ${tab === t.id
                                ? 'bg-slate-800 text-slate-100 border border-b-0 border-slate-700'
                                : 'text-slate-500 hover:text-slate-300'}`, children: t.label }, t.id))) }), _jsxs("div", { className: "flex-1 overflow-y-auto px-6 py-4", children: [tab === 'general' && _jsx(GeneralTab, { settings: settings, onSave: saveSettings }), tab === 'providers' && (_jsx(ProvidersTab, { settings: settings, onSave: saveSettings })), tab === 'mcp' && (_jsx(McpTab, { settings: settings, onSave: saveSettings, mcpStatus: mcpStatus, onRefreshStatus: refreshMcpStatus })), tab === 'labs' && _jsx(LabsTab, { settings: settings, onSave: saveSettings }), tab === 'features' && _jsx(FeaturesTab, { settings: settings, onSave: saveSettings }), tab === 'analytics' && _jsx(AnalyticsTab, { settings: settings, onSave: saveSettings }), tab === 'about' && _jsx(AboutTab, { settings: settings, onSave: saveSettings }), extraTabs?.map((t) => (_jsx(React.Fragment, { children: tab === t.id && t.content }, t.id)))] })] })] }));
}
// ─── General Tab ──────────────────────────────────────────────────────────────
function GeneralTab({ settings, onSave, }) {
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(Section, { title: "Appearance", children: _jsx(Field, { label: "Theme", children: _jsxs("select", { value: settings.theme, onChange: (e) => onSave({ theme: e.target.value }), className: "select-field", children: [_jsx("option", { value: "system", children: "System" }), _jsx("option", { value: "dark", children: "Dark" }), _jsx("option", { value: "light", children: "Light" })] }) }) }), _jsxs(Section, { title: "Defaults", children: [_jsx(Field, { label: "Default Provider", children: _jsxs("select", { value: settings.defaultProviderId ?? '', onChange: (e) => onSave({ defaultProviderId: e.target.value || undefined }), className: "select-field", children: [_jsx("option", { value: "", children: "None" }), settings.providers.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id)))] }) }), _jsx(Field, { label: "Default Model", children: _jsx("input", { type: "text", value: settings.defaultModel ?? '', onChange: (e) => onSave({ defaultModel: e.target.value || undefined }), placeholder: "e.g. gpt-4o", className: "input-field" }) })] }), _jsxs(Section, { title: "Safety", children: [_jsx(Field, { label: "Require Tool Approval", children: _jsx(Toggle, { value: settings.requireToolApproval, onChange: (v) => onSave({ requireToolApproval: v }) }) }), _jsx("p", { className: "text-xs text-slate-500", children: "When enabled, each MCP tool call must be approved before execution." })] }), _jsxs(Section, { title: "Default Parameters", children: [_jsx(Field, { label: "Temperature", children: _jsx("input", { type: "number", min: 0, max: 2, step: 0.1, value: settings.defaultParameters.temperature ?? 0.7, onChange: (e) => onSave({
                                defaultParameters: {
                                    ...settings.defaultParameters,
                                    temperature: parseFloat(e.target.value),
                                },
                            }), className: "input-field w-24" }) }), _jsx(Field, { label: "Max Tokens", children: _jsx("input", { type: "number", min: 1, max: 200000, value: settings.defaultParameters.maxTokens ?? 4096, onChange: (e) => onSave({
                                defaultParameters: {
                                    ...settings.defaultParameters,
                                    maxTokens: parseInt(e.target.value),
                                },
                            }), className: "input-field w-28" }) })] }), _jsxs(Section, { title: "Configuration", children: [_jsx("p", { className: "text-xs text-slate-500 -mt-1 mb-3", children: "Export your settings for backup or sharing. The clean export omits API keys \u2014 safe to share. The full export includes API keys \u2014 keep it private." }), _jsxs("div", { className: "flex gap-2 flex-wrap", children: [_jsx("button", { onClick: () => service.config.exportSettings(true), className: "btn-secondary text-xs px-3 py-1.5", children: "Export (clean)" }), _jsx("button", { onClick: () => service.config.exportSettings(false), className: "btn-secondary text-xs px-3 py-1.5", children: "Export (with API keys)" }), _jsx("button", { onClick: async () => {
                                    const imported = await service.config.importSettings();
                                    if (imported)
                                        onSave(imported);
                                }, className: "btn-secondary text-xs px-3 py-1.5", children: "Import Config" })] })] })] }));
}
// ─── Providers Tab ────────────────────────────────────────────────────────────
function ProvidersTab({ settings, onSave, }) {
    const [editing, setEditing] = useState(null);
    const [isNew, setIsNew] = useState(false);
    const [view, setView] = useState('list');
    const handleSaveProvider = (provider) => {
        const providers = isNew
            ? [...settings.providers, provider]
            : settings.providers.map((p) => (p.id === provider.id ? provider : p));
        onSave({ providers });
        setEditing(null);
    };
    const handleDelete = (id) => {
        if (!confirm('Delete this provider?'))
            return;
        onSave({ providers: settings.providers.filter((p) => p.id !== id) });
    };
    if (editing) {
        return (_jsx(ProviderForm, { provider: editing, onSave: handleSaveProvider, onCancel: () => setEditing(null) }));
    }
    if (view === 'marketplace') {
        // Track which registry IDs the user has already added (by matching name)
        const addedNames = new Set(settings.providers.map((p) => p.name));
        return (_jsx(ProviderMarketplace, { installedTypes: addedNames, onInstall: (partial) => {
                setView('list');
                setIsNew(true);
                setEditing({ id: uuidv4(), ...partial });
            }, onBack: () => setView('list') }));
    }
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("p", { className: "text-sm text-slate-400", children: [settings.providers.length, " provider", settings.providers.length !== 1 ? 's' : '', " configured"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setView('marketplace'), className: "btn-secondary text-xs px-3 py-1.5", children: "Browse Marketplace" }), _jsx("button", { onClick: () => {
                                    setIsNew(true);
                                    setEditing({ id: uuidv4(), name: '', type: 'openai' });
                                }, className: "btn-primary text-xs px-3 py-1.5", children: "+ Add Provider" })] })] }), settings.providers.map((p) => (_jsxs("div", { className: "bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-3", children: [_jsx(ProviderBadge, { type: p.type }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-slate-200", children: p.name }), _jsxs("p", { className: "text-xs text-slate-500", children: [p.type, p.baseUrl ? ` · ${p.baseUrl}` : '', p.defaultModel ? ` · ${p.defaultModel}` : ''] })] }), _jsx("button", { onClick: () => {
                            setIsNew(false);
                            setEditing({ ...p });
                        }, className: "text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700 transition-colors", children: "Edit" }), _jsx("button", { onClick: () => handleDelete(p.id), className: "text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-slate-700 transition-colors", children: "Delete" })] }, p.id))), settings.providers.length === 0 && (_jsx(EmptyState, { icon: "\uD83D\uDD11", title: "No providers", subtitle: "Add an OpenAI, Anthropic, LM Studio, or Ollama provider to get started" }))] }));
}
function ProviderForm({ provider, onSave, onCancel, }) {
    const [draft, setDraft] = useState({ ...provider });
    const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: onCancel, className: "text-slate-400 hover:text-slate-200 transition-colors", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) }), _jsx("h3", { className: "text-sm font-semibold text-slate-200", children: provider.name ? `Edit ${provider.name}` : 'New Provider' })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wider text-slate-500", children: "Connection" }), _jsx(Field, { label: "Display Name", children: _jsx("input", { autoFocus: true, type: "text", value: draft.name, onChange: (e) => set('name', e.target.value), placeholder: "My OpenAI", className: "input-field" }) }), _jsx(Field, { label: "Type", children: _jsxs("select", { value: draft.type, onChange: (e) => set('type', e.target.value), className: "select-field", children: [_jsx("option", { value: "openai", children: "OpenAI" }), _jsx("option", { value: "anthropic", children: "Anthropic" }), _jsx("option", { value: "lmstudio", children: "LM Studio" }), _jsx("option", { value: "ollama", children: "Ollama" }), _jsx("option", { value: "gemini", children: "Google Gemini" })] }) }), draft.type !== 'lmstudio' && draft.type !== 'ollama' && (_jsx(Field, { label: "API Key", children: _jsx("input", { type: "password", value: draft.apiKey ?? '', onChange: (e) => set('apiKey', e.target.value), placeholder: draft.type === 'gemini' ? 'AIza...' : 'sk-...', className: "input-field", autoComplete: "off" }) })), _jsxs(Field, { label: "Base URL", children: [_jsx("input", { type: "url", value: draft.baseUrl ?? '', onChange: (e) => set('baseUrl', e.target.value), placeholder: draft.type === 'lmstudio'
                                    ? 'http://localhost:1234/v1'
                                    : draft.type === 'ollama'
                                        ? 'http://localhost:11434/v1'
                                        : draft.type === 'anthropic'
                                            ? 'https://…services.ai.azure.com/anthropic'
                                            : draft.type === 'gemini'
                                                ? 'https://generativelanguage.googleapis.com (optional)'
                                                : 'https://api.openai.com/v1', className: "input-field" }), draft.type === 'anthropic' && draft.baseUrl?.includes('azure.com') && (_jsxs("p", { className: "text-xs text-amber-400 mt-1", children: ["Azure detected \u2014 do ", _jsx("strong", { children: "not" }), " include ", _jsx("code", { children: "/v1/messages" }), " in the URL."] }))] }), draft.type === 'anthropic' && (_jsx(Field, { label: "API Version", children: _jsx("input", { type: "text", value: draft.apiVersion ?? '', onChange: (e) => set('apiVersion', e.target.value), placeholder: "e.g. 2025-04-15  (required for Azure AI Foundry)", className: "input-field font-mono text-xs" }) }))] }), _jsx("div", { className: "border-t border-slate-700/60" }), _jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-[11px] font-semibold uppercase tracking-wider text-slate-500", children: "Models" }), _jsx(Field, { label: "Default Model", children: _jsx("input", { type: "text", value: draft.defaultModel ?? '', onChange: (e) => set('defaultModel', e.target.value), placeholder: draft.type === 'anthropic'
                                ? 'claude-sonnet-4-5'
                                : draft.type === 'lmstudio'
                                    ? 'local-model'
                                    : draft.type === 'ollama'
                                        ? 'llama3.2'
                                        : draft.type === 'gemini'
                                            ? 'gemini-2.0-flash'
                                            : 'gpt-4o', className: "input-field" }) }), _jsx(ModelsField, { models: draft.customModels ?? [], contextWindows: draft.modelContextWindows ?? {}, onChange: (customModels, modelContextWindows) => setDraft((d) => ({ ...d, customModels, modelContextWindows })) })] }), _jsxs("div", { className: "flex gap-2 pt-1 border-t border-slate-700/60", children: [_jsx("button", { onClick: () => onSave(draft), disabled: !draft.name.trim(), className: "btn-primary text-sm px-4 py-2 disabled:opacity-50", children: "Save Provider" }), _jsx("button", { onClick: onCancel, className: "btn-secondary text-sm px-4 py-2", children: "Cancel" })] })] }));
}
// ─── MCP Tab ──────────────────────────────────────────────────────────────────
function McpTab({ settings, onSave, mcpStatus, onRefreshStatus, }) {
    const [editing, setEditing] = useState(null);
    const [isNew, setIsNew] = useState(false);
    const [view, setView] = useState('list');
    const [connecting, setConnecting] = useState(null);
    const [toolsMap, setToolsMap] = useState({});
    const [loadingTools, setLoadingTools] = useState(null);
    const [expandedTools, setExpandedTools] = useState(new Set());
    const handleToggleTools = async (serverId) => {
        const next = new Set(expandedTools);
        if (next.has(serverId)) {
            next.delete(serverId);
            setExpandedTools(next);
            return;
        }
        next.add(serverId);
        setExpandedTools(next);
        if (!toolsMap[serverId]) {
            setLoadingTools(serverId);
            try {
                const tools = await service.mcp.listTools([serverId]);
                setToolsMap((m) => ({ ...m, [serverId]: tools }));
            }
            catch {
                setToolsMap((m) => ({ ...m, [serverId]: [] }));
            }
            finally {
                setLoadingTools(null);
            }
        }
    };
    const handleSaveServer = (server) => {
        const mcpServers = isNew
            ? [...settings.mcpServers, server]
            : settings.mcpServers.map((s) => (s.id === server.id ? server : s));
        onSave({ mcpServers });
        setEditing(null);
    };
    const handleDelete = (id) => {
        if (!confirm('Delete this MCP server?'))
            return;
        service.mcp.disconnect(id).catch(() => { });
        onSave({ mcpServers: settings.mcpServers.filter((s) => s.id !== id) });
    };
    const handleToggleConnect = async (server) => {
        setConnecting(server.id);
        try {
            if (mcpStatus[server.id]) {
                await service.mcp.disconnect(server.id);
            }
            else {
                await service.mcp.connect(server);
            }
            await onRefreshStatus();
        }
        catch (err) {
            alert(`Failed: ${err}`);
        }
        finally {
            setConnecting(null);
        }
    };
    const handleToggleEnabled = (id, enabled) => {
        onSave({
            mcpServers: settings.mcpServers.map((s) => (s.id === id ? { ...s, enabled } : s)),
        });
    };
    if (editing) {
        return (_jsx(McpServerForm, { server: editing, onSave: handleSaveServer, onCancel: () => setEditing(null) }));
    }
    if (view === 'marketplace') {
        const installedIds = new Set(settings.mcpServers.map((s) => s.name));
        return (_jsx(McpMarketplace, { installedIds: installedIds, onInstall: (partial) => {
                setView('list');
                setIsNew(true);
                setEditing({ id: uuidv4(), ...partial });
            }, onBack: () => setView('list') }));
    }
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("p", { className: "text-sm text-slate-400", children: [settings.mcpServers.length, " server", settings.mcpServers.length !== 1 ? 's' : '', " configured"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: onRefreshStatus, className: "text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700 transition-colors", children: "Refresh" }), _jsx("button", { onClick: () => setView('marketplace'), className: "btn-secondary text-xs px-3 py-1.5", children: "Browse Marketplace" }), _jsx("button", { onClick: () => {
                                    setIsNew(true);
                                    setEditing({
                                        id: uuidv4(),
                                        name: '',
                                        transport: 'http-sse',
                                        enabled: true,
                                    });
                                }, className: "btn-primary text-xs px-3 py-1.5", children: "+ Add Server" })] })] }), settings.mcpServers.map((s) => (_jsxs("div", { className: "bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: `w-2 h-2 rounded-full flex-shrink-0 ${mcpStatus[s.id] ? 'bg-green-400' : 'bg-slate-600'}` }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-slate-200", children: s.name }), _jsx("p", { className: "text-xs text-slate-500", children: s.transport === 'http-sse' ? s.url : `${s.command} ${(s.args ?? []).join(' ')}` })] }), _jsx(Toggle, { value: s.enabled, onChange: (v) => handleToggleEnabled(s.id, v), size: "sm" }), _jsx("button", { onClick: () => handleToggleConnect(s), disabled: connecting === s.id, className: `text-xs px-2.5 py-1 rounded-lg transition-colors ${mcpStatus[s.id]
                                    ? 'bg-red-700/50 text-red-300 hover:bg-red-700'
                                    : 'bg-green-700/50 text-green-300 hover:bg-green-700'} disabled:opacity-50`, children: connecting === s.id ? '…' : mcpStatus[s.id] ? 'Disconnect' : 'Connect' }), _jsx("button", { onClick: () => {
                                    setIsNew(false);
                                    setEditing({ ...s });
                                }, className: "text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700 transition-colors", children: "Edit" }), _jsx("button", { onClick: () => handleDelete(s.id), className: "text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-slate-700 transition-colors", children: "Delete" })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("span", { className: "text-[10px] text-slate-600 font-mono flex-1", children: [s.transport, " \u00B7 id: ", s.id.slice(0, 8)] }), mcpStatus[s.id] && (_jsx("button", { onClick: () => handleToggleTools(s.id), className: "text-[10px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded hover:bg-slate-700 transition-colors flex items-center gap-1", children: loadingTools === s.id ? (_jsx("span", { children: "loading\u2026" })) : (_jsxs(_Fragment, { children: [_jsx("span", { children: expandedTools.has(s.id) ? '▾' : '▸' }), _jsx("span", { children: toolsMap[s.id] != null
                                                ? `${toolsMap[s.id].length} tool${toolsMap[s.id].length !== 1 ? 's' : ''}`
                                                : 'Tools' })] })) }))] }), expandedTools.has(s.id) && toolsMap[s.id] && (_jsx("div", { className: "border-t border-slate-700 pt-2 space-y-1", children: toolsMap[s.id].length === 0 ? (_jsx("p", { className: "text-xs text-slate-500 italic", children: "No tools exposed by this server." })) : (toolsMap[s.id].map((t) => (_jsxs("div", { className: "flex gap-2 items-start", children: [_jsx("code", { className: "text-[10px] bg-slate-700 text-cyan-300 px-1.5 py-0.5 rounded font-mono flex-shrink-0 leading-4", children: t.name }), t.description && (_jsx("span", { className: "text-[10px] text-slate-400 leading-4", children: t.description }))] }, t.name)))) }))] }, s.id))), settings.mcpServers.length === 0 && (_jsx(EmptyState, { icon: "\uD83D\uDD0C", title: "No MCP servers", subtitle: "Add HTTP-SSE or stdio MCP servers to give the AI access to tools" }))] }));
}
function McpServerForm({ server, onSave, onCancel, }) {
    const [draft, setDraft] = useState({ ...server });
    // HTTP headers as editable rows
    const [headerRows, setHeaderRows] = useState(Object.entries(draft.headers ?? {}));
    const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
    const addHeaderRow = () => setHeaderRows((r) => [...r, ['', '']]);
    const setHeaderRow = (i, k, v) => setHeaderRows((r) => {
        const next = [...r];
        next[i] = [k, v];
        return next;
    });
    const removeHeaderRow = (i) => setHeaderRows((r) => r.filter((_, idx) => idx !== i));
    const handleSave = () => {
        const headers = Object.fromEntries(headerRows.filter(([k]) => k.trim()));
        onSave({ ...draft, headers: Object.keys(headers).length ? headers : undefined });
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: onCancel, className: "text-slate-400 hover:text-slate-200 transition-colors", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) }), _jsx("h3", { className: "text-sm font-semibold text-slate-200", children: server.name ? `Edit ${server.name}` : 'New MCP Server' })] }), _jsx(Field, { label: "Type", children: _jsxs("select", { value: draft.transport, onChange: (e) => set('transport', e.target.value), className: "select-field", children: [_jsx("option", { value: "http-streamable", children: "HTTP Server \u2014 Streamable HTTP (modern)" }), _jsx("option", { value: "http-sse", children: "HTTP Server \u2014 SSE (legacy)" }), _jsx("option", { value: "stdio", children: "stdio process" })] }) }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-400 mb-1", children: "Name" }), _jsx("p", { className: "text-xs text-slate-600 mb-1", children: "Help you identify the tool" }), _jsx("input", { autoFocus: true, type: "text", value: draft.name, onChange: (e) => set('name', e.target.value), placeholder: "My MCP Server", className: "input-field" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-400 mb-1", children: "ID" }), _jsx("p", { className: "text-xs text-slate-600 mb-1", children: "A unique identifier used by the model" }), _jsx("input", { type: "text", value: draft.id, onChange: (e) => set('id', e.target.value), className: "input-field font-mono text-xs" })] })] }), (draft.transport === 'http-sse' || draft.transport === 'http-streamable') ? (_jsxs(_Fragment, { children: [_jsx(Field, { label: "URL", children: _jsx("input", { type: "url", value: draft.url ?? '', onChange: (e) => set('url', e.target.value), placeholder: "https://...", className: "input-field" }) }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer select-none", children: [_jsx("input", { type: "checkbox", checked: draft.autoApprove ?? false, onChange: (e) => set('autoApprove', e.target.checked), className: "w-4 h-4 rounded accent-blue-500" }), _jsx("span", { className: "text-sm text-slate-300", children: "Run tools automatically" })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("label", { className: "text-xs font-medium text-slate-400", children: "HTTP headers" }), _jsx("button", { type: "button", onClick: addHeaderRow, className: "text-xs text-blue-400 hover:text-blue-300 transition-colors", children: "+ Add header" })] }), _jsxs("div", { className: "space-y-2", children: [headerRows.map(([k, v], i) => (_jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "text", value: k, onChange: (e) => setHeaderRow(i, e.target.value, v), placeholder: "Header name", className: "input-field flex-1 text-xs font-mono" }), _jsx("input", { type: "text", value: v, onChange: (e) => setHeaderRow(i, k, e.target.value), placeholder: "Value", className: "input-field flex-1 text-xs font-mono" }), _jsx("button", { type: "button", onClick: () => removeHeaderRow(i), className: "text-slate-500 hover:text-red-400 transition-colors text-sm leading-none px-1", children: "\u2715" })] }, i))), headerRows.length === 0 && (_jsx("p", { className: "text-xs text-slate-600 italic", children: "No headers added" }))] })] })] })) : (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Command", children: _jsx("input", { type: "text", value: draft.command ?? '', onChange: (e) => set('command', e.target.value), placeholder: "node /path/to/server.js", className: "input-field font-mono text-xs" }) }), _jsx(Field, { label: "Args (space-separated)", children: _jsx("input", { type: "text", value: (draft.args ?? []).join(' '), onChange: (e) => set('args', e.target.value.split(' ').filter(Boolean)), placeholder: "--port 3000", className: "input-field font-mono text-xs" }) }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer select-none", children: [_jsx("input", { type: "checkbox", checked: draft.autoApprove ?? false, onChange: (e) => set('autoApprove', e.target.checked), className: "w-4 h-4 rounded accent-blue-500" }), _jsx("span", { className: "text-sm text-slate-300", children: "Run tools automatically" })] }), _jsx(Field, { label: "Environment variables", children: _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-xs text-slate-500", children: "Key / value pairs" }), _jsx("button", { type: "button", onClick: () => {
                                                const env = { ...(draft.env ?? {}), '': '' };
                                                set('env', env);
                                            }, className: "text-xs text-blue-400 hover:text-blue-300", children: "+ Add" })] }), Object.entries(draft.env ?? {}).map(([k, v], i) => (_jsxs("div", { className: "flex gap-2 items-center mb-2", children: [_jsx("input", { type: "text", defaultValue: k, onBlur: (e) => {
                                                const env = Object.fromEntries(Object.entries(draft.env ?? {}).map(([ek, ev], idx) => idx === i ? [e.target.value, ev] : [ek, ev]));
                                                set('env', env);
                                            }, placeholder: "KEY", className: "input-field flex-1 text-xs font-mono" }), _jsx("input", { type: "text", value: v, onChange: (e) => set('env', { ...draft.env, [k]: e.target.value }), placeholder: "value", className: "input-field flex-1 text-xs font-mono" }), _jsx("button", { type: "button", onClick: () => {
                                                const env = Object.fromEntries(Object.entries(draft.env ?? {}).filter((_, idx) => idx !== i));
                                                set('env', env);
                                            }, className: "text-slate-500 hover:text-red-400 transition-colors text-sm px-1", children: "\u2715" })] }, i))), Object.keys(draft.env ?? {}).length === 0 && (_jsx("p", { className: "text-xs text-slate-600 italic", children: "No variables added" }))] }) })] })), _jsx(Field, { label: "Enabled by default", children: _jsx(Toggle, { value: draft.enabled, onChange: (v) => set('enabled', v) }) }), _jsxs("div", { className: "flex gap-2 pt-2", children: [_jsx("button", { onClick: handleSave, disabled: !draft.name.trim(), className: "btn-primary text-sm px-4 py-2 disabled:opacity-50", children: "Save Server" }), _jsx("button", { onClick: onCancel, className: "btn-secondary text-sm px-4 py-2", children: "Cancel" })] })] }));
}
// ─── Unified Models Field ─────────────────────────────────────────────────────
// One entry per model: name + optional context window size.
function ModelsField({ models, contextWindows, onChange, }) {
    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState('');
    const [formCtx, setFormCtx] = useState('');
    const nameRef = React.useRef(null);
    // Build unified list: start from customModels, merge in any contextWindow keys
    const allNames = Array.from(new Set([...models, ...Object.keys(contextWindows)]));
    const openForm = () => {
        setFormName('');
        setFormCtx('');
        setShowForm(true);
        setTimeout(() => nameRef.current?.focus(), 50);
    };
    const commit = () => {
        const name = formName.trim();
        if (!name)
            return;
        const newModels = models.includes(name) ? models : [...models, name];
        const newCtx = { ...contextWindows };
        const tok = parseInt(formCtx);
        if (!isNaN(tok) && tok > 0)
            newCtx[name] = tok;
        onChange(newModels, newCtx);
        setShowForm(false);
    };
    const remove = (name) => {
        const newModels = models.filter((m) => m !== name);
        const newCtx = { ...contextWindows };
        delete newCtx[name];
        onChange(newModels, newCtx);
    };
    const updateCtx = (name, raw) => {
        const newCtx = { ...contextWindows };
        const tok = parseInt(raw);
        if (!raw || isNaN(tok) || tok < 1) {
            delete newCtx[name];
        }
        else {
            newCtx[name] = tok;
        }
        onChange(models, newCtx);
    };
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("label", { className: "text-xs font-medium text-slate-400", children: "Models" }), _jsx("button", { type: "button", onClick: openForm, className: "text-xs text-blue-400 hover:text-blue-300 transition-colors", children: "+ Add model" })] }), showForm && (_jsxs("div", { className: "mb-3 p-3 rounded-lg border border-slate-600 bg-slate-800/80 space-y-2", children: [_jsxs("div", { children: [_jsx("p", { className: "text-[11px] text-slate-400 mb-1", children: "Model name" }), _jsx("input", { ref: nameRef, type: "text", value: formName, onChange: (e) => setFormName(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') {
                                    e.preventDefault();
                                    commit();
                                } if (e.key === 'Escape')
                                    setShowForm(false); }, placeholder: "e.g. gpt-5.1", className: "input-field w-full text-sm font-mono" })] }), _jsxs("div", { children: [_jsxs("p", { className: "text-[11px] text-slate-400 mb-1", children: ["Context window ", _jsx("span", { className: "text-slate-600", children: "(tokens \u2014 optional)" })] }), _jsx("input", { type: "number", min: 1024, step: 1024, value: formCtx, onChange: (e) => setFormCtx(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter') {
                                    e.preventDefault();
                                    commit();
                                } if (e.key === 'Escape')
                                    setShowForm(false); }, placeholder: "e.g. 128000", className: "input-field w-full text-sm" })] }), _jsxs("div", { className: "flex gap-2 pt-1", children: [_jsx("button", { type: "button", onClick: commit, disabled: !formName.trim(), className: "btn-primary text-xs px-3 py-1.5 disabled:opacity-40", children: "Add" }), _jsx("button", { type: "button", onClick: () => setShowForm(false), className: "btn-secondary text-xs px-3 py-1.5", children: "Cancel" })] })] })), allNames.length > 0 ? (_jsx("div", { className: "space-y-1.5", children: allNames.map((name) => (_jsxs("div", { className: "flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 border border-slate-700", children: [_jsx("span", { className: "flex-1 text-sm text-slate-200 font-mono truncate", children: name }), _jsx("input", { type: "number", min: 1024, step: 1024, value: contextWindows[name] ?? '', onChange: (e) => updateCtx(name, e.target.value), placeholder: "ctx tokens", className: "w-28 bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-xs text-slate-400 text-right placeholder:text-slate-600" }), _jsx("button", { type: "button", onClick: () => remove(name), className: "text-slate-500 hover:text-red-400 transition-colors text-xs leading-none pl-1", children: "\u2715" })] }, name))) })) : (!showForm && _jsx("p", { className: "text-xs text-slate-600 italic", children: "No models added \u2014 leave empty to use the API's model list" }))] }));
}
// ─── Shared sub-components ────────────────────────────────────────────────────
// ─── Features Tab ─────────────────────────────────────────────────────────────
function FeaturesTab({ settings, onSave, }) {
    const routing = settings.routing;
    const [showRoutingConfig, setShowRoutingConfig] = React.useState(false);
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-start gap-3 rounded-xl bg-blue-950/30 border border-blue-800/40 px-4 py-3", children: [_jsx("span", { className: "text-lg mt-0.5", children: "\u2728" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-blue-300", children: "Shipped Features" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Stable features you can enable or disable." })] })] }), _jsxs(Section, { title: "AI Capabilities", children: [_jsx(FeatureRow, { title: "Intelligent Model Routing", description: "Automatically routes each prompt to the best model based on complexity or task type.", value: routing?.enabled ?? false, onChange: (v) => onSave({
                            routing: {
                                enabled: v,
                                routerProviderId: routing?.routerProviderId,
                                routerModel: routing?.routerModel,
                                tierRouting: routing?.tierRouting ?? { enabled: false, tiers: [] },
                                providerRouting: routing?.providerRouting ?? { enabled: false, rules: [] },
                            },
                        }), onConfigure: () => setShowRoutingConfig((o) => !o), configOpen: showRoutingConfig }), showRoutingConfig && (_jsx("div", { className: "rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 -mt-1", children: _jsx(RoutingConfig, { settings: settings, onSave: onSave }) }))] })] }));
}
function FeatureRow({ title, description, value, onChange, onConfigure, configOpen, }) {
    return (_jsx("div", { className: `rounded-xl bg-slate-800/40 border px-4 py-3 ${configOpen ? 'border-blue-700/60 rounded-b-none' : 'border-slate-700/50'}`, children: _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-slate-200", children: title }), _jsx("p", { className: "text-xs text-slate-500 mt-0.5 leading-relaxed", children: description })] }), _jsxs("div", { className: "flex items-center gap-2 flex-shrink-0 mt-0.5", children: [onConfigure && (_jsx("button", { onClick: onConfigure, className: "text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-0.5 rounded border border-blue-700/50 hover:border-blue-500/70", children: configOpen ? 'Close' : 'Configure' })), _jsx(Toggle, { value: value, onChange: onChange })] })] }) }));
}
// ─── Routing Config (inline panel) ────────────────────────────────────────────
const TASK_TYPES = ['writing', 'code', 'tools', 'reasoning', 'general'];
const DEFAULT_ROUTING = {
    enabled: false,
    routerProviderId: undefined,
    routerModel: undefined,
    tierRouting: { enabled: false, tiers: [] },
    providerRouting: { enabled: false, rules: [] },
};
function RoutingConfig({ settings, onSave, }) {
    const routing = settings.routing ?? DEFAULT_ROUTING;
    const { models, loadModels } = useSettingsStore();
    const saveRouting = (partial) => {
        onSave({ routing: { ...routing, ...partial } });
    };
    const routerProvider = settings.providers.find((p) => p.id === routing.routerProviderId);
    const handleRouterProviderChange = (id) => {
        saveRouting({ routerProviderId: id, routerModel: undefined });
        if (id)
            loadModels(id);
    };
    React.useEffect(() => {
        if (routing.routerProviderId)
            loadModels(routing.routerProviderId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routing.routerProviderId]);
    const routerModels = routing.routerProviderId ? (models[routing.routerProviderId] ?? []) : [];
    // ── Tier helpers ──────────────────────────────────────────────────────────
    const addTier = () => {
        const used = routing.tierRouting.tiers.map((t) => t.minComplexity);
        const next = [1, 2, 3].find((n) => !used.includes(n));
        if (!next)
            return;
        saveRouting({
            tierRouting: {
                ...routing.tierRouting,
                tiers: [...routing.tierRouting.tiers, { minComplexity: next, providerId: '', model: '', label: '' }],
            },
        });
    };
    const updateTier = (idx, patch) => {
        const tiers = routing.tierRouting.tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t));
        if (patch.providerId)
            loadModels(patch.providerId);
        saveRouting({ tierRouting: { ...routing.tierRouting, tiers } });
    };
    const removeTier = (idx) => {
        saveRouting({ tierRouting: { ...routing.tierRouting, tiers: routing.tierRouting.tiers.filter((_, i) => i !== idx) } });
    };
    // ── Provider rule helpers ─────────────────────────────────────────────────
    const addProviderRule = () => {
        const used = routing.providerRouting.rules.map((r) => r.taskType);
        const nextType = TASK_TYPES.find((t) => !used.includes(t)) ?? 'general';
        saveRouting({
            providerRouting: {
                ...routing.providerRouting,
                rules: [...routing.providerRouting.rules, { taskType: nextType, providerId: '', model: '' }],
            },
        });
    };
    const updateRule = (idx, patch) => {
        const rules = routing.providerRouting.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
        if (patch.providerId)
            loadModels(patch.providerId);
        saveRouting({ providerRouting: { ...routing.providerRouting, rules } });
    };
    const removeRule = (idx) => {
        saveRouting({ providerRouting: { ...routing.providerRouting, rules: routing.providerRouting.rules.filter((_, i) => i !== idx) } });
    };
    // ── Profile helpers ───────────────────────────────────────────────────────
    const profiles = settings.routingProfiles ?? [];
    const [newProfileName, setNewProfileName] = React.useState('');
    const [addingProfile, setAddingProfile] = React.useState(false);
    const confirmSaveProfile = () => {
        const name = newProfileName.trim();
        if (!name)
            return;
        const newProfile = {
            id: crypto.randomUUID(),
            name,
            config: { ...routing, enabled: true }, // profiles are always active by definition
        };
        onSave({ routingProfiles: [...profiles, newProfile] });
        setNewProfileName('');
        setAddingProfile(false);
    };
    const deleteProfile = (id) => {
        onSave({ routingProfiles: profiles.filter((p) => p.id !== id) });
    };
    const loadProfile = (profile) => {
        onSave({ routing: { ...profile.config } });
    };
    const sel = 'bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500';
    const selFull = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500';
    const btnSm = 'text-xs px-2.5 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors';
    const removeBtn = 'text-slate-500 hover:text-red-400 transition-colors flex-shrink-0';
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs(Section, { title: "Saved Profiles", children: [_jsx("p", { className: "text-xs text-slate-500 -mt-1 mb-3", children: "Save the current config as a named profile. Profiles can be selected per-conversation from the model picker in the top bar." }), profiles.length > 0 && (_jsx("div", { className: "space-y-1 mb-3", children: profiles.map((profile) => (_jsxs("div", { className: "flex items-center gap-2 bg-slate-800/50 rounded-xl px-3 py-2", children: [_jsx("span", { className: "text-blue-400 text-sm", children: "\uD83D\uDD00" }), _jsx("span", { className: "text-sm text-slate-200 flex-1 truncate", children: profile.name }), _jsx("button", { onClick: () => loadProfile(profile), className: `${btnSm} text-[11px]`, title: "Load this profile into the config editor below", children: "Load" }), _jsx("button", { onClick: () => deleteProfile(profile.id), className: removeBtn, title: "Delete profile", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }, profile.id))) })), addingProfile ? (_jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("input", { autoFocus: true, value: newProfileName, onChange: (e) => setNewProfileName(e.target.value), onKeyDown: (e) => {
                                    if (e.key === 'Enter')
                                        confirmSaveProfile();
                                    if (e.key === 'Escape') {
                                        setAddingProfile(false);
                                        setNewProfileName('');
                                    }
                                }, placeholder: "Profile name\u2026", className: "flex-1 bg-slate-700 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-500" }), _jsx("button", { onClick: confirmSaveProfile, disabled: !newProfileName.trim(), className: `${btnSm} border-blue-600 text-blue-300 hover:bg-blue-900/30 disabled:opacity-40`, children: "Save" }), _jsx("button", { onClick: () => { setAddingProfile(false); setNewProfileName(''); }, className: btnSm, children: "Cancel" })] })) : (_jsx("button", { onClick: () => setAddingProfile(true), className: btnSm, children: "+ Save current config as profile\u2026" }))] }), _jsxs(Section, { title: "Classifier Model", children: [_jsxs("p", { className: "text-xs text-slate-500 -mt-1 mb-3", children: ["A fast, cheap model that classifies each prompt before routing. Adds ~100 ms. Recommended: ", _jsx("span", { className: "text-slate-400", children: "claude-haiku-3-5" }), " or ", _jsx("span", { className: "text-slate-400", children: "gpt-4o-mini" }), "."] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500 mb-1 block", children: "Provider" }), _jsxs("select", { className: selFull, value: routing.routerProviderId ?? '', onChange: (e) => handleRouterProviderChange(e.target.value), children: [_jsx("option", { value: "", children: "Select provider\u2026" }), settings.providers.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs text-slate-500 mb-1 block", children: "Model" }), _jsxs("select", { className: selFull, value: routing.routerModel ?? '', onChange: (e) => saveRouting({ routerModel: e.target.value }), disabled: !routing.routerProviderId, children: [_jsx("option", { value: "", children: "Select model\u2026" }), routerProvider?.customModels?.map((m) => _jsx("option", { value: m, children: m }, m)), routerModels.filter((m) => !routerProvider?.customModels?.includes(m)).map((m) => (_jsx("option", { value: m, children: m }, m)))] })] })] })] }), _jsxs(Section, { title: "Complexity Tiers", children: [_jsxs("div", { className: "flex items-start justify-between gap-4 mb-3", children: [_jsx("p", { className: "text-xs text-slate-500 leading-relaxed", children: "The classifier scores each prompt 1 (simple) \u2192 3 (complex). Map each score threshold to a provider and model. The highest matching tier wins." }), _jsx(Toggle, { size: "sm", value: routing.tierRouting.enabled, onChange: (v) => saveRouting({ tierRouting: { ...routing.tierRouting, enabled: v } }) })] }), routing.tierRouting.enabled && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [routing.tierRouting.tiers.length === 0 && (_jsx("p", { className: "text-xs text-slate-600 italic py-1", children: "No tiers configured yet." })), routing.tierRouting.tiers.map((tier, idx) => {
                                        const tierModels = tier.providerId ? (models[tier.providerId] ?? []) : [];
                                        const tierProv = settings.providers.find((p) => p.id === tier.providerId);
                                        return (_jsxs("div", { className: "flex items-center gap-2 bg-slate-800/50 rounded-xl px-3 py-2", children: [_jsxs("select", { className: `${sel} w-28`, value: tier.minComplexity, onChange: (e) => updateTier(idx, { minComplexity: Number(e.target.value) }), children: [_jsx("option", { value: 1, children: "Score \u2265 1" }), _jsx("option", { value: 2, children: "Score \u2265 2" }), _jsx("option", { value: 3, children: "Score \u2265 3" })] }), _jsx("input", { className: `${sel} w-24`, placeholder: "Label\u2026", value: tier.label ?? '', onChange: (e) => updateTier(idx, { label: e.target.value }) }), _jsxs("select", { className: `${sel} flex-1`, value: tier.providerId, onChange: (e) => updateTier(idx, { providerId: e.target.value, model: '' }), children: [_jsx("option", { value: "", children: "Provider\u2026" }), settings.providers.map((p) => _jsx("option", { value: p.id, children: p.name }, p.id))] }), _jsxs("select", { className: `${sel} flex-1`, value: tier.model, onChange: (e) => updateTier(idx, { model: e.target.value }), disabled: !tier.providerId, children: [_jsx("option", { value: "", children: "Model\u2026" }), tierProv?.customModels?.map((m) => _jsx("option", { value: m, children: m }, m)), tierModels.filter((m) => !tierProv?.customModels?.includes(m)).map((m) => (_jsx("option", { value: m, children: m }, m)))] }), _jsx("button", { onClick: () => removeTier(idx), className: removeBtn, title: "Remove", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }, idx));
                                    })] }), routing.tierRouting.tiers.length < 3 && (_jsx("button", { onClick: addTier, className: `${btnSm} mt-2`, children: "+ Add tier" }))] }))] }), _jsxs(Section, { title: "Task-Type Rules", children: [_jsxs("div", { className: "flex items-start justify-between gap-4 mb-3", children: [_jsx("p", { className: "text-xs text-slate-500 leading-relaxed", children: "Route by intent: writing, code, tools, reasoning, or general. Tier routing takes precedence over task-type rules when both are active." }), _jsx(Toggle, { size: "sm", value: routing.providerRouting.enabled, onChange: (v) => saveRouting({ providerRouting: { ...routing.providerRouting, enabled: v } }) })] }), routing.providerRouting.enabled && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [routing.providerRouting.rules.length === 0 && (_jsx("p", { className: "text-xs text-slate-600 italic py-1", children: "No rules configured yet." })), routing.providerRouting.rules.map((rule, idx) => {
                                        const ruleModels = rule.providerId ? (models[rule.providerId] ?? []) : [];
                                        const ruleProv = settings.providers.find((p) => p.id === rule.providerId);
                                        return (_jsxs("div", { className: "flex items-center gap-2 bg-slate-800/50 rounded-xl px-3 py-2", children: [_jsx("select", { className: `${sel} w-28`, value: rule.taskType, onChange: (e) => updateRule(idx, { taskType: e.target.value }), children: TASK_TYPES.map((t) => _jsx("option", { value: t, children: t }, t)) }), _jsxs("select", { className: `${sel} flex-1`, value: rule.providerId, onChange: (e) => updateRule(idx, { providerId: e.target.value, model: '' }), children: [_jsx("option", { value: "", children: "Provider\u2026" }), settings.providers.map((p) => _jsx("option", { value: p.id, children: p.name }, p.id))] }), _jsxs("select", { className: `${sel} flex-1`, value: rule.model, onChange: (e) => updateRule(idx, { model: e.target.value }), disabled: !rule.providerId, children: [_jsx("option", { value: "", children: "Model\u2026" }), ruleProv?.customModels?.map((m) => _jsx("option", { value: m, children: m }, m)), ruleModels.filter((m) => !ruleProv?.customModels?.includes(m)).map((m) => (_jsx("option", { value: m, children: m }, m)))] }), _jsx("button", { onClick: () => removeRule(idx), className: removeBtn, title: "Remove", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }, idx));
                                    })] }), routing.providerRouting.rules.length < TASK_TYPES.length && (_jsx("button", { onClick: addProviderRule, className: `${btnSm} mt-2`, children: "+ Add rule" }))] }))] })] }));
}
// ─── Labs Tab ─────────────────────────────────────────────────────────────────
function LabsTab({ settings, onSave, }) {
    const labs = settings.labs ?? { aiTaskTracking: false, aiClarifyingQuestions: false, debugMode: false };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-start gap-3 rounded-xl bg-purple-950/40 border border-purple-700/40 px-4 py-3", children: [_jsx("span", { className: "text-lg mt-0.5", children: "\u2697\uFE0F" }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-purple-300", children: "Experimental Features" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "These are in active development. Features that graduate will move to the \u2728 Features tab." })] })] }), _jsxs(Section, { title: "AI Capabilities", children: [_jsx(LabsFeatureRow, { title: "AI Task Tracking", description: "The AI maintains a live task list during multi-step work. Tasks appear in a floating panel and update as the AI makes progress.", value: labs.aiTaskTracking, onChange: (v) => onSave({ labs: { ...labs, aiTaskTracking: v } }) }), _jsx(LabsFeatureRow, { title: "AI Clarifying Questions", description: "When faced with an ambiguous or complex request, the AI can ask you targeted questions inline before proceeding. You answer them directly in the chat.", value: labs.aiClarifyingQuestions, onChange: (v) => onSave({ labs: { ...labs, aiClarifyingQuestions: v } }) }), _jsx(LabsFeatureRow, { title: "Debug Mode", description: "Shows a download button on every AI message so you can save the full raw response (content, thinking, tool calls, questions) as JSON for inspection.", value: labs.debugMode ?? false, onChange: (v) => onSave({ labs: { ...labs, debugMode: v } }) })] })] }));
}
function LabsFeatureRow({ title, description, value, onChange, }) {
    return (_jsx("div", { className: "rounded-xl border border-slate-700 overflow-hidden", children: _jsxs("div", { className: "px-4 py-3 flex items-start justify-between gap-4", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("p", { className: "text-sm font-medium text-slate-200", children: title }), _jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded bg-purple-800/60 text-purple-300 font-medium", children: "LABS" })] }), _jsx("p", { className: "text-xs text-slate-400 mt-1 leading-relaxed", children: description })] }), _jsx("div", { className: "shrink-0 pt-0.5", children: _jsx(Toggle, { value: value, onChange: onChange }) })] }) }));
}
// ─── Shared Helpers ────────────────────────────────────────────────────────────
function Section({ title, children }) {
    return (_jsxs("div", { children: [_jsx("h3", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3", children: title }), _jsx("div", { className: "space-y-3", children: children })] }));
}
function Field({ label, children }) {
    return (_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("label", { className: "text-sm text-slate-300 flex-shrink-0", children: label }), _jsx("div", { className: "flex-1 min-w-0 flex justify-end", children: children })] }));
}
function Toggle({ value, onChange, size = 'md', }) {
    const w = size === 'sm' ? 'w-8 h-4' : 'w-10 h-5';
    const dot = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
    const translate = size === 'sm' ? 'translate-x-4' : 'translate-x-5';
    return (_jsx("button", { onClick: () => onChange(!value), className: `relative ${w} rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-slate-600'}`, children: _jsx("span", { className: `absolute top-0.5 left-0.5 ${dot} rounded-full bg-white transition-transform ${value ? translate : 'translate-x-0'}` }) }));
}
function ProviderBadge({ type }) {
    const colors = {
        openai: 'bg-emerald-800 text-emerald-200',
        anthropic: 'bg-orange-800 text-orange-200',
        lmstudio: 'bg-purple-800 text-purple-200',
        ollama: 'bg-teal-800 text-teal-200',
        gemini: 'bg-blue-800 text-blue-200',
    };
    return (_jsx("span", { className: `text-[10px] font-bold px-2 py-0.5 rounded uppercase ${colors[type]}`, children: type === 'lmstudio' ? 'LMS' : type === 'anthropic' ? 'ANT' : type === 'ollama' ? 'OLL' : type === 'gemini' ? 'GEM' : 'OAI' }));
}
function EmptyState({ icon, title, subtitle, }) {
    return (_jsxs("div", { className: "text-center py-10", children: [_jsx("p", { className: "text-3xl mb-2", children: icon }), _jsx("p", { className: "text-sm font-medium text-slate-400", children: title }), _jsx("p", { className: "text-xs text-slate-600 mt-1", children: subtitle })] }));
}
// ─── Analytics Tab ────────────────────────────────────────────────────────────
function AnalyticsTab({ settings, onSave, }) {
    const { records, clearRecords } = useAnalyticsStore();
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    // ── Aggregate stats ──────────────────────────────────────────────────────
    const totalIn = records.reduce((s, r) => s + r.usage.inputTokens, 0);
    const totalOut = records.reduce((s, r) => s + r.usage.outputTokens, 0);
    const totalCost = records.reduce((s, r) => s + (r.costUsd ?? 0), 0);
    const hasCost = records.some((r) => r.costUsd !== null);
    // Per-model breakdown
    const byModel = records.reduce((acc, r) => {
        const key = `${r.providerId} / ${r.model}`;
        const entry = acc[key] ?? { in: 0, out: 0, cost: 0, hasCost: false, count: 0 };
        entry.in += r.usage.inputTokens;
        entry.out += r.usage.outputTokens;
        entry.cost += r.costUsd ?? 0;
        entry.hasCost = entry.hasCost || r.costUsd !== null;
        entry.count += 1;
        acc[key] = entry;
        return acc;
    }, {});
    // ── Pricing config ───────────────────────────────────────────────────────
    const pricing = settings.modelPricing ?? {};
    // Collect unique provider/model combos seen in records + existing pricing keys
    const modelKeys = Array.from(new Set([
        ...Object.keys(byModel),
        ...Object.keys(pricing),
    ])).sort();
    function setPricing(key, field, val) {
        const existing = pricing[key] ?? { inputPer1M: 0, outputPer1M: 0 };
        onSave({ modelPricing: { ...pricing, [key]: { ...existing, [field]: parseFloat(val) || 0 } } });
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(Section, { title: "Usage Summary", children: records.length === 0 ? (_jsx("p", { className: "text-xs text-slate-500", children: "No usage recorded yet. Data appears here after your first chat." })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "grid grid-cols-3 gap-3 mb-4", children: [
                                { label: 'Total input', value: totalIn.toLocaleString() + ' tok' },
                                { label: 'Total output', value: totalOut.toLocaleString() + ' tok' },
                                { label: 'Est. cost', value: hasCost ? `$${totalCost.toFixed(4)}` : '—' },
                            ].map(({ label, value }) => (_jsxs("div", { className: "bg-slate-800/60 rounded-lg px-3 py-2.5 text-center", children: [_jsx("p", { className: "text-[10px] text-slate-500 uppercase tracking-wide", children: label }), _jsx("p", { className: "text-sm font-semibold text-slate-200 mt-0.5", children: value })] }, label))) }), _jsx("div", { className: "rounded-lg border border-slate-700/50 overflow-hidden", children: _jsxs("table", { className: "w-full text-xs", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-slate-800/60 text-slate-500", children: [_jsx("th", { className: "text-left px-3 py-2 font-medium", children: "Provider / Model" }), _jsx("th", { className: "text-right px-3 py-2 font-medium", children: "Turns" }), _jsx("th", { className: "text-right px-3 py-2 font-medium", children: "Input tok" }), _jsx("th", { className: "text-right px-3 py-2 font-medium", children: "Output tok" }), _jsx("th", { className: "text-right px-3 py-2 font-medium", children: "Cost" })] }) }), _jsx("tbody", { children: Object.entries(byModel).map(([key, m], i) => (_jsxs("tr", { className: i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/30', children: [_jsx("td", { className: "px-3 py-2 text-slate-300 font-mono text-[11px]", children: key }), _jsx("td", { className: "px-3 py-2 text-right text-slate-400", children: m.count }), _jsx("td", { className: "px-3 py-2 text-right text-slate-400", children: m.in.toLocaleString() }), _jsx("td", { className: "px-3 py-2 text-right text-slate-400", children: m.out.toLocaleString() }), _jsx("td", { className: "px-3 py-2 text-right text-slate-400", children: m.hasCost ? `$${m.cost.toFixed(4)}` : '—' })] }, key))) })] }) }), _jsx("div", { className: "mt-3 flex justify-end", children: showClearConfirm ? (_jsxs("div", { className: "flex items-center gap-2 text-xs", children: [_jsx("span", { className: "text-slate-400", children: "Clear all records?" }), _jsx("button", { onClick: () => { clearRecords(); setShowClearConfirm(false); }, className: "px-2 py-1 rounded bg-red-700/70 text-red-200 hover:bg-red-600/70", children: "Yes, clear" }), _jsx("button", { onClick: () => setShowClearConfirm(false), className: "px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600", children: "Cancel" })] })) : (_jsx("button", { onClick: () => setShowClearConfirm(true), className: "text-xs text-slate-600 hover:text-slate-400 transition-colors", children: "Clear history" })) })] })) }), _jsxs(Section, { title: "Model Pricing", children: [_jsxs("p", { className: "text-xs text-slate-500 -mt-1 mb-3", children: ["Enter cost per 1M tokens to see estimated charges. Format: ", _jsx("span", { className: "font-mono text-slate-400", children: "providerId/model-name" }), ". Provider IDs come from your Providers settings."] }), modelKeys.length === 0 && (_jsx("p", { className: "text-xs text-slate-600", children: "No models seen yet \u2014 pricing rows appear automatically after first use." })), _jsx("div", { className: "space-y-2", children: modelKeys.map((key) => {
                            const p = pricing[key] ?? { inputPer1M: 0, outputPer1M: 0 };
                            return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs text-slate-400 font-mono flex-1 truncate", title: key, children: key }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-[10px] text-slate-600", children: "in $" }), _jsx("input", { type: "number", min: 0, step: 0.01, value: p.inputPer1M, onChange: (e) => setPricing(key, 'inputPer1M', e.target.value), className: "input-field w-20 text-xs py-1", placeholder: "0.00" }), _jsx("span", { className: "text-[10px] text-slate-600", children: "out $" }), _jsx("input", { type: "number", min: 0, step: 0.01, value: p.outputPer1M, onChange: (e) => setPricing(key, 'outputPer1M', e.target.value), className: "input-field w-20 text-xs py-1", placeholder: "0.00" })] })] }, key));
                        }) }), _jsx(AddModelPricingRow, { existingKeys: modelKeys, onAdd: (key) => onSave({ modelPricing: { ...pricing, [key]: { inputPer1M: 0, outputPer1M: 0 } } }) })] })] }));
}
function AddModelPricingRow({ existingKeys, onAdd }) {
    const [val, setVal] = useState('');
    return (_jsxs("div", { className: "flex items-center gap-2 mt-3 pt-3 border-t border-slate-800", children: [_jsx("input", { type: "text", value: val, onChange: (e) => setVal(e.target.value), placeholder: "providerId/model-name", className: "input-field flex-1 text-xs py-1" }), _jsx("button", { onClick: () => {
                    if (val.trim() && !existingKeys.includes(val.trim())) {
                        onAdd(val.trim());
                        setVal('');
                    }
                }, className: "btn-secondary text-xs px-3 py-1.5", children: "Add" })] }));
}
// ─── About Tab ────────────────────────────────────────────────────────────────
function AboutTab({ settings, onSave, }) {
    const [updateInfo, setUpdateInfo] = useState(null);
    const [checkState, setCheckState] = useState('idle');
    const [checkError, setCheckError] = useState('');
    const channel = settings.updateChannel ?? 'stable';
    const [feedbackType, setFeedbackType] = useState('bug');
    const [feedbackTitle, setFeedbackTitle] = useState('');
    const [feedbackDesc, setFeedbackDesc] = useState('');
    const [submitState, setSubmitState] = useState('idle');
    const [submitError, setSubmitError] = useState('');
    async function checkUpdates() {
        setCheckState('loading');
        setUpdateInfo(null);
        setCheckError('');
        try {
            const info = await service.updater.checkForUpdates();
            setUpdateInfo(info);
            setCheckState('idle');
        }
        catch (e) {
            setCheckError(e instanceof Error ? e.message : String(e));
            setCheckState('error');
        }
    }
    async function submitFeedback() {
        if (!feedbackTitle.trim() || !feedbackDesc.trim())
            return;
        setSubmitState('loading');
        setSubmitError('');
        try {
            await service.updater.submitFeedback({ type: feedbackType, title: feedbackTitle.trim(), description: feedbackDesc.trim() });
            setSubmitState('success');
            setFeedbackTitle('');
            setFeedbackDesc('');
        }
        catch (e) {
            setSubmitError(e instanceof Error ? e.message : String(e));
            setSubmitState('error');
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center gap-4 rounded-xl bg-slate-800/40 border border-slate-700 px-4 py-4", children: [_jsx("div", { className: "w-12 h-12 rounded-xl overflow-hidden shrink-0", children: _jsx("img", { src: "/app-icon.png", alt: "OpenConduit", className: "w-full h-full object-cover" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-slate-100", children: "OpenConduit" }), _jsxs("p", { className: "text-xs text-slate-400 mt-0.5", children: ["v", __APP_VERSION__] }), _jsx("p", { className: "text-xs text-slate-600 mt-0.5", children: "Built with Electron + React + Tailwind" })] })] }), _jsxs(Section, { title: "Updates", children: [_jsxs("div", { className: "mb-3", children: [_jsx("label", { className: "text-xs text-slate-400 block mb-1.5", children: "Update channel" }), _jsxs("select", { value: channel, onChange: (e) => { onSave({ updateChannel: e.target.value }); setUpdateInfo(null); }, className: "w-48 bg-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 border border-slate-600", children: [_jsx("option", { value: "stable", children: "Stable" }), _jsx("option", { value: "beta", children: "Beta" }), _jsx("option", { value: "alpha", children: "Alpha" })] }), _jsxs("p", { className: "mt-1.5 text-[11px] text-slate-600", children: [channel === 'stable' && 'Production releases only.', channel === 'beta' && 'Beta releases only — no alpha builds.', channel === 'alpha' && 'Bleeding edge — alpha and beta pre-releases.'] })] }), _jsx("div", { className: "flex items-center gap-3", children: _jsx("button", { onClick: checkUpdates, disabled: checkState === 'loading', className: `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${checkState === 'loading'
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 text-white'}`, children: checkState === 'loading' ? 'Checking…' : 'Check for Updates' }) }), checkState === 'error' && (_jsx("p", { className: "mt-2 text-xs text-red-400", children: checkError })), updateInfo && (_jsx("div", { className: `mt-3 rounded-lg border px-3 py-2.5 text-xs ${updateInfo.hasUpdate
                            ? 'bg-green-950/40 border-green-700/40 text-green-300'
                            : 'bg-slate-800/40 border-slate-700 text-slate-400'}`, children: updateInfo.hasUpdate ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "font-medium", children: ["\uD83C\uDF89 Update available \u2014 v", updateInfo.latestVersion] }), updateInfo.releaseNotes && (_jsx("p", { className: "mt-1 text-green-400/70", children: updateInfo.releaseNotes })), updateInfo.downloadUrl && (_jsxs("button", { onClick: () => service.updater.openExternal(updateInfo.downloadUrl), className: "inline-block mt-2 underline text-green-400 hover:text-green-200 text-left", children: ["Download v", updateInfo.latestVersion, " \u2192"] }))] })) : (_jsxs("p", { children: ["\u2713 You're on the latest version (v", updateInfo.currentVersion, ")"] })) }))] }), _jsxs(Section, { title: "Send Feedback", children: [_jsx("p", { className: "text-xs text-slate-500 -mt-1 mb-3", children: "Report a bug or request a feature. Opens a pre-filled GitHub issue in your browser." }), submitState === 'success' ? (_jsxs("div", { className: "rounded-lg bg-green-950/40 border border-green-700/40 px-3 py-3 text-sm text-green-300 flex items-center gap-2", children: [_jsx("span", { children: "\u2713" }), _jsx("span", { children: "Opening GitHub\u2026 finish submitting in your browser." }), _jsx("button", { onClick: () => setSubmitState('idle'), className: "ml-auto text-xs text-green-500 hover:text-green-300", children: "Send another" })] })) : (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "flex gap-2", children: ['bug', 'feature'].map((t) => (_jsx("button", { type: "button", onClick: () => setFeedbackType(t), className: `px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${feedbackType === t
                                        ? 'bg-blue-600 border-blue-500 text-white'
                                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500/60'}`, children: t === 'bug' ? '🐛 Bug Report' : '✨ Feature Request' }, t))) }), _jsx("input", { type: "text", value: feedbackTitle, onChange: (e) => setFeedbackTitle(e.target.value), placeholder: "Title \u2014 short summary", className: "w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" }), _jsx("textarea", { rows: 4, value: feedbackDesc, onChange: (e) => setFeedbackDesc(e.target.value), placeholder: feedbackType === 'bug'
                                    ? 'Describe what happened and how to reproduce it…'
                                    : 'Describe the feature and why it would be useful…', className: "w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none" }), submitState === 'error' && (_jsx("p", { className: "text-xs text-red-400", children: submitError })), _jsx("button", { onClick: submitFeedback, disabled: submitState === 'loading' ||
                                    !feedbackTitle.trim() ||
                                    !feedbackDesc.trim(), className: `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${submitState === 'loading' || !feedbackTitle.trim() || !feedbackDesc.trim()
                                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white'}`, children: submitState === 'loading' ? 'Opening…' : 'Open GitHub Issue →' })] }))] })] }));
}
//# sourceMappingURL=SettingsPanel.js.map