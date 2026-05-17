import React from 'react';
import TopBar from './TopBar';
import MessageList from './MessageList';
import InputBar from './InputBar';
import SystemPromptEditor from './SystemPromptEditor';
import ParameterControls from './ParameterControls';
import TasksPanel from './TasksPanel';
import FilesPanel from './FilesPanel';
import ContextWarningBanner from './ContextWarningBanner';
import { useChat } from '../hooks/useChat';
import { useSettingsStore } from '../stores/settingsStore';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';

interface Props {
  conversationId: string | null;
}

export default function ChatArea({ conversationId }: Props) {
  const { conversation, isStreaming, isCompacting, sendMessage, abortStream, approveToolCall, sendAnswers, compactContext, trimOldMessages } = useChat();
  const { settings } = useSettingsStore();
  const { clearMessages } = useConversationStore();
  const { activeConversationId } = useUiStore();

  const handleClear = () => {
    if (activeConversationId) clearMessages(activeConversationId);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-900 relative">
      <TopBar conversationId={conversationId} />

      {/* Floating AI task tracker (only visible when tasks exist + labs enabled) */}
      <TasksPanel />

      <MessageList
        messages={conversation?.messages ?? []}
        conversationId={conversationId ?? undefined}
        onApprove={(id) => approveToolCall(id, true)}
        onDeny={(id) => approveToolCall(id, false)}
        onSendAnswers={sendAnswers}
      />

      {conversationId && (
        <>
          <SystemPromptEditor conversationId={conversationId} />
          <ParameterControls
            conversationId={conversationId}
            defaultParams={settings?.defaultParameters ?? { temperature: 0.7, topP: 1, maxTokens: 4096 }}
          />
        </>
      )}

      {conversationId && (
        <ContextWarningBanner conversationId={conversationId} />
      )}

      <InputBar
        onSend={sendMessage}
        onAbort={abortStream}
        onClear={conversationId ? handleClear : undefined}
        onCompact={compactContext}
        onTrim={trimOldMessages}
        isStreaming={isStreaming}
        isCompacting={isCompacting}
        disabled={!conversationId}
        conversationId={conversationId}
      />

      {/* Files panel — slides in over the right side of chat */}
      <FilesPanel />
    </div>
  );
}
