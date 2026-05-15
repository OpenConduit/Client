import React, { useRef } from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { exportAsJson, exportAsMarkdown, downloadFile } from '../lib/export';

export default function Sidebar() {
  const { conversations, addConversation, deleteConversation } = useConversationStore();
  const { settings } = useSettingsStore();
  const { activeConversationId, setActiveConversation, sidebarOpen, setShowSettings } = useUiStore();

  const handleNew = () => {
    const conv = addConversation({
      providerId: settings?.defaultProviderId,
      model: settings?.defaultModel,
    });
    setActiveConversation(conv.id);
  };

  const handleExport = (e: React.MouseEvent, id: string, format: 'json' | 'md') => {
    e.stopPropagation();
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    if (format === 'json') {
      downloadFile(exportAsJson(conv), `${conv.title}.json`, 'application/json');
    } else {
      downloadFile(exportAsMarkdown(conv), `${conv.title}.md`, 'text/markdown');
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this conversation?')) {
      deleteConversation(id);
      if (activeConversationId === id) setActiveConversation(null);
    }
  };

  if (!sidebarOpen) return null;

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-800 flex flex-col border-r border-slate-700">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 pt-8">
        <button
          onClick={handleNew}
          className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 && (
          <p className="text-slate-500 text-xs text-center px-4 py-6">No conversations yet</p>
        )}
        {conversations.map((conv) => (
          <ConversationItem
            key={conv.id}
            id={conv.id}
            title={conv.title}
            active={conv.id === activeConversationId}
            updatedAt={conv.updatedAt}
            onClick={() => setActiveConversation(conv.id)}
            onDelete={(e) => handleDelete(e, conv.id)}
            onExportJson={(e) => handleExport(e, conv.id, 'json')}
            onExportMd={(e) => handleExport(e, conv.id, 'md')}
          />
        ))}
      </div>

      {/* Bottom actions */}
      <div className="p-3 border-t border-slate-700">
        <button
          onClick={() => setShowSettings(true)}
          className="w-full flex items-center gap-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg px-3 py-2 text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Settings
        </button>
      </div>
    </aside>
  );
}

interface ConversationItemProps {
  id: string;
  title: string;
  active: boolean;
  updatedAt: number;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onExportJson: (e: React.MouseEvent) => void;
  onExportMd: (e: React.MouseEvent) => void;
}

function ConversationItem({
  title,
  active,
  updatedAt,
  onClick,
  onDelete,
  onExportJson,
  onExportMd,
}: ConversationItemProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const date = new Date(updatedAt);
  const label =
    Date.now() - updatedAt < 86_400_000
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center px-3 py-2 mx-2 rounded-lg cursor-pointer text-sm transition-colors ${
        active
          ? 'bg-slate-700 text-slate-100'
          : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="truncate">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>

      {/* Context menu trigger */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-all ml-1"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <div
          ref={menuRef}
          onBlur={() => setMenuOpen(false)}
          className="absolute right-0 top-8 z-50 bg-slate-700 rounded-lg shadow-xl border border-slate-600 py-1 min-w-[140px]"
        >
          {[
            { label: 'Export JSON', action: onExportJson },
            { label: 'Export Markdown', action: onExportMd },
            { label: 'Delete', action: onDelete, danger: true },
          ].map(({ label, action, danger }) => (
            <button
              key={label}
              onClick={(e) => {
                setMenuOpen(false);
                action(e);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-600 transition-colors ${
                danger ? 'text-red-400 hover:text-red-300' : 'text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
