import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import TopBar from './TopBar';
import MessageList from './MessageList';
import InputBar from './InputBar';
import SystemPromptEditor from './SystemPromptEditor';
import ParameterControls from './ParameterControls';
import TasksPanel from './TasksPanel';
import ContextWarningBanner from './ContextWarningBanner';
import { useChat } from '../hooks/useChat';
import { useSettingsStore } from '../stores/settingsStore';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
export default function ChatArea({ conversationId }) {
    const { conversation, isStreaming, isCompacting, sendMessage, abortStream, approveToolCall, sendAnswers, compactContext, trimOldMessages } = useChat();
    const { settings } = useSettingsStore();
    const { clearMessages } = useConversationStore();
    const { activeConversationId } = useUiStore();
    const handleClear = () => {
        if (activeConversationId)
            clearMessages(activeConversationId);
    };
    return (_jsxs("div", { className: "flex-1 flex flex-col min-w-0 bg-slate-900 relative", children: [_jsx(TopBar, { conversationId: conversationId }), _jsx(TasksPanel, {}), _jsx(MessageList, { messages: conversation?.messages ?? [], onApprove: (id) => approveToolCall(id, true), onDeny: (id) => approveToolCall(id, false), onSendAnswers: sendAnswers }), conversationId && (_jsxs(_Fragment, { children: [_jsx(SystemPromptEditor, { conversationId: conversationId }), _jsx(ParameterControls, { conversationId: conversationId, defaultParams: settings?.defaultParameters ?? { temperature: 0.7, topP: 1, maxTokens: 4096 } })] })), conversationId && (_jsx(ContextWarningBanner, { conversationId: conversationId })), _jsx(InputBar, { onSend: sendMessage, onAbort: abortStream, onClear: conversationId ? handleClear : undefined, onCompact: compactContext, onTrim: trimOldMessages, isStreaming: isStreaming, isCompacting: isCompacting, disabled: !conversationId, conversationId: conversationId })] }));
}
//# sourceMappingURL=ChatArea.js.map