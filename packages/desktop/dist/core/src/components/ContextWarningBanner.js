import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAnalyticsStore } from '../stores/analyticsStore';
import { useConversationStore } from '../stores/conversationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { getContextLimit, fmtTok } from '../utils/context';
export default function ContextWarningBanner({ conversationId }) {
    const analyticsRecords = useAnalyticsStore((s) => s.records);
    const conversations = useConversationStore((s) => s.conversations);
    const { settings } = useSettingsStore();
    const isCompacting = useUiStore((s) => s.isCompacting);
    const conv = conversations.find((c) => c.id === conversationId);
    const model = conv?.model ?? '';
    const providerId = conv?.providerId ?? '';
    const providerCtx = settings?.providers?.find((p) => p.id === providerId)?.modelContextWindows?.[model] ?? null;
    const contextLimit = providerCtx ?? getContextLimit(model);
    const usedTokens = analyticsRecords
        .filter((r) => r.conversationId === conversationId)
        .reduce((s, r) => s + r.usage.inputTokens + r.usage.outputTokens, 0);
    const ctxPct = contextLimit && usedTokens > 0
        ? Math.min((usedTokens / contextLimit) * 100, 100)
        : null;
    // Only show at 70%+
    if (!ctxPct || ctxPct < 70)
        return null;
    const isCritical = ctxPct >= 90;
    return (_jsxs("div", { className: `mx-3 mb-2 px-3 py-2 rounded-lg border flex items-center gap-2 text-xs ${isCritical
            ? 'bg-red-950/50 border-red-700/60 text-red-300'
            : 'bg-amber-950/40 border-amber-700/50 text-amber-300'}`, children: [_jsx("span", { children: isCritical ? '🔴' : '🟡' }), _jsxs("span", { className: "flex-1", children: ["Context ", isCritical ? 'nearly full' : 'getting full', ' ', _jsxs("span", { className: "opacity-70", children: ["(", fmtTok(usedTokens), contextLimit ? `/${fmtTok(contextLimit)}` : '', " \u00B7 ", ctxPct.toFixed(0), "%)"] }), isCompacting ? ' — Summarizing…' : ' — click the context bar below to manage'] })] }));
}
//# sourceMappingURL=ContextWarningBanner.js.map