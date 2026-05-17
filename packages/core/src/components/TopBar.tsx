import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
interface Props {
  conversationId: string | null;
}

const isMac = navigator.userAgent.includes('Mac OS X');

export default function TopBar({ conversationId }: Props) {
  const { conversations, updateConversation } = useConversationStore();
  const { settings, models, loadModels } = useSettingsStore();
  const { setSidebarOpen, sidebarOpen, setShowSettings, setCompareMode } = useUiStore();

  const conv = conversations.find((c) => c.id === conversationId);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const providerId = conv?.providerId ?? settings?.defaultProviderId ?? '';
  const modelList = models[providerId] ?? [];

  useEffect(() => {
    if (providerId && !models[providerId]) {
      loadModels(providerId);
    }
  }, [providerId, models, loadModels]);

  const handleProviderChange = (pid: string) => {
    if (!conversationId) return;
    const p = settings?.providers.find((pr) => pr.id === pid);
    updateConversation(conversationId, {
      providerId: pid,
      model: p?.defaultModel ?? '',
    });
    loadModels(pid);
  };

  const handleModelChange = (model: string) => {
    if (!conversationId) return;
    updateConversation(conversationId, { model });
  };

  const handleTitleSave = () => {
    if (conversationId && titleDraft.trim()) {
      updateConversation(conversationId, { title: titleDraft.trim() });
    }
    setEditingTitle(false);
  };

  const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties;
  const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

  return (
    <header style={dragStyle} className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-700 bg-slate-900 flex-shrink-0${!sidebarOpen && isMac ? ' pl-[80px]' : ''}`}>
      {/* Sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={noDragStyle}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
        title="Toggle sidebar"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Conversation title */}
      <div className="flex-1 min-w-0">
        {editingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSave();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
            style={noDragStyle}
            className="bg-slate-700 text-slate-100 rounded px-2 py-0.5 text-sm w-full max-w-xs outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setTitleDraft(conv?.title ?? '');
              setEditingTitle(true);
            }}
            style={noDragStyle}
            className="text-sm font-medium text-slate-300 hover:text-slate-100 truncate max-w-xs text-left transition-colors"
            title="Click to rename"
          >
            {conv?.title ?? 'OpenConduit'}
          </button>
        )}
      </div>

      {/* Provider selector */}
      {settings && conversationId && (
        <div className="flex items-center gap-2">
          <select
            value={providerId}
            onChange={(e) => handleProviderChange(e.target.value)}
            style={noDragStyle}
            className="bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">Provider…</option>
            {settings.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Model selector */}
          <select
            value={conv?.model ?? ''}
            onChange={(e) => handleModelChange(e.target.value)}
            style={noDragStyle}
            className="bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 cursor-pointer max-w-[200px]"
          >
            <option value="">Model…</option>
            {/* Show current model even if not in list */}
            {conv?.model && !modelList.includes(conv.model) && (
              <option value={conv.model}>{conv.model}</option>
            )}
            {modelList.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Compare button */}
      <button
        onClick={() => setCompareMode(true)}
        style={noDragStyle}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
        title="Compare models"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
        </svg>
      </button>

      {/* Settings button */}
      <button
        onClick={() => setShowSettings(true)}
        style={noDragStyle}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
        title="Settings"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </header>
  );
}
