import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
export default function ParameterControls({ conversationId, defaultParams }) {
    const { conversations, updateConversation } = useConversationStore();
    const { showParameters, setShowParameters } = useUiStore();
    const conv = conversations.find((c) => c.id === conversationId);
    const params = conv?.parameters ?? defaultParams;
    const update = (key, value) => {
        updateConversation(conversationId, {
            parameters: { ...params, [key]: value },
        });
    };
    const reset = () => {
        updateConversation(conversationId, { parameters: undefined });
    };
    return (_jsxs("div", { className: "border-t border-slate-700 flex-shrink-0", children: [_jsxs("button", { onClick: () => setShowParameters(!showParameters), className: "w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors", children: [_jsx("svg", { className: `w-3 h-3 transition-transform ${showParameters ? 'rotate-90' : ''}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) }), "Model Parameters", conv?.parameters && (_jsx("span", { className: "ml-auto text-blue-400 text-[10px]", children: "custom" }))] }), showParameters && (_jsxs("div", { className: "px-4 pb-3 space-y-3", children: [_jsx(Slider, { label: "Temperature", value: params.temperature ?? 0.7, min: 0, max: 2, step: 0.01, onChange: (v) => update('temperature', v), format: (v) => v.toFixed(2) }), _jsx(Slider, { label: "Top P", value: params.topP ?? 1, min: 0, max: 1, step: 0.01, onChange: (v) => update('topP', v), format: (v) => v.toFixed(2) }), _jsx(NumberInput, { label: "Max Tokens", value: params.maxTokens ?? 4096, min: 1, max: 200000, onChange: (v) => update('maxTokens', v) }), _jsx(NumberInput, { label: "Frequency Penalty", value: params.frequencyPenalty ?? 0, min: -2, max: 2, step: 0.1, onChange: (v) => update('frequencyPenalty', v) }), _jsx(NumberInput, { label: "Presence Penalty", value: params.presencePenalty ?? 0, min: -2, max: 2, step: 0.1, onChange: (v) => update('presencePenalty', v) }), _jsx("button", { onClick: reset, className: "text-[10px] text-slate-500 hover:text-slate-300 underline transition-colors", children: "Reset to defaults" })] }))] }));
}
function Slider({ label, value, min, max, step = 0.01, onChange, format = (v) => String(v), }) {
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between mb-1", children: [_jsx("label", { className: "text-[11px] text-slate-400", children: label }), _jsx("span", { className: "text-[11px] text-slate-300 font-mono", children: format(value) })] }), _jsx("input", { type: "range", min: min, max: max, step: step, value: value, onChange: (e) => onChange(parseFloat(e.target.value)), className: "w-full accent-blue-500 h-1.5 cursor-pointer" })] }));
}
function NumberInput({ label, value, min, max, step = 1, onChange, }) {
    return (_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("label", { className: "text-[11px] text-slate-400", children: label }), _jsx("input", { type: "number", min: min, max: max, step: step, value: value, onChange: (e) => onChange(parseFloat(e.target.value)), className: "w-24 bg-slate-800 border border-slate-600 focus:border-blue-500 rounded px-2 py-0.5 text-xs text-slate-200 outline-none text-right" })] }));
}
//# sourceMappingURL=ParameterControls.js.map