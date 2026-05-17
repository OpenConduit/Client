import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { MCP_REGISTRY, MCP_CATEGORIES } from '../data/mcpRegistry';
import { PROVIDER_REGISTRY, PROVIDER_CATEGORIES } from '../data/providerRegistry';
import { v4 as uuidv4 } from 'uuid';
// ─── Brand icon loading ───────────────────────────────────────────────────────
const _iconFiles = import.meta.glob('../assets/marketplace/*.svg', { query: '?url', eager: true, import: 'default' });
/** Entry IDs that map to a differently-named icon file */
const ICON_FILE_MAP = {
    'azure-openai': 'azure',
    'azure-anthropic': 'azure',
};
function getIconUrl(id) {
    const fileId = ICON_FILE_MAP[id] ?? id;
    return _iconFiles[`../assets/marketplace/${fileId}.svg`];
}
function EntryIcon({ id, name, emoji }) {
    const url = getIconUrl(id);
    if (!url)
        return _jsx("span", { className: "text-2xl flex-shrink-0 w-8 text-center leading-8", children: emoji });
    return (_jsx("div", { className: "w-8 h-8 flex-shrink-0 bg-white rounded-lg p-1 flex items-center justify-center", children: _jsx("img", { src: url, alt: name, className: "w-full h-full object-contain" }) }));
}
// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label }) {
    const color = label === 'Free' || label === 'Free tier'
        ? 'bg-green-900/60 text-green-300 border-green-700'
        : label === 'Local'
            ? 'bg-blue-900/60 text-blue-300 border-blue-700'
            : label === 'Enterprise'
                ? 'bg-purple-900/60 text-purple-300 border-purple-700'
                : 'bg-slate-700/60 text-slate-300 border-slate-600';
    return (_jsx("span", { className: `text-[10px] font-medium px-1.5 py-0.5 rounded border ${color}`, children: label }));
}
function FilterBar({ query, onQuery, categories, activeCategory, onCategory }) {
    return (_jsxs("div", { className: "space-y-2", children: [_jsx("input", { type: "search", value: query, onChange: (e) => onQuery(e.target.value), placeholder: "Search\u2026", className: "input-field text-sm" }), _jsx("div", { className: "flex gap-1 flex-wrap", children: categories.map((c) => (_jsx("button", { onClick: () => onCategory(c.id), className: `text-xs px-2.5 py-1 rounded-full border transition-colors ${activeCategory === c.id
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'}`, children: c.label }, c.id))) })] }));
}
export function McpMarketplace({ installedIds, onInstall, onBack }) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('all');
    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return MCP_REGISTRY.filter((e) => {
            const matchesCategory = category === 'all' || e.category === category;
            const matchesQuery = !q ||
                e.name.toLowerCase().includes(q) ||
                e.description.toLowerCase().includes(q);
            return matchesCategory && matchesQuery;
        });
    }, [query, category]);
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: onBack, className: "text-slate-400 hover:text-slate-200 transition-colors", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) }), _jsx("h3", { className: "text-sm font-semibold text-slate-200", children: "MCP Server Marketplace" }), _jsxs("span", { className: "text-xs text-slate-500 ml-auto", children: [filtered.length, " servers"] })] }), _jsx(FilterBar, { query: query, onQuery: setQuery, categories: MCP_CATEGORIES, activeCategory: category, onCategory: setCategory }), _jsxs("div", { className: "space-y-2", children: [filtered.map((entry) => {
                        const installed = installedIds.has(entry.id);
                        return (_jsx(McpRegistryCard, { entry: entry, installed: installed, onAdd: () => {
                                const config = {
                                    name: entry.name,
                                    transport: entry.transport,
                                    url: entry.url,
                                    command: entry.command,
                                    args: entry.args ? [...entry.args] : undefined,
                                    env: entry.env
                                        ? { ...entry.env }
                                        : entry.requiresApiKey && entry.apiKeyEnvVar
                                            ? { [entry.apiKeyEnvVar]: '' }
                                            : undefined,
                                    enabled: true,
                                };
                                onInstall(config);
                            } }, entry.id));
                    }), filtered.length === 0 && (_jsx("p", { className: "text-sm text-slate-500 text-center py-8", children: "No servers match your search." }))] })] }));
}
function McpRegistryCard({ entry, installed, onAdd, }) {
    return (_jsxs("div", { className: "bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-start gap-3", children: [_jsx(EntryIcon, { id: entry.id, name: entry.name, emoji: entry.icon }), _jsxs("div", { className: "flex-1 min-w-0 space-y-1", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "text-sm font-medium text-slate-200", children: entry.name }), entry.badge && _jsx(Badge, { label: entry.badge }), installed && (_jsx("span", { className: "text-[10px] font-medium px-1.5 py-0.5 rounded border bg-green-900/40 text-green-400 border-green-700", children: "Added" }))] }), _jsx("p", { className: "text-xs text-slate-400 leading-relaxed", children: entry.description }), entry.notes && (_jsxs("p", { className: "text-[11px] text-amber-400/80 leading-relaxed", children: ["\u2139\uFE0F ", entry.notes] })), entry.requiresApiKey && entry.setupUrl && (_jsxs("a", { href: entry.setupUrl, target: "_blank", rel: "noopener noreferrer", onClick: (e) => e.stopPropagation(), className: "text-[11px] text-blue-400 hover:text-blue-300 underline", children: ["Get ", entry.apiKeyEnvVar ?? 'API key', " \u2192"] }))] }), _jsx("button", { onClick: onAdd, className: `flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${installed
                    ? 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-300'
                    : 'bg-blue-600 text-white hover:bg-blue-500'}`, children: installed ? 'Add again' : '+ Add' })] }));
}
export function ProviderMarketplace({ installedTypes, onInstall, onBack }) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('all');
    const filtered = useMemo(() => {
        const q = query.toLowerCase();
        return PROVIDER_REGISTRY.filter((e) => {
            const matchesCategory = category === 'all' || e.category === category;
            const matchesQuery = !q ||
                e.name.toLowerCase().includes(q) ||
                e.description.toLowerCase().includes(q);
            return matchesCategory && matchesQuery;
        });
    }, [query, category]);
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: onBack, className: "text-slate-400 hover:text-slate-200 transition-colors", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) }), _jsx("h3", { className: "text-sm font-semibold text-slate-200", children: "Provider Marketplace" }), _jsxs("span", { className: "text-xs text-slate-500 ml-auto", children: [filtered.length, " providers"] })] }), _jsx(FilterBar, { query: query, onQuery: setQuery, categories: PROVIDER_CATEGORIES, activeCategory: category, onCategory: setCategory }), _jsxs("div", { className: "space-y-2", children: [filtered.map((entry) => {
                        const installed = installedTypes.has(entry.id);
                        return (_jsx(ProviderRegistryCard, { entry: entry, installed: installed, onAdd: () => {
                                const config = {
                                    name: entry.name,
                                    type: entry.type,
                                    baseUrl: entry.baseUrl,
                                    defaultModel: entry.defaultModel,
                                };
                                onInstall(config);
                            } }, entry.id));
                    }), filtered.length === 0 && (_jsx("p", { className: "text-sm text-slate-500 text-center py-8", children: "No providers match your search." }))] })] }));
}
function ProviderRegistryCard({ entry, installed, onAdd, }) {
    return (_jsxs("div", { className: "bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-start gap-3", children: [_jsx(EntryIcon, { id: entry.id, name: entry.name, emoji: entry.icon }), _jsxs("div", { className: "flex-1 min-w-0 space-y-1", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: "text-sm font-medium text-slate-200", children: entry.name }), _jsx(Badge, { label: entry.badge }), entry.modelCount && (_jsx("span", { className: "text-[10px] text-slate-500", children: entry.modelCount })), installed && (_jsx("span", { className: "text-[10px] font-medium px-1.5 py-0.5 rounded border bg-green-900/40 text-green-400 border-green-700", children: "Added" }))] }), _jsx("p", { className: "text-xs text-slate-400 leading-relaxed", children: entry.description }), entry.notes && (_jsxs("p", { className: "text-[11px] text-amber-400/80 leading-relaxed", children: ["\u2139\uFE0F ", entry.notes] })), entry.requiresApiKey && entry.apiKeyUrl && (_jsx("a", { href: entry.apiKeyUrl, target: "_blank", rel: "noopener noreferrer", onClick: (e) => e.stopPropagation(), className: "text-[11px] text-blue-400 hover:text-blue-300 underline", children: "Get API key \u2192" })), !entry.requiresApiKey && entry.apiKeyUrl && (_jsx("a", { href: entry.apiKeyUrl, target: "_blank", rel: "noopener noreferrer", onClick: (e) => e.stopPropagation(), className: "text-[11px] text-blue-400 hover:text-blue-300 underline", children: "Learn more \u2192" }))] }), _jsx("button", { onClick: onAdd, className: `flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${installed
                    ? 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-300'
                    : 'bg-blue-600 text-white hover:bg-blue-500'}`, children: installed ? 'Add again' : '+ Add' })] }));
}
// Re-export uuidv4 so SettingsPanel can use it from this module if needed
export { uuidv4 };
//# sourceMappingURL=MarketplacePanel.js.map