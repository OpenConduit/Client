import { useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { ChatRequest, Message, StreamChunk, StreamEnd, StreamError, ToolApprovalRequest, Attachment, AiTask, AiQuestion, AppSettings } from '../types';
import { hookRegistry } from './hookRegistry';
import { useConversationStore } from '../stores/conversationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { useTasksStore } from '../stores/tasksStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import { getContextLimit, estimateTokens } from '../utils/context';
import { service } from '../services';

// ─── Task + Question parsing ──────────────────────────────────────────────────

const AI_TASKS_RE = /<ai-tasks>([/\S\s]*?)<\/ai-tasks>/;
const AI_QUESTIONS_RE = /<ai-questions>([/\S\s]*?)<\/ai-questions>/;

const TASK_TRACKING_PROMPT = `
When working on multi-step tasks, maintain a running task list by including the following block at the end of your response whenever your task list changes:

<ai-tasks>[{"id":"1","text":"task description","status":"pending"},{"id":"2","text":"another task","status":"in-progress"},{"id":"3","text":"finished task","status":"done"}]</ai-tasks>

Valid status values: "pending", "in-progress", "done", "cancelled". Always include ALL tasks in every update (not just changed ones). Omit this block entirely if no multi-step task tracking is relevant for the current response.`.trim();

const CLARIFYING_QUESTIONS_PROMPT = `
When you receive a complex or ambiguous request where clarifying information would meaningfully change your response, you MUST ask your questions using the structured block below — never as plain conversational text.

RULES:
- Output ONLY the <ai-questions> block when asking questions. Do not write any other text.
- NEVER ask questions as regular prose. The ONLY valid way is the <ai-questions> block.
- Only use this when genuinely necessary. For simple requests, make assumptions and proceed.
- Maximum 3 questions per response.

QUESTION TYPES (use the right type for each question):

1. Free text (no options field):
   {"id":"1","question":"What should the function be named?"}

2. Single-select (options array, no multiSelect):
   {"id":"2","question":"Which language?","options":["TypeScript","Python","Rust"]}

3. Single-select with fallback (allowOther lets user type a custom answer):
   {"id":"3","question":"Which framework?","options":["React","Vue","Svelte"],"allowOther":true}

4. Multi-select (user can pick several):
   {"id":"4","question":"Which features do you need?","options":["Auth","Database","File upload"],"multiSelect":true}

5. Multi-select with fallback:
   {"id":"5","question":"Target platforms?","options":["Web","iOS","Android"],"multiSelect":true,"allowOther":true}

FORMAT (emit exactly this, as your entire response):
<ai-questions>[...your questions here...]</ai-questions>

The user will see a structured form. Their answers will be sent back to you so you can proceed.`.trim();

function parseAndStripTasks(content: string): { content: string; tasks: AiTask[] | null } {
  const match = content.match(AI_TASKS_RE);
  if (!match) return { content, tasks: null };
  try {
    const tasks = JSON.parse(match[1].trim()) as AiTask[];
    const stripped = content.replace(match[0], '').trim();
    return { content: stripped, tasks };
  } catch {
    return { content, tasks: null };
  }
}

function parseAndStripQuestions(content: string): { content: string; questions: AiQuestion[] | null } {
  const match = content.match(AI_QUESTIONS_RE);
  if (!match) return { content, questions: null };
  try {
    const questions = JSON.parse(match[1].trim()) as AiQuestion[];
    const stripped = content.replace(match[0], '').trim();
    return { content: stripped, questions };
  } catch {
    return { content, questions: null };
  }
}

/** Compose the final system prompt from the conversation prompt + all enabled augmentations */
function buildSystemPrompt(basePrompt: string | undefined, settings: AppSettings): string | undefined {
  const parts: string[] = [];

  if (basePrompt?.trim()) parts.push(basePrompt.trim());

  // Labs: AI task tracking
  if (settings.labs?.aiTaskTracking) {
    parts.push(TASK_TRACKING_PROMPT);
  }

  // Labs: AI clarifying questions
  if (settings.labs?.aiClarifyingQuestions) {
    parts.push(CLARIFYING_QUESTIONS_PROMPT);
  }

  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

let listenersRegistered = false;

// messageIds of in-flight compact/summarize requests — handled differently in onEnd
const compactingRequests = new Set<string>();

/** Register global IPC streaming listeners. Safe to call multiple times — the
 *  preload uses removeAllListeners before re-registering each channel, so HMR
 *  re-runs won't accumulate duplicate handlers. */
function ensureListeners() {
  if (listenersRegistered) return;
  listenersRegistered = true;

  service.chat.onChunk((chunk: StreamChunk) => {
    useConversationStore.getState().appendToMessage(chunk.conversationId, chunk.messageId, chunk.delta);
    hookRegistry.runOnStreamChunk(chunk);
  });

  service.chat.onEnd((end: StreamEnd) => {
    const { finalizeMessage, updateMessage, replaceMessages } = useConversationStore.getState();

    // ── Compact request: replace all messages with the summary ──────────────
    if (compactingRequests.has(end.messageId)) {
      compactingRequests.delete(end.messageId);
      finalizeMessage(end.conversationId, end.messageId, []);
      const conv = useConversationStore.getState().conversations.find((c) => c.id === end.conversationId);
      const summaryContent = conv?.messages.find((m) => m.id === end.messageId)?.content ?? '';
      replaceMessages(end.conversationId, [{
        id: uuidv4(),
        role: 'assistant',
        content: `📋 **Conversation Summary**\n\n${summaryContent}`,
        timestamp: Date.now(),
      }]);
      useUiStore.getState().setIsCompacting(false);
      useUiStore.getState().setIsStreaming(false);
      return;
    }
    // ────────────────────────────────────────────────────────────────────────
    finalizeMessage(end.conversationId, end.messageId, end.toolCalls ?? []);

    // Record token usage for analytics
    if (end.usage) {
      const settings = useSettingsStore.getState().settings;
      const conv = useConversationStore.getState().conversations.find((c) => c.id === end.conversationId);
      if (conv) {
        // Store usage on the message itself for per-message display
        updateMessage(end.conversationId, end.messageId, { usage: end.usage });
        useAnalyticsStore.getState().addRecord(
          {
            conversationId: end.conversationId,
            providerId: conv.providerId ?? '',
            model: conv.model ?? '',
            usage: end.usage,
          },
          settings?.modelPricing,
        );
      }
    }

    // Parse & strip <ai-tasks> if labs feature is on
    const taskTrackingEnabled = useSettingsStore.getState().settings?.labs?.aiTaskTracking;
    if (taskTrackingEnabled) {
      const conv = useConversationStore.getState().conversations.find((c) => c.id === end.conversationId);
      const msg = conv?.messages.find((m) => m.id === end.messageId);
      if (msg) {
        const { content, tasks } = parseAndStripTasks(msg.content);
        if (tasks) {
          updateMessage(end.conversationId, end.messageId, { content });
          useTasksStore.getState().setTasks(tasks, end.conversationId);
        }
      }
    }

    // Parse & strip <ai-questions> if labs feature is on
    const clarifyEnabled = useSettingsStore.getState().settings?.labs?.aiClarifyingQuestions;
    if (clarifyEnabled) {
      const conv = useConversationStore.getState().conversations.find((c) => c.id === end.conversationId);
      const msg = conv?.messages.find((m) => m.id === end.messageId);
      if (msg) {
        const { content, questions } = parseAndStripQuestions(msg.content);
        if (questions?.length) {
          updateMessage(end.conversationId, end.messageId, { content, aiQuestions: questions });
        }
      }
    }

    // Run onResponse hooks with the finalized message
    const conv2 = useConversationStore.getState().conversations.find((c) => c.id === end.conversationId);
    const msg2 = conv2?.messages.find((m) => m.id === end.messageId);
    if (msg2) hookRegistry.runOnResponse(msg2);
    useUiStore.getState().setIsStreaming(false);
  });

  // Pending tool calls: sent BEFORE approval is requested so the Approve/Deny
  // buttons are visible. Update the message in-place so user can respond.
  service.chat.onToolPending((data) => {
    useConversationStore.getState().updateMessage(data.conversationId, data.messageId, {
      isStreaming: false,
      toolCalls: data.toolCalls,
    });
    useUiStore.getState().setIsStreaming(false);
  });

  service.chat.onThinkingChunk((data) => {
    useConversationStore.getState().appendThinkingToMessage(data.conversationId, data.messageId, data.delta);
  });

  service.chat.onError((err: StreamError) => {
    // Clean up compact state if the errored request was a summarize call
    if (compactingRequests.has(err.messageId)) {
      compactingRequests.delete(err.messageId);
      useUiStore.getState().setIsCompacting(false);
    }
    useConversationStore.getState().updateMessage(err.conversationId, err.messageId, {
      content: `⚠️ ${err.error}`,
      isStreaming: false,
    });
    useUiStore.getState().setIsStreaming(false);
  });

  service.tools.onApprovalRequest((req: ToolApprovalRequest) => {
    useUiStore.getState().addPendingApproval(req);
  });
}

export function useChat() {
  const { conversations, addMessage, updateConversation, replaceMessages } = useConversationStore();
  const { settings } = useSettingsStore();
  const {
    activeConversationId,
    isStreaming,
    setIsStreaming,
    isCompacting,
    pendingApprovals,
    removePendingApproval,
  } = useUiStore();

  useEffect(() => {
    ensureListeners();
  }, []);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;

  const sendMessage = useCallback(
    async (content: string, attachments?: Attachment[]) => {
      if (!activeConversationId || !settings || isStreaming) return;

      const conv = useConversationStore
        .getState()
        .conversations.find((c) => c.id === activeConversationId);
      if (!conv) return;

      const providerId = conv.providerId ?? settings.defaultProviderId;
      const model = conv.model ?? settings.defaultModel;
      if (!providerId || !model) {
        alert('Please select a provider and model in the top bar before chatting.');
        return;
      }

      // Add user message
      const userMsg: Message = {
        id: uuidv4(),
        role: 'user',
        content,
        attachments,
        timestamp: Date.now(),
      };
      addMessage(activeConversationId, userMsg);

      // Auto-title from first user message
      if (conv.messages.length === 0) {
        const title = content.slice(0, 60) + (content.length > 60 ? '…' : '');
        updateConversation(activeConversationId, { title });
      }

      // Build request from latest state
      const freshConv = useConversationStore
        .getState()
        .conversations.find((c) => c.id === activeConversationId)!;

      let request: ChatRequest = {
        conversationId: activeConversationId,
        messages: freshConv.messages,
        providerId,
        model,
        parameters: conv.parameters ?? settings.defaultParameters,
        systemPrompt: buildSystemPrompt(conv.systemPrompt, settings),
        enabledMcpServerIds:
          freshConv.activeMcpServerIds ??
          settings.mcpServers.filter((s) => s.enabled).map((s) => s.id),
      };

      // Run beforeSend hooks
      request = await hookRegistry.runBeforeSend(request);

      setIsStreaming(true);

      const { messageId } = await service.chat.send(request);

      // Add placeholder assistant message
      addMessage(activeConversationId, {
        id: messageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        timestamp: Date.now(),
        model,
        providerId,
      });
    },
    [activeConversationId, settings, isStreaming, addMessage, updateConversation, setIsStreaming],
  );

  const abortStream = useCallback(() => {
    if (activeConversationId) {
      service.chat.abort(activeConversationId);
      useUiStore.getState().setIsStreaming(false);
    }
  }, [activeConversationId]);

  /** Summarize the conversation and replace all messages with the summary. */
  const compactContext = useCallback(async () => {
    if (!activeConversationId || !settings || isStreaming || isCompacting) return;
    const conv = useConversationStore.getState().conversations.find((c) => c.id === activeConversationId);
    if (!conv || conv.messages.length < 2) return;

    const providerId = conv.providerId ?? settings.defaultProviderId;
    const model = conv.model ?? settings.defaultModel;
    if (!providerId || !model) return;

    useUiStore.getState().setIsCompacting(true);
    setIsStreaming(true);

    // Sanitize messages: drop tool_result rows and any message with empty/null
    // content — OpenAI rejects null content values.
    const safeMessages = conv.messages
      .filter((m) => m.role !== 'tool_result' && typeof m.content === 'string' && m.content.trim().length > 0)
      .map((m) => ({ ...m, content: m.content ?? '' }));

    if (safeMessages.length === 0) {
      useUiStore.getState().setIsCompacting(false);
      setIsStreaming(false);
      return;
    }

    const request: ChatRequest = {
      conversationId: activeConversationId,
      messages: [
        ...safeMessages,
        {
          id: uuidv4(),
          role: 'user',
          content: 'Please write a concise but complete summary of our conversation above. Capture all key context, decisions, code snippets, and details needed to continue this work seamlessly.',
          timestamp: Date.now(),
        },
      ],
      providerId,
      model,
      parameters: { temperature: 0.3, topP: 1, maxTokens: 2000 },
      systemPrompt: 'You are summarizing a conversation to preserve context. Be concise but complete.',
      enabledMcpServerIds: [],
    };

    try {
      const { messageId } = await service.chat.send(request);
      compactingRequests.add(messageId);
      addMessage(activeConversationId, {
        id: messageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        timestamp: Date.now(),
        model,
        providerId,
      });
    } catch {
      useUiStore.getState().setIsCompacting(false);
      setIsStreaming(false);
    }
  }, [activeConversationId, settings, isStreaming, isCompacting, addMessage, setIsStreaming]);

  /** Drop the oldest messages until context usage falls below 50% (or remove oldest 4 if no limit known). */
  const trimOldMessages = useCallback(() => {
    if (!activeConversationId) return;
    const conv = useConversationStore.getState().conversations.find((c) => c.id === activeConversationId);
    if (!conv || conv.messages.length <= 2) return;

    const providerId = conv.providerId ?? settings?.defaultProviderId ?? '';
    const model = conv.model ?? settings?.defaultModel ?? '';
    const providerCtx = settings?.providers?.find((p) => p.id === providerId)?.modelContextWindows?.[model] ?? null;
    const contextLimit = providerCtx ?? getContextLimit(model);

    let messages = [...conv.messages];

    if (contextLimit) {
      const target = contextLimit * 0.5;
      const totalEst = messages.reduce((s, m) => s + estimateTokens(m.content), 0);
      if (totalEst <= target) return; // nothing to do
      // Drop oldest pairs until under target, always keep ≥2 messages
      while (messages.reduce((s, m) => s + estimateTokens(m.content), 0) > target && messages.length > 2) {
        messages = messages.slice(2);
      }
    } else {
      // No known limit: drop oldest 4 messages, keep at least 2
      const toDrop = Math.min(4, messages.length - 2);
      messages = messages.slice(toDrop);
    }

    replaceMessages(activeConversationId, messages);
  }, [activeConversationId, settings, replaceMessages]);

  const approveToolCall = useCallback(
    (toolId: string, approved: boolean) => {
      service.tools.sendApproval({ toolId, approved });
      removePendingApproval(toolId);
    },
    [removePendingApproval],
  );

  /** Send answers to the AI's clarifying questions as a formatted user message */
  const sendAnswers = useCallback(
    (questions: AiQuestion[], answers: Record<string, string>) => {
      const formatted = questions
        .map((q, i) => `${i + 1}. ${q.question}\n   ${answers[q.id] ?? ''}`)
        .join('\n\n');
      sendMessage(`Here are my answers to your questions:\n\n${formatted}`);
    },
    [sendMessage],
  );

  return {
    conversation: activeConversation,
    isStreaming,
    isCompacting,
    pendingApprovals,
    sendMessage,
    abortStream,
    compactContext,
    trimOldMessages,
    approveToolCall,
    sendAnswers,
  };
}
