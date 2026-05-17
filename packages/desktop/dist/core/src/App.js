import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import CompareArea from './components/CompareArea';
import SettingsPanel from './components/SettingsPanel';
import { useSettingsStore } from './stores/settingsStore';
import { useUiStore } from './stores/uiStore';
import { useConversationStore } from './stores/conversationStore';
export default function App() {
    const { loadSettings, settings } = useSettingsStore();
    const { activeConversationId, setActiveConversation, setShowSettings, isCompareMode } = useUiStore();
    const { conversations, addConversation } = useConversationStore();
    // Bootstrap: load settings from main process
    useEffect(() => {
        loadSettings();
    }, [loadSettings]);
    // Apply theme class to <html>
    useEffect(() => {
        if (!settings)
            return;
        const root = document.documentElement;
        const theme = settings.theme;
        if (theme === 'dark') {
            root.classList.add('dark');
            return;
        }
        else if (theme === 'light') {
            root.classList.remove('dark');
            return;
        }
        // system — apply immediately and watch for OS preference changes
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = (e) => {
            root.classList.toggle('dark', e.matches);
        };
        apply(mq);
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings?.theme]);
    // If no active conversation but conversations exist, select the latest
    useEffect(() => {
        if (!activeConversationId && conversations.length > 0) {
            setActiveConversation(conversations[0].id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversations.length, activeConversationId, setActiveConversation]);
    // Open settings on first launch (no providers configured)
    useEffect(() => {
        if (settings && settings.providers.length === 0) {
            setShowSettings(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings?.providers.length]);
    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e) => {
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
        return (_jsx("div", { className: "h-full flex items-center justify-center bg-slate-900", children: _jsxs("div", { className: "flex flex-col items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" }), _jsx("p", { className: "text-slate-400 text-sm", children: "Loading\u2026" })] }) }));
    }
    return (_jsxs("div", { className: "h-full flex bg-slate-900 text-slate-100 overflow-hidden", children: [_jsx(Sidebar, {}), isCompareMode ? (_jsx(CompareArea, {})) : (_jsx(ChatArea, { conversationId: activeConversationId })), _jsx(SettingsPanel, {})] }));
}
//# sourceMappingURL=App.js.map