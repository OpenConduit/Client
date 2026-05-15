import React, { useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsPanel from './components/SettingsPanel';
import { useSettingsStore } from './stores/settingsStore';
import { useUiStore } from './stores/uiStore';
import { useConversationStore } from './stores/conversationStore';

export default function App() {
  const { loadSettings, settings } = useSettingsStore();
  const { activeConversationId, setActiveConversation, setShowSettings } = useUiStore();
  const { conversations, addConversation } = useConversationStore();

  // Bootstrap: load settings from main process
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Apply theme class to <html>
  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    const theme = settings.theme;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  }, [settings?.theme]);

  // If no active conversation but conversations exist, select the latest
  useEffect(() => {
    if (!activeConversationId && conversations.length > 0) {
      setActiveConversation(conversations[0].id);
    }
  }, [conversations.length, activeConversationId, setActiveConversation]);

  // Open settings on first launch (no providers configured)
  useEffect(() => {
    if (settings && settings.providers.length === 0) {
      setShowSettings(true);
    }
  }, [settings?.providers.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        if (settings) {
          const conv = addConversation({
            providerId: settings.defaultProviderId,
            model: settings.defaultModel,
          });
          setActiveConversation(conv.id);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [settings, addConversation, setActiveConversation, setShowSettings]);

  if (!settings) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-slate-900 text-slate-100 overflow-hidden">
      <Sidebar />
      <ChatArea conversationId={activeConversationId} />
      <SettingsPanel />
    </div>
  );
}
