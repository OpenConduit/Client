import React, { useState, useMemo } from 'react';
import type { McpRegistryEntry } from '../data/mcpRegistry';
import { MCP_REGISTRY, MCP_CATEGORIES } from '../data/mcpRegistry';
import type { ProviderRegistryEntry } from '../data/providerRegistry';
import { PROVIDER_REGISTRY, PROVIDER_CATEGORIES } from '../data/providerRegistry';
import type { McpServerConfig, ProviderConfig, McpTransport } from '../types';
import { v4 as uuidv4 } from 'uuid';

// ─── Brand icon loading ───────────────────────────────────────────────────────

const _iconFiles = import.meta.glob('../assets/marketplace/*.svg', { query: '?url', eager: true, import: 'default' }) as Record<string, string>;

/** Entry IDs that map to a differently-named icon file */
const ICON_FILE_MAP: Record<string, string> = {
  'azure-openai': 'azure',
  'azure-anthropic': 'azure',
};

function getIconUrl(id: string): string | undefined {
  const fileId = ICON_FILE_MAP[id] ?? id;
  return _iconFiles[`../assets/marketplace/${fileId}.svg`];
}

function EntryIcon({ id, name, emoji }: { id: string; name: string; emoji: string }) {
  const url = getIconUrl(id);
  if (!url) return <span className="text-2xl flex-shrink-0 w-8 text-center leading-8">{emoji}</span>;
  return (
    <div className="w-8 h-8 flex-shrink-0 bg-white rounded-lg p-1 flex items-center justify-center">
      <img src={url} alt={name} className="w-full h-full object-contain" />
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({ label }: { label: string }) {
  const color =
    label === 'Free' || label === 'Free tier'
      ? 'bg-green-900/60 text-green-300 border-green-700'
      : label === 'Local'
        ? 'bg-blue-900/60 text-blue-300 border-blue-700'
        : label === 'Enterprise'
          ? 'bg-purple-900/60 text-purple-300 border-purple-700'
          : 'bg-slate-700/60 text-slate-300 border-slate-600';
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${color}`}>
      {label}
    </span>
  );
}

// ─── Search + Category filter bar ─────────────────────────────────────────────

interface FilterBarProps {
  query: string;
  onQuery: (q: string) => void;
  categories: { id: string; label: string }[];
  activeCategory: string;
  onCategory: (c: string) => void;
}

function FilterBar({ query, onQuery, categories, activeCategory, onCategory }: FilterBarProps) {
  return (
    <div className="space-y-2">
      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search…"
        className="input-field text-sm"
      />
      <div className="flex gap-1 flex-wrap">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => onCategory(c.id)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              activeCategory === c.id
                ? 'bg-blue-600 text-white border-blue-500'
                : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── MCP Marketplace ──────────────────────────────────────────────────────────

interface McpMarketplaceProps {
  installedIds: Set<string>;
  onInstall: (partial: Omit<McpServerConfig, 'id'>) => void;
  onBack: () => void;
}

export function McpMarketplace({ installedIds, onInstall, onBack }: McpMarketplaceProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return MCP_REGISTRY.filter((e) => {
      const matchesCategory = category === 'all' || e.category === category;
      const matchesQuery =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-200 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-200">MCP Server Marketplace</h3>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} servers</span>
      </div>

      <FilterBar
        query={query}
        onQuery={setQuery}
        categories={MCP_CATEGORIES}
        activeCategory={category}
        onCategory={setCategory}
      />

      <div className="space-y-2">
        {filtered.map((entry) => {
          const installed = installedIds.has(entry.id);
          return (
            <McpRegistryCard
              key={entry.id}
              entry={entry}
              installed={installed}
              onAdd={() => {
                const config: Omit<McpServerConfig, 'id'> = {
                  name: entry.name,
                  transport: entry.transport as McpTransport,
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
              }}
            />
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">No servers match your search.</p>
        )}
      </div>
    </div>
  );
}

function McpRegistryCard({
  entry,
  installed,
  onAdd,
}: {
  entry: McpRegistryEntry;
  installed: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-start gap-3">
      <EntryIcon id={entry.id} name={entry.name} emoji={entry.icon} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-200">{entry.name}</span>
          {entry.badge && <Badge label={entry.badge} />}
          {installed && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-green-900/40 text-green-400 border-green-700">
              Added
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{entry.description}</p>
        {entry.notes && (
          <p className="text-[11px] text-amber-400/80 leading-relaxed">ℹ️ {entry.notes}</p>
        )}
        {entry.requiresApiKey && entry.setupUrl && (
          <a
            href={entry.setupUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-blue-400 hover:text-blue-300 underline"
          >
            Get {entry.apiKeyEnvVar ?? 'API key'} →
          </a>
        )}
      </div>
      <button
        onClick={onAdd}
        className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
          installed
            ? 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-300'
            : 'bg-blue-600 text-white hover:bg-blue-500'
        }`}
      >
        {installed ? 'Add again' : '+ Add'}
      </button>
    </div>
  );
}

// ─── Provider Marketplace ─────────────────────────────────────────────────────

interface ProviderMarketplaceProps {
  installedTypes: Set<string>;
  onInstall: (partial: Omit<ProviderConfig, 'id'>) => void;
  onBack: () => void;
}

export function ProviderMarketplace({ installedTypes, onInstall, onBack }: ProviderMarketplaceProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return PROVIDER_REGISTRY.filter((e) => {
      const matchesCategory = category === 'all' || e.category === category;
      const matchesQuery =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-200 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-200">Provider Marketplace</h3>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} providers</span>
      </div>

      <FilterBar
        query={query}
        onQuery={setQuery}
        categories={PROVIDER_CATEGORIES}
        activeCategory={category}
        onCategory={setCategory}
      />

      <div className="space-y-2">
        {filtered.map((entry) => {
          const installed = installedTypes.has(entry.id);
          return (
            <ProviderRegistryCard
              key={entry.id}
              entry={entry}
              installed={installed}
              onAdd={() => {
                const config: Omit<ProviderConfig, 'id'> = {
                  name: entry.name,
                  type: entry.type,
                  baseUrl: entry.baseUrl,
                  defaultModel: entry.defaultModel,
                };
                onInstall(config);
              }}
            />
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">No providers match your search.</p>
        )}
      </div>
    </div>
  );
}

function ProviderRegistryCard({
  entry,
  installed,
  onAdd,
}: {
  entry: ProviderRegistryEntry;
  installed: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-start gap-3">
      <EntryIcon id={entry.id} name={entry.name} emoji={entry.icon} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-200">{entry.name}</span>
          <Badge label={entry.badge} />
          {entry.modelCount && (
            <span className="text-[10px] text-slate-500">{entry.modelCount}</span>
          )}
          {installed && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-green-900/40 text-green-400 border-green-700">
              Added
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{entry.description}</p>
        {entry.notes && (
          <p className="text-[11px] text-amber-400/80 leading-relaxed">ℹ️ {entry.notes}</p>
        )}
        {entry.requiresApiKey && entry.apiKeyUrl && (
          <a
            href={entry.apiKeyUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-blue-400 hover:text-blue-300 underline"
          >
            Get API key →
          </a>
        )}
        {!entry.requiresApiKey && entry.apiKeyUrl && (
          <a
            href={entry.apiKeyUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-blue-400 hover:text-blue-300 underline"
          >
            Learn more →
          </a>
        )}
      </div>
      <button
        onClick={onAdd}
        className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
          installed
            ? 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-300'
            : 'bg-blue-600 text-white hover:bg-blue-500'
        }`}
      >
        {installed ? 'Add again' : '+ Add'}
      </button>
    </div>
  );
}

// Re-export uuidv4 so SettingsPanel can use it from this module if needed
export { uuidv4 };
