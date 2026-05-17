import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import type { ProviderConfig, McpServerConfig, AppSettings, ProviderType, McpTransport, McpTool, UpdateInfo, FeedbackPayload } from '../types';
import { service } from '../services';

type Tab = 'general' | 'providers' | 'mcp' | 'features' | 'labs' | 'analytics' | 'about' | string;

export interface ExtraTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export default function SettingsPanel({
  extraTabs,
  hideTabs,
}: {
  extraTabs?: ExtraTab[];
  hideTabs?: string[];
}) {
  const { showSettings, setShowSettings } = useUiStore();
  const { settings, saveSettings, refreshMcpStatus, mcpStatus } = useSettingsStore();
  const [tab, setTab] = useState<Tab>('general');

  if (!showSettings || !settings) return null;

  const builtInTabs: { id: Tab; label: string }[] = [
    { id: 'general',   label: 'General' },
    { id: 'providers', label: 'Providers' },
    { id: 'mcp',       label: 'MCP' },
    { id: 'features',  label: 'Features' },
    { id: 'labs',      label: 'Labs' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'about',     label: 'About' },
  ].filter((t) => !hideTabs?.includes(t.id));

  const allTabs = [
    ...builtInTabs,
    ...(extraTabs?.map((t) => ({ id: t.id, label: t.label })) ?? []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={() => setShowSettings(false)} />

      {/* Panel */}
      <div className="w-[600px] max-w-full bg-slate-900 border-l border-slate-700 flex flex-col h-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-100">Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-6 pt-3 flex-shrink-0 border-b border-slate-700/50 overflow-x-auto">
          {allTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-t-lg text-xs font-medium whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'bg-slate-800 text-slate-100 border border-b-0 border-slate-700'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === 'general' && <GeneralTab settings={settings} onSave={saveSettings} />}
          {tab === 'providers' && (
            <ProvidersTab settings={settings} onSave={saveSettings} />
          )}
          {tab === 'mcp' && (
            <McpTab
              settings={settings}
              onSave={saveSettings}
              mcpStatus={mcpStatus}
              onRefreshStatus={refreshMcpStatus}
            />
          )}
          {tab === 'labs' && <LabsTab settings={settings} onSave={saveSettings} />}
          {tab === 'features' && <FeaturesTab />}
          {tab === 'analytics' && <AnalyticsTab settings={settings} onSave={saveSettings} />}
          {tab === 'about' && <AboutTab settings={settings} onSave={saveSettings} />}
          {extraTabs?.map((t) => (
            <React.Fragment key={t.id}>
              {tab === t.id && t.content}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── General Tab ──────────────────────────────────────────────────────────────

function GeneralTab({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <Section title="Appearance">
        <Field label="Theme">
          <select
            value={settings.theme}
            onChange={(e) => onSave({ theme: e.target.value as AppSettings['theme'] })}
            className="select-field"
          >
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </Field>
      </Section>

      <Section title="Defaults">
        <Field label="Default Provider">
          <select
            value={settings.defaultProviderId ?? ''}
            onChange={(e) => onSave({ defaultProviderId: e.target.value || undefined })}
            className="select-field"
          >
            <option value="">None</option>
            {settings.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Default Model">
          <input
            type="text"
            value={settings.defaultModel ?? ''}
            onChange={(e) => onSave({ defaultModel: e.target.value || undefined })}
            placeholder="e.g. gpt-4o"
            className="input-field"
          />
        </Field>
      </Section>

      <Section title="Safety">
        <Field label="Require Tool Approval">
          <Toggle
            value={settings.requireToolApproval}
            onChange={(v) => onSave({ requireToolApproval: v })}
          />
        </Field>
        <p className="text-xs text-slate-500">
          When enabled, each MCP tool call must be approved before execution.
        </p>
      </Section>

      <Section title="Default Parameters">
        <Field label="Temperature">
          <input
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={settings.defaultParameters.temperature ?? 0.7}
            onChange={(e) =>
              onSave({
                defaultParameters: {
                  ...settings.defaultParameters,
                  temperature: parseFloat(e.target.value),
                },
              })
            }
            className="input-field w-24"
          />
        </Field>
        <Field label="Max Tokens">
          <input
            type="number"
            min={1}
            max={200000}
            value={settings.defaultParameters.maxTokens ?? 4096}
            onChange={(e) =>
              onSave({
                defaultParameters: {
                  ...settings.defaultParameters,
                  maxTokens: parseInt(e.target.value),
                },
              })
            }
            className="input-field w-28"
          />
        </Field>
      </Section>
      <Section title="Configuration">
        <p className="text-xs text-slate-500 -mt-1 mb-3">
          Export your settings for backup or sharing. The clean export omits API keys — safe to share.
          The full export includes API keys — keep it private.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => service.config.exportSettings(true)}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Export (clean)
          </button>
          <button
            onClick={() => service.config.exportSettings(false)}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Export (with API keys)
          </button>
          <button
            onClick={async () => {
              const imported = await service.config.importSettings();
              if (imported) onSave(imported);
            }}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Import Config
          </button>
        </div>
      </Section>
    </div>
  );
}

// ─── Providers Tab ────────────────────────────────────────────────────────────

function ProvidersTab({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  const [editing, setEditing] = useState<ProviderConfig | null>(null);
  const [isNew, setIsNew] = useState(false);

  const handleSaveProvider = (provider: ProviderConfig) => {
    const providers = isNew
      ? [...settings.providers, provider]
      : settings.providers.map((p) => (p.id === provider.id ? provider : p));
    onSave({ providers });
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this provider?')) return;
    onSave({ providers: settings.providers.filter((p) => p.id !== id) });
  };

  if (editing) {
    return (
      <ProviderForm
        provider={editing}
        onSave={handleSaveProvider}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-400">
          {settings.providers.length} provider{settings.providers.length !== 1 ? 's' : ''} configured
        </p>
        <button
          onClick={() => {
            setIsNew(true);
            setEditing({ id: uuidv4(), name: '', type: 'openai' });
          }}
          className="btn-primary text-xs px-3 py-1.5"
        >
          + Add Provider
        </button>
      </div>

      {settings.providers.map((p) => (
        <div
          key={p.id}
          className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-3"
        >
          <ProviderBadge type={p.type} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200">{p.name}</p>
            <p className="text-xs text-slate-500">
              {p.type}
              {p.baseUrl ? ` · ${p.baseUrl}` : ''}
              {p.defaultModel ? ` · ${p.defaultModel}` : ''}
            </p>
          </div>
          <button
            onClick={() => {
              setIsNew(false);
              setEditing({ ...p });
            }}
            className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(p.id)}
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
          >
            Delete
          </button>
        </div>
      ))}

      {settings.providers.length === 0 && (
        <EmptyState
          icon="🔑"
          title="No providers"
          subtitle="Add an OpenAI, Anthropic, or LM Studio provider to get started"
        />
      )}
    </div>
  );
}

function ProviderForm({
  provider,
  onSave,
  onCancel,
}: {
  provider: ProviderConfig;
  onSave: (p: ProviderConfig) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ProviderConfig>({ ...provider });

  const set = (key: keyof ProviderConfig, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-200 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-200">
          {provider.name ? `Edit ${provider.name}` : 'New Provider'}
        </h3>
      </div>

      {/* ── Section: Connection ── */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Connection</p>

        <Field label="Display Name">
          <input
            autoFocus
            type="text"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="My OpenAI"
            className="input-field"
          />
        </Field>

        <Field label="Type">
          <select
            value={draft.type}
            onChange={(e) => set('type', e.target.value as ProviderType)}
            className="select-field"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="lmstudio">LM Studio</option>
          </select>
        </Field>

        {draft.type !== 'lmstudio' && (
          <Field label="API Key">
            <input
              type="password"
              value={draft.apiKey ?? ''}
              onChange={(e) => set('apiKey', e.target.value)}
              placeholder="sk-..."
              className="input-field"
              autoComplete="off"
            />
          </Field>
        )}

        <Field label="Base URL">
          <input
            type="url"
            value={draft.baseUrl ?? ''}
            onChange={(e) => set('baseUrl', e.target.value)}
            placeholder={
              draft.type === 'lmstudio'
                ? 'http://localhost:1234/v1'
                : draft.type === 'anthropic'
                  ? 'https://…services.ai.azure.com/anthropic'
                  : 'https://api.openai.com/v1'
            }
            className="input-field"
          />
          {draft.type === 'anthropic' && draft.baseUrl?.includes('azure.com') && (
            <p className="text-xs text-amber-400 mt-1">
              Azure detected — do <strong>not</strong> include <code>/v1/messages</code> in the URL.
            </p>
          )}
        </Field>

        {draft.type === 'anthropic' && (
          <Field label="API Version">
            <input
              type="text"
              value={draft.apiVersion ?? ''}
              onChange={(e) => set('apiVersion', e.target.value)}
              placeholder="e.g. 2025-04-15  (required for Azure AI Foundry)"
              className="input-field font-mono text-xs"
            />
          </Field>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-slate-700/60" />

      {/* ── Section: Models ── */}
      <div className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Models</p>

        <Field label="Default Model">
          <input
            type="text"
            value={draft.defaultModel ?? ''}
            onChange={(e) => set('defaultModel', e.target.value)}
            placeholder={
              draft.type === 'anthropic'
                ? 'claude-sonnet-4-5'
                : draft.type === 'lmstudio'
                  ? 'local-model'
                  : 'gpt-4o'
            }
            className="input-field"
          />
        </Field>

        <ModelsField
          models={draft.customModels ?? []}
          contextWindows={draft.modelContextWindows ?? {}}
          onChange={(customModels, modelContextWindows) =>
            setDraft((d) => ({ ...d, customModels, modelContextWindows }))
          }
        />
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-2 pt-1 border-t border-slate-700/60">
        <button
          onClick={() => onSave(draft)}
          disabled={!draft.name.trim()}
          className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
        >
          Save Provider
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm px-4 py-2">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── MCP Tab ──────────────────────────────────────────────────────────────────

function McpTab({
  settings,
  onSave,
  mcpStatus,
  onRefreshStatus,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
  mcpStatus: Record<string, boolean>;
  onRefreshStatus: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<McpServerConfig | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [toolsMap, setToolsMap] = useState<Record<string, McpTool[]>>({});
  const [loadingTools, setLoadingTools] = useState<string | null>(null);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const handleToggleTools = async (serverId: string) => {
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
      } catch {
        setToolsMap((m) => ({ ...m, [serverId]: [] }));
      } finally {
        setLoadingTools(null);
      }
    }
  };

  const handleSaveServer = (server: McpServerConfig) => {
    const mcpServers = isNew
      ? [...settings.mcpServers, server]
      : settings.mcpServers.map((s) => (s.id === server.id ? server : s));
    onSave({ mcpServers });
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this MCP server?')) return;
    service.mcp.disconnect(id).catch(() => { /* intentional */ });
    onSave({ mcpServers: settings.mcpServers.filter((s) => s.id !== id) });
  };

  const handleToggleConnect = async (server: McpServerConfig) => {
    setConnecting(server.id);
    try {
      if (mcpStatus[server.id]) {
        await service.mcp.disconnect(server.id);
      } else {
        await service.mcp.connect(server);
      }
      await onRefreshStatus();
    } catch (err) {
      alert(`Failed: ${err}`);
    } finally {
      setConnecting(null);
    }
  };

  const handleToggleEnabled = (id: string, enabled: boolean) => {
    onSave({
      mcpServers: settings.mcpServers.map((s) => (s.id === id ? { ...s, enabled } : s)),
    });
  };

  if (editing) {
    return (
      <McpServerForm
        server={editing}
        onSave={handleSaveServer}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-400">
          {settings.mcpServers.length} server{settings.mcpServers.length !== 1 ? 's' : ''} configured
        </p>
        <div className="flex gap-2">
          <button onClick={onRefreshStatus} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700 transition-colors">
            Refresh
          </button>
          <button
            onClick={() => {
              setIsNew(true);
              setEditing({
                id: uuidv4(),
                name: '',
                transport: 'http-sse',
                enabled: true,
              });
            }}
            className="btn-primary text-xs px-3 py-1.5"
          >
            + Add Server
          </button>
        </div>
      </div>

      {settings.mcpServers.map((s) => (
        <div
          key={s.id}
          className="bg-slate-800 rounded-xl p-4 border border-slate-700 space-y-3"
        >
          <div className="flex items-center gap-3">
            {/* Connection status dot */}
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                mcpStatus[s.id] ? 'bg-green-400' : 'bg-slate-600'
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200">{s.name}</p>
              <p className="text-xs text-slate-500">
                {s.transport === 'http-sse' ? s.url : `${s.command} ${(s.args ?? []).join(' ')}`}
              </p>
            </div>

            {/* Enabled toggle */}
            <Toggle
              value={s.enabled}
              onChange={(v) => handleToggleEnabled(s.id, v)}
              size="sm"
            />

            {/* Connect / Disconnect */}
            <button
              onClick={() => handleToggleConnect(s)}
              disabled={connecting === s.id}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                mcpStatus[s.id]
                  ? 'bg-red-700/50 text-red-300 hover:bg-red-700'
                  : 'bg-green-700/50 text-green-300 hover:bg-green-700'
              } disabled:opacity-50`}
            >
              {connecting === s.id ? '…' : mcpStatus[s.id] ? 'Disconnect' : 'Connect'}
            </button>

            <button
              onClick={() => {
                setIsNew(false);
                setEditing({ ...s });
              }}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(s.id)}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
            >
              Delete
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-600 font-mono flex-1">
              {s.transport} · id: {s.id.slice(0, 8)}
            </span>
            {mcpStatus[s.id] && (
              <button
                onClick={() => handleToggleTools(s.id)}
                className="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded hover:bg-slate-700 transition-colors flex items-center gap-1"
              >
                {loadingTools === s.id ? (
                  <span>loading…</span>
                ) : (
                  <>
                    <span>{expandedTools.has(s.id) ? '▾' : '▸'}</span>
                    <span>
                      {toolsMap[s.id] != null
                        ? `${toolsMap[s.id].length} tool${toolsMap[s.id].length !== 1 ? 's' : ''}`
                        : 'Tools'}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>

          {expandedTools.has(s.id) && toolsMap[s.id] && (
            <div className="border-t border-slate-700 pt-2 space-y-1">
              {toolsMap[s.id].length === 0 ? (
                <p className="text-xs text-slate-500 italic">No tools exposed by this server.</p>
              ) : (
                toolsMap[s.id].map((t) => (
                  <div key={t.name} className="flex gap-2 items-start">
                    <code className="text-[10px] bg-slate-700 text-cyan-300 px-1.5 py-0.5 rounded font-mono flex-shrink-0 leading-4">
                      {t.name}
                    </code>
                    {t.description && (
                      <span className="text-[10px] text-slate-400 leading-4">{t.description}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}

      {settings.mcpServers.length === 0 && (
        <EmptyState
          icon="🔌"
          title="No MCP servers"
          subtitle="Add HTTP-SSE or stdio MCP servers to give the AI access to tools"
        />
      )}
    </div>
  );
}

function McpServerForm({
  server,
  onSave,
  onCancel,
}: {
  server: McpServerConfig;
  onSave: (s: McpServerConfig) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<McpServerConfig>({ ...server });
  // HTTP headers as editable rows
  const [headerRows, setHeaderRows] = useState<[string, string][]>(
    Object.entries(draft.headers ?? {})
  );

  const set = <K extends keyof McpServerConfig>(key: K, value: McpServerConfig[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const addHeaderRow = () => setHeaderRows((r) => [...r, ['', '']]);
  const setHeaderRow = (i: number, k: string, v: string) =>
    setHeaderRows((r) => {
      const next = [...r] as [string, string][];
      next[i] = [k, v];
      return next;
    });
  const removeHeaderRow = (i: number) =>
    setHeaderRows((r) => r.filter((_, idx) => idx !== i));

  const handleSave = () => {
    const headers = Object.fromEntries(
      headerRows.filter(([k]) => k.trim())
    );
    onSave({ ...draft, headers: Object.keys(headers).length ? headers : undefined });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-200 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-slate-200">
          {server.name ? `Edit ${server.name}` : 'New MCP Server'}
        </h3>
      </div>

      {/* Type */}
      <Field label="Type">
        <select
          value={draft.transport}
          onChange={(e) => set('transport', e.target.value as McpTransport)}
          className="select-field"
        >
          <option value="http-streamable">HTTP Server — Streamable HTTP (modern)</option>
          <option value="http-sse">HTTP Server — SSE (legacy)</option>
          <option value="stdio">stdio process</option>
        </select>
      </Field>

      {/* Name + ID side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Name</label>
          <p className="text-xs text-slate-600 mb-1">Help you identify the tool</p>
          <input
            autoFocus
            type="text"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="My MCP Server"
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">ID</label>
          <p className="text-xs text-slate-600 mb-1">A unique identifier used by the model</p>
          <input
            type="text"
            value={draft.id}
            onChange={(e) => set('id', e.target.value)}
            className="input-field font-mono text-xs"
          />
        </div>
      </div>

      {/* HTTP fields */}
      {(draft.transport === 'http-sse' || draft.transport === 'http-streamable') ? (
        <>
          <Field label="URL">
            <input
              type="url"
              value={draft.url ?? ''}
              onChange={(e) => set('url', e.target.value)}
              placeholder="https://..."
              className="input-field"
            />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.autoApprove ?? false}
              onChange={(e) => set('autoApprove', e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-sm text-slate-300">Run tools automatically</span>
          </label>

          {/* Key-value HTTP headers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-400">HTTP headers</label>
              <button
                type="button"
                onClick={addHeaderRow}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                + Add header
              </button>
            </div>
            <div className="space-y-2">
              {headerRows.map(([k, v], i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={k}
                    onChange={(e) => setHeaderRow(i, e.target.value, v)}
                    placeholder="Header name"
                    className="input-field flex-1 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={v}
                    onChange={(e) => setHeaderRow(i, k, e.target.value)}
                    placeholder="Value"
                    className="input-field flex-1 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => removeHeaderRow(i)}
                    className="text-slate-500 hover:text-red-400 transition-colors text-sm leading-none px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {headerRows.length === 0 && (
                <p className="text-xs text-slate-600 italic">No headers added</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <Field label="Command">
            <input
              type="text"
              value={draft.command ?? ''}
              onChange={(e) => set('command', e.target.value)}
              placeholder="node /path/to/server.js"
              className="input-field font-mono text-xs"
            />
          </Field>
          <Field label="Args (space-separated)">
            <input
              type="text"
              value={(draft.args ?? []).join(' ')}
              onChange={(e) =>
                set('args', e.target.value.split(' ').filter(Boolean))
              }
              placeholder="--port 3000"
              className="input-field font-mono text-xs"
            />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.autoApprove ?? false}
              onChange={(e) => set('autoApprove', e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-sm text-slate-300">Run tools automatically</span>
          </label>

          <Field label="Environment variables">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">Key / value pairs</span>
                <button
                  type="button"
                  onClick={() => {
                    const env = { ...(draft.env ?? {}), '': '' };
                    set('env', env);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  + Add
                </button>
              </div>
              {Object.entries(draft.env ?? {}).map(([k, v], i) => (
                <div key={i} className="flex gap-2 items-center mb-2">
                  <input
                    type="text"
                    defaultValue={k}
                    onBlur={(e) => {
                      const env = Object.fromEntries(
                        Object.entries(draft.env ?? {}).map(([ek, ev], idx) =>
                          idx === i ? [e.target.value, ev] : [ek, ev]
                        )
                      );
                      set('env', env);
                    }}
                    placeholder="KEY"
                    className="input-field flex-1 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={v}
                    onChange={(e) => set('env', { ...draft.env, [k]: e.target.value })}
                    placeholder="value"
                    className="input-field flex-1 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const env = Object.fromEntries(
                        Object.entries(draft.env ?? {}).filter((_, idx) => idx !== i)
                      );
                      set('env', env);
                    }}
                    className="text-slate-500 hover:text-red-400 transition-colors text-sm px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {Object.keys(draft.env ?? {}).length === 0 && (
                <p className="text-xs text-slate-600 italic">No variables added</p>
              )}
            </div>
          </Field>
        </>
      )}

      <Field label="Enabled by default">
        <Toggle value={draft.enabled} onChange={(v) => set('enabled', v)} />
      </Field>

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={!draft.name.trim()}
          className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
        >
          Save Server
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm px-4 py-2">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Unified Models Field ─────────────────────────────────────────────────────
// One entry per model: name + optional context window size.


function ModelsField({
  models,
  contextWindows,
  onChange,
}: {
  models: string[];
  contextWindows: Record<string, number>;
  onChange: (models: string[], contextWindows: Record<string, number>) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCtx, setFormCtx] = useState('');
  const nameRef = React.useRef<HTMLInputElement>(null);

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
    if (!name) return;
    const newModels = models.includes(name) ? models : [...models, name];
    const newCtx = { ...contextWindows };
    const tok = parseInt(formCtx);
    if (!isNaN(tok) && tok > 0) newCtx[name] = tok;
    onChange(newModels, newCtx);
    setShowForm(false);
  };

  const remove = (name: string) => {
    const newModels = models.filter((m) => m !== name);
    const newCtx = { ...contextWindows };
    delete newCtx[name];
    onChange(newModels, newCtx);
  };

  const updateCtx = (name: string, raw: string) => {
    const newCtx = { ...contextWindows };
    const tok = parseInt(raw);
    if (!raw || isNaN(tok) || tok < 1) {
      delete newCtx[name];
    } else {
      newCtx[name] = tok;
    }
    onChange(models, newCtx);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-slate-400">Models</label>
        <button
          type="button"
          onClick={openForm}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          + Add model
        </button>
      </div>

      {/* Inline add form */}
      {showForm && (
        <div className="mb-3 p-3 rounded-lg border border-slate-600 bg-slate-800/80 space-y-2">
          <div>
            <p className="text-[11px] text-slate-400 mb-1">Model name</p>
            <input
              ref={nameRef}
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') setShowForm(false); }}
              placeholder="e.g. gpt-5.1"
              className="input-field w-full text-sm font-mono"
            />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 mb-1">Context window <span className="text-slate-600">(tokens — optional)</span></p>
            <input
              type="number"
              min={1024}
              step={1024}
              value={formCtx}
              onChange={(e) => setFormCtx(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') setShowForm(false); }}
              placeholder="e.g. 128000"
              className="input-field w-full text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={commit} disabled={!formName.trim()} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-40">Add</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
          </div>
        </div>
      )}

      {/* Model list */}
      {allNames.length > 0 ? (
        <div className="space-y-1.5">
          {allNames.map((name) => (
            <div key={name} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 border border-slate-700">
              <span className="flex-1 text-sm text-slate-200 font-mono truncate">{name}</span>
              <input
                type="number"
                min={1024}
                step={1024}
                value={contextWindows[name] ?? ''}
                onChange={(e) => updateCtx(name, e.target.value)}
                placeholder="ctx tokens"
                className="w-28 bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-xs text-slate-400 text-right placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => remove(name)}
                className="text-slate-500 hover:text-red-400 transition-colors text-xs leading-none pl-1"
              >✕</button>
            </div>
          ))}
        </div>
      ) : (
        !showForm && <p className="text-xs text-slate-600 italic">No models added — leave empty to use the API's model list</p>
      )}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

// ─── Features Tab ─────────────────────────────────────────────────────────────

function FeaturesTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center select-none">
      <p className="text-sm font-medium text-slate-400">No features yet</p>
      <p className="text-xs text-slate-600 mt-1.5 max-w-xs">
        Experimental features that prove themselves graduate here from Labs. Check back after trying things out.
      </p>
    </div>
  );
}

// ─── Labs Tab ─────────────────────────────────────────────────────────────────

function LabsTab({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  const labs = settings.labs ?? { aiTaskTracking: false, aiClarifyingQuestions: false, debugMode: false };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex items-start gap-3 rounded-xl bg-purple-950/40 border border-purple-700/40 px-4 py-3">
        <span className="text-lg mt-0.5">⚗️</span>
        <div>
          <p className="text-sm font-medium text-purple-300">Experimental Features</p>
          <p className="text-xs text-slate-400 mt-0.5">
            These are in active development. Features that graduate will move to the ✨ Features tab.
          </p>
        </div>
      </div>

      <Section title="AI Capabilities">
        {/* AI Task Tracking */}
        <LabsFeatureRow
          title="AI Task Tracking"
          description="The AI maintains a live task list during multi-step work. Tasks appear in a floating panel and update as the AI makes progress."
          value={labs.aiTaskTracking}
          onChange={(v) => onSave({ labs: { ...labs, aiTaskTracking: v } })}
        />

        {/* AI Clarifying Questions */}
        <LabsFeatureRow
          title="AI Clarifying Questions"
          description="When faced with an ambiguous or complex request, the AI can ask you targeted questions inline before proceeding. You answer them directly in the chat."
          value={labs.aiClarifyingQuestions}
          onChange={(v) => onSave({ labs: { ...labs, aiClarifyingQuestions: v } })}
        />

        {/* Debug Mode */}
        <LabsFeatureRow
          title="Debug Mode"
          description="Shows a download button on every AI message so you can save the full raw response (content, thinking, tool calls, questions) as JSON for inspection."
          value={labs.debugMode ?? false}
          onChange={(v) => onSave({ labs: { ...labs, debugMode: v } })}
        />
      </Section>
    </div>
  );
}

function LabsFeatureRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-200">{title}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-800/60 text-purple-300 font-medium">LABS</span>
          </div>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{description}</p>
        </div>
        <div className="shrink-0 pt-0.5">
          <Toggle value={value} onChange={onChange} />
        </div>
      </div>
    </div>
  );
}

// ─── Shared Helpers ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-slate-300 flex-shrink-0">{label}</label>
      <div className="flex-1 min-w-0 flex justify-end">{children}</div>
    </div>
  );
}

function Toggle({
  value,
  onChange,
  size = 'md',
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  size?: 'sm' | 'md';
}) {
  const w = size === 'sm' ? 'w-8 h-4' : 'w-10 h-5';
  const dot = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const translate = size === 'sm' ? 'translate-x-4' : 'translate-x-5';

  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative ${w} rounded-full transition-colors ${
        value ? 'bg-blue-600' : 'bg-slate-600'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 ${dot} rounded-full bg-white transition-transform ${
          value ? translate : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function ProviderBadge({ type }: { type: ProviderType }) {
  const colors: Record<ProviderType, string> = {
    openai: 'bg-emerald-800 text-emerald-200',
    anthropic: 'bg-orange-800 text-orange-200',
    lmstudio: 'bg-purple-800 text-purple-200',
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${colors[type]}`}>
      {type === 'lmstudio' ? 'LMS' : type === 'anthropic' ? 'ANT' : 'OAI'}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center py-10">
      <p className="text-3xl mb-2">{icon}</p>
      <p className="text-sm font-medium text-slate-400">{title}</p>
      <p className="text-xs text-slate-600 mt-1">{subtitle}</p>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  const { records, clearRecords } = useAnalyticsStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // ── Aggregate stats ──────────────────────────────────────────────────────
  const totalIn = records.reduce((s, r) => s + r.usage.inputTokens, 0);
  const totalOut = records.reduce((s, r) => s + r.usage.outputTokens, 0);
  const totalCost = records.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  const hasCost = records.some((r) => r.costUsd !== null);

  // Per-model breakdown
  const byModel = records.reduce<Record<string, { in: number; out: number; cost: number; hasCost: boolean; count: number }>>((acc, r) => {
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

  function setPricing(key: string, field: 'inputPer1M' | 'outputPer1M', val: string) {
    const existing = pricing[key] ?? { inputPer1M: 0, outputPer1M: 0 };
    onSave({ modelPricing: { ...pricing, [key]: { ...existing, [field]: parseFloat(val) || 0 } } });
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Section title="Usage Summary">
        {records.length === 0 ? (
          <p className="text-xs text-slate-500">No usage recorded yet. Data appears here after your first chat.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Total input', value: totalIn.toLocaleString() + ' tok' },
                { label: 'Total output', value: totalOut.toLocaleString() + ' tok' },
                { label: 'Est. cost', value: hasCost ? `$${totalCost.toFixed(4)}` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-800/60 rounded-lg px-3 py-2.5 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* Per-model table */}
            <div className="rounded-lg border border-slate-700/50 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800/60 text-slate-500">
                    <th className="text-left px-3 py-2 font-medium">Provider / Model</th>
                    <th className="text-right px-3 py-2 font-medium">Turns</th>
                    <th className="text-right px-3 py-2 font-medium">Input tok</th>
                    <th className="text-right px-3 py-2 font-medium">Output tok</th>
                    <th className="text-right px-3 py-2 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byModel).map(([key, m], i) => (
                    <tr key={key} className={i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/30'}>
                      <td className="px-3 py-2 text-slate-300 font-mono text-[11px]">{key}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{m.count}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{m.in.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{m.out.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{m.hasCost ? `$${m.cost.toFixed(4)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex justify-end">
              {showClearConfirm ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Clear all records?</span>
                  <button onClick={() => { clearRecords(); setShowClearConfirm(false); }}
                    className="px-2 py-1 rounded bg-red-700/70 text-red-200 hover:bg-red-600/70">Yes, clear</button>
                  <button onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setShowClearConfirm(true)}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                  Clear history
                </button>
              )}
            </div>
          </>
        )}
      </Section>

      {/* Pricing */}
      <Section title="Model Pricing">
        <p className="text-xs text-slate-500 -mt-1 mb-3">
          Enter cost per 1M tokens to see estimated charges. Format: <span className="font-mono text-slate-400">providerId/model-name</span>.
          Provider IDs come from your Providers settings.
        </p>
        {modelKeys.length === 0 && (
          <p className="text-xs text-slate-600">No models seen yet — pricing rows appear automatically after first use.</p>
        )}
        <div className="space-y-2">
          {modelKeys.map((key) => {
            const p = pricing[key] ?? { inputPer1M: 0, outputPer1M: 0 };
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono flex-1 truncate" title={key}>{key}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-600">in $</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={p.inputPer1M}
                    onChange={(e) => setPricing(key, 'inputPer1M', e.target.value)}
                    className="input-field w-20 text-xs py-1"
                    placeholder="0.00"
                  />
                  <span className="text-[10px] text-slate-600">out $</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={p.outputPer1M}
                    onChange={(e) => setPricing(key, 'outputPer1M', e.target.value)}
                    className="input-field w-20 text-xs py-1"
                    placeholder="0.00"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick-add a new model key */}
        <AddModelPricingRow
          existingKeys={modelKeys}
          onAdd={(key) => onSave({ modelPricing: { ...pricing, [key]: { inputPer1M: 0, outputPer1M: 0 } } })}
        />
      </Section>
    </div>
  );
}

function AddModelPricingRow({ existingKeys, onAdd }: { existingKeys: string[]; onAdd: (key: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="providerId/model-name"
        className="input-field flex-1 text-xs py-1"
      />
      <button
        onClick={() => {
          if (val.trim() && !existingKeys.includes(val.trim())) {
            onAdd(val.trim());
            setVal('');
          }
        }}
        className="btn-secondary text-xs px-3 py-1.5"
      >
        Add
      </button>
    </div>
  );
}

// ─── About Tab ────────────────────────────────────────────────────────────────

function AboutTab({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (p: Partial<AppSettings>) => Promise<void>;
}) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkState, setCheckState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [checkError, setCheckError] = useState('');
  const channel = settings.updateChannel ?? 'stable';

  const [feedbackType, setFeedbackType] = useState<FeedbackPayload['type']>('bug');
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackDesc, setFeedbackDesc] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState('');

  async function checkUpdates() {
    setCheckState('loading');
    setUpdateInfo(null);
    setCheckError('');
    try {
      const info = await service.updater.checkForUpdates();
      setUpdateInfo(info);
      setCheckState('idle');
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : String(e));
      setCheckState('error');
    }
  }

  async function submitFeedback() {
    if (!feedbackTitle.trim() || !feedbackDesc.trim()) return;
    setSubmitState('loading');
    setSubmitError('');
    try {
      await service.updater.submitFeedback({ type: feedbackType, title: feedbackTitle.trim(), description: feedbackDesc.trim() });
      setSubmitState('success');
      setFeedbackTitle('');
      setFeedbackDesc('');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
      setSubmitState('error');
    }
  }

  return (
    <div className="space-y-6">
      {/* App info */}
      <div className="flex items-center gap-4 rounded-xl bg-slate-800/40 border border-slate-700 px-4 py-4">
        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
          <img src="/app-icon.png" alt="OpenConduit" className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-100">OpenConduit</p>
          <p className="text-xs text-slate-400 mt-0.5">v{__APP_VERSION__}</p>
          <p className="text-xs text-slate-600 mt-0.5">Built with Electron + React + Tailwind</p>
        </div>
      </div>

      {/* Update checker */}
      <Section title="Updates">
        {/* Channel selector */}
        <div className="mb-3">
          <label className="text-xs text-slate-400 block mb-1.5">Update channel</label>
          <select
            value={channel}
            onChange={(e) => { onSave({ updateChannel: e.target.value as 'stable' | 'beta' | 'alpha' }); setUpdateInfo(null); }}
            className="w-48 bg-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 border border-slate-600"
          >
            <option value="stable">Stable</option>
            <option value="beta">Beta</option>
            <option value="alpha">Alpha</option>
          </select>
          <p className="mt-1.5 text-[11px] text-slate-600">
            {channel === 'stable' && 'Production releases only.'}
            {channel === 'beta' && 'Beta releases only — no alpha builds.'}
            {channel === 'alpha' && 'Bleeding edge — alpha and beta pre-releases.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={checkUpdates}
            disabled={checkState === 'loading'}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              checkState === 'loading'
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {checkState === 'loading' ? 'Checking…' : 'Check for Updates'}
          </button>
        </div>

        {checkState === 'error' && (
          <p className="mt-2 text-xs text-red-400">{checkError}</p>
        )}

        {updateInfo && (
          <div className={`mt-3 rounded-lg border px-3 py-2.5 text-xs ${
            updateInfo.hasUpdate
              ? 'bg-green-950/40 border-green-700/40 text-green-300'
              : 'bg-slate-800/40 border-slate-700 text-slate-400'
          }`}>
            {updateInfo.hasUpdate ? (
              <>
                <p className="font-medium">🎉 Update available — v{updateInfo.latestVersion}</p>
                {updateInfo.releaseNotes && (
                  <p className="mt-1 text-green-400/70">{updateInfo.releaseNotes}</p>
                )}
                {updateInfo.downloadUrl && (
                  <button
                    onClick={() => service.updater.openExternal(updateInfo.downloadUrl!)}
                    className="inline-block mt-2 underline text-green-400 hover:text-green-200 text-left"
                  >
                    Download v{updateInfo.latestVersion} →
                  </button>
                )}
              </>
            ) : (
              <p>✓ You're on the latest version (v{updateInfo.currentVersion})</p>
            )}
          </div>
        )}
      </Section>

      {/* Feedback */}
      <Section title="Send Feedback">
        <p className="text-xs text-slate-500 -mt-1 mb-3">
          Report a bug or request a feature. Opens a pre-filled GitHub issue in your browser.
        </p>

        {submitState === 'success' ? (
          <div className="rounded-lg bg-green-950/40 border border-green-700/40 px-3 py-3 text-sm text-green-300 flex items-center gap-2">
            <span>✓</span>
            <span>Opening GitHub… finish submitting in your browser.</span>
            <button
              onClick={() => setSubmitState('idle')}
              className="ml-auto text-xs text-green-500 hover:text-green-300"
            >
              Send another
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Type picker */}
            <div className="flex gap-2">
              {(['bug', 'feature'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFeedbackType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    feedbackType === t
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500/60'
                  }`}
                >
                  {t === 'bug' ? '🐛 Bug Report' : '✨ Feature Request'}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={feedbackTitle}
              onChange={(e) => setFeedbackTitle(e.target.value)}
              placeholder="Title — short summary"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
            />

            <textarea
              rows={4}
              value={feedbackDesc}
              onChange={(e) => setFeedbackDesc(e.target.value)}
              placeholder={
                feedbackType === 'bug'
                  ? 'Describe what happened and how to reproduce it…'
                  : 'Describe the feature and why it would be useful…'
              }
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />

            {submitState === 'error' && (
              <p className="text-xs text-red-400">{submitError}</p>
            )}

            <button
              onClick={submitFeedback}
              disabled={
                submitState === 'loading' ||
                !feedbackTitle.trim() ||
                !feedbackDesc.trim()
              }
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                submitState === 'loading' || !feedbackTitle.trim() || !feedbackDesc.trim()
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {submitState === 'loading' ? 'Opening…' : 'Open GitHub Issue →'}
            </button>
          </div>
        )}
      </Section>
    </div>
  );
}
