import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCompare } from '../hooks/useCompare';
import type { CompareColumn } from '../hooks/useCompare';
import InputBar from './InputBar';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';

// ─── Column header with unified model picker ──────────────────────────────────

interface ColumnHeaderProps {
  col: CompareColumn;
  canRemove: boolean;
  onUpdate: (id: string, updates: Partial<Pick<CompareColumn, 'providerId' | 'model' | 'routingProfileId'>>) => void;
  onRemove: (id: string) => void;
}

function ColumnHeader({ col, canRemove, onUpdate, onRemove }: ColumnHeaderProps) {
  const { settings, models, loadModels } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Load all provider models when the dropdown opens
  useEffect(() => {
    if (open) {
      settings?.providers.forEach((p) => { if (!models[p.id]) loadModels(p.id); });
      setSearch('');
    }
  }, [open, settings?.providers, models, loadModels]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectModel = useCallback((pid: string, m: string) => {
    onUpdate(col.id, { providerId: pid, model: m, routingProfileId: undefined });
    setOpen(false);
  }, [col.id, onUpdate]);

  const selectProfile = useCallback((profileId: string) => {
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

  const profiles = (settings?.routingProfiles ?? []).filter(
    (p) => !lowerSearch || p.name.toLowerCase().includes(lowerSearch),
  );

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-850 flex-shrink-0">
      <div ref={ref} className="relative flex-1 min-w-0">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-1.5 bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none hover:border-blue-500 cursor-pointer transition-colors"
        >
          <span className="truncate flex-1 text-left">{label}</span>
          <svg className="w-3 h-3 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden">
            <div className="p-2 border-b border-slate-700">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models…"
                className="w-full bg-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none placeholder-slate-500"
              />
            </div>
            <div className="overflow-y-auto max-h-72">
              {/* Routing Profiles */}
              {profiles.length > 0 && (
                <div>
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                    Routing Profiles
                  </div>
                  {profiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => selectProfile(profile.id)}
                      className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors text-slate-300"
                    >
                      <span className="text-blue-400">⇢</span>
                      <span className="truncate flex-1">{profile.name}</span>
                      {col.routingProfileId === profile.id && (
                        <span className="text-blue-400 flex-shrink-0">✓</span>
                      )}
                    </button>
                  ))}
                  <div className="border-t border-slate-700 my-1" />
                </div>
              )}

              {/* Models grouped by provider */}
              {settings?.providers.map((provider) => {
                const all = [
                  ...(provider.customModels ?? []),
                  ...(models[provider.id] ?? []).filter((m) => !provider.customModels?.includes(m)),
                ];
                const filtered = all.filter(
                  (m) => !lowerSearch || m.toLowerCase().includes(lowerSearch) || provider.name.toLowerCase().includes(lowerSearch),
                );
                if (filtered.length === 0) return null;
                return (
                  <div key={provider.id}>
                    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                      {provider.name}
                    </div>
                    {filtered.map((m) => {
                      const isActive = col.providerId === provider.id && col.model === m;
                      return (
                        <button
                          key={m}
                          onClick={() => selectModel(provider.id, m)}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-700 transition-colors ${isActive ? 'text-blue-400' : 'text-slate-300'}`}
                        >
                          <span className={`w-3 flex-shrink-0 ${isActive ? 'opacity-100' : 'opacity-0'}`}>✓</span>
                          <span className="truncate">{m}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {canRemove && (
        <button
          onClick={() => onRemove(col.id)}
          className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors flex-shrink-0"
          title="Remove column"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Single response column ───────────────────────────────────────────────────

interface ColumnViewProps {
  col: CompareColumn;
  canRemove: boolean;
  onUpdate: (id: string, updates: Partial<Pick<CompareColumn, 'providerId' | 'model' | 'routingProfileId'>>) => void;
  onRemove: (id: string) => void;
  onContinue: (col: CompareColumn) => void;
}

function ColumnView({ col, canRemove, onUpdate, onRemove, onContinue }: ColumnViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex-1 flex flex-col min-w-0 border-r border-slate-700 last:border-r-0">
      <ColumnHeader col={col} canRemove={canRemove} onUpdate={onUpdate} onRemove={onRemove} />

      {/* Message thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {col.messages.length === 0 ? (
          <p className="text-slate-500 text-xs m-auto">Send a prompt to compare.</p>
        ) : (
          col.messages.map((msg, i) => (
            <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
              {msg.role === 'user' ? (
                <div className="max-w-[85%] bg-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100">
                  {msg.content}
                </div>
              ) : (
                <div className="text-sm text-slate-200 prose prose-invert prose-sm max-w-none">
                  {msg.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  ) : col.isStreaming ? (
                    <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse rounded-sm" />
                  ) : null}
                </div>
              )}
            </div>
          ))
        )}
        {col.error && (
          <p className="text-red-400 text-xs">⚠️ {col.error}</p>
        )}
      </div>

      {/* Footer: latency + tokens + continue button (shown after latest assistant turn) */}
      {canContinue && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-slate-700 bg-slate-900 flex-shrink-0">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {latencyMs !== null && <span>{(latencyMs / 1000).toFixed(1)}s</span>}
            {latestUsage && (
              <span>
                {latestUsage.inputTokens.toLocaleString()} in · {latestUsage.outputTokens.toLocaleString()} out
              </span>
            )}
          </div>
          <button
            onClick={() => onContinue(col)}
            className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            Continue with this model →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main CompareArea component ───────────────────────────────────────────────

export default function CompareArea() {
  const { setCompareMode } = useUiStore();
  const {
    columns,
    anyStreaming,
    sendToAll,
    abortAll,
    clearAll,
    updateColumn,
    addColumn,
    removeColumn,
    continueWith,
  } = useCompare();

  const isMac = navigator.userAgent.includes('Mac OS X');
  const { sidebarOpen } = useUiStore();
  const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
  const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-900 overflow-hidden">
      {/* Header bar */}
      <header
        style={dragStyle}
        className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-700 bg-slate-900 flex-shrink-0${!sidebarOpen && isMac ? ' pl-[80px]' : ''}`}
      >
        <span style={noDragStyle} className="text-sm font-semibold text-slate-200">
          Compare Models
        </span>
        <span className="text-xs text-slate-500">{columns.length} columns</span>

        <div className="flex-1" />

        {columns.length < 4 && (
          <button
            style={noDragStyle}
            onClick={addColumn}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add column
          </button>
        )}

        <button
          style={noDragStyle}
          onClick={() => setCompareMode(false)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
        >
          ← Back to chat
        </button>
      </header>

      {/* Columns */}
      <div className="flex-1 flex overflow-hidden">
        {columns.map((col) => (
          <ColumnView
            key={col.id}
            col={col}
            canRemove={columns.length > 2}
            onUpdate={updateColumn}
            onRemove={removeColumn}
            onContinue={continueWith}
          />
        ))}
      </div>

      {/* Shared input bar */}
      <InputBar
        onSend={sendToAll}
        onAbort={abortAll}
        onClear={clearAll}
        isStreaming={anyStreaming}
        conversationId={null}
      />
    </div>
  );
}
