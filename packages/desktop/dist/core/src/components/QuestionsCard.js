import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
/** Single question input — free text, single-select, or multi-select */
function QuestionInput({ q, value, onChange, onEnter, }) {
    const [otherText, setOtherText] = useState('');
    // ── Multi-select ────────────────────────────────────────────────────────
    if (q.options && q.multiSelect) {
        const selected = value ? value.split('|||') : [];
        const toggle = (opt) => {
            const next = selected.includes(opt)
                ? selected.filter((s) => s !== opt)
                : [...selected, opt];
            onChange(next.join('|||'));
        };
        const toggleOther = () => {
            const MARKER = '__other__';
            const hasOther = selected.includes(MARKER);
            const next = hasOther ? selected.filter((s) => s !== MARKER) : [...selected, MARKER];
            onChange(next.join('|||'));
            if (hasOther)
                setOtherText('');
        };
        const hasOther = selected.includes('__other__');
        // Rebuild final value when otherText changes
        const finalValue = selected
            .map((s) => (s === '__other__' ? otherText.trim() : s))
            .filter(Boolean)
            .join(', ');
        // Keep internal state consistent
        void finalValue; // used via onSubmit path below — callers read `value` directly
        return (_jsxs("div", { className: "space-y-1.5", children: [_jsxs("div", { className: "flex flex-wrap gap-1.5", children: [q.options.map((opt) => {
                            const active = selected.includes(opt);
                            return (_jsxs("button", { type: "button", onClick: () => toggle(opt), className: `px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${active
                                    ? 'bg-blue-600 border-blue-500 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500/60'}`, children: [active && _jsx("span", { className: "mr-1", children: "\u2713" }), opt] }, opt));
                        }), q.allowOther && (_jsxs("button", { type: "button", onClick: toggleOther, className: `px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${hasOther
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500/60'}`, children: [hasOther && _jsx("span", { className: "mr-1", children: "\u2713" }), "Other\u2026"] }))] }), hasOther && (_jsx("input", { autoFocus: true, type: "text", value: otherText, onChange: (e) => {
                        setOtherText(e.target.value);
                        // Patch the "other" entry into the parent value
                        const withOther = selected
                            .map((s) => (s === '__other__' ? e.target.value.trim() : s))
                            .filter(Boolean)
                            .join('|||');
                        onChange(withOther);
                    }, placeholder: "Describe\u2026", className: "w-full rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" }))] }));
    }
    // ── Single-select ────────────────────────────────────────────────────────
    if (q.options && !q.multiSelect) {
        const isOther = value === '__other__' || (value && !q.options.includes(value));
        return (_jsxs("div", { className: "space-y-1.5", children: [_jsxs("div", { className: "flex flex-wrap gap-1.5", children: [q.options.map((opt) => (_jsx("button", { type: "button", onClick: () => onChange(opt), className: `px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${value === opt
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500/60'}`, children: opt }, opt))), q.allowOther && (_jsx("button", { type: "button", onClick: () => onChange('__other__'), className: `px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${isOther
                                ? 'bg-blue-600 border-blue-500 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500/60'}`, children: "Other\u2026" }))] }), isOther && (_jsx("input", { autoFocus: true, type: "text", value: value === '__other__' ? '' : value, onChange: (e) => onChange(e.target.value), placeholder: "Describe\u2026", className: "w-full rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" }))] }));
    }
    // ── Free text ────────────────────────────────────────────────────────────
    return (_jsx("input", { type: "text", value: value, onChange: (e) => onChange(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter')
            onEnter?.(); }, placeholder: "Your answer\u2026", className: "w-full rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" }));
}
export default function QuestionsCard({ questions, onSubmit }) {
    const [answers, setAnswers] = useState(() => Object.fromEntries(questions.map((q) => [q.id, ''])));
    const [submitted, setSubmitted] = useState(false);
    if (submitted)
        return null;
    const allAnswered = questions.every((q) => {
        const v = answers[q.id] ?? '';
        if (!v.trim())
            return false;
        // For multi-select, "|||" segments stripped → must have real text
        if (q.multiSelect)
            return v.split('|||').some((s) => s.trim());
        // For single-select with Other, must have typed something
        if (q.options && q.allowOther && v === '__other__')
            return false;
        return true;
    });
    function handleSubmit() {
        if (!allAnswered)
            return;
        // Flatten multi-select "|||"-joined values to comma-separated for readability
        const flat = {};
        for (const q of questions) {
            const raw = answers[q.id] ?? '';
            flat[q.id] = q.multiSelect
                ? raw.split('|||').filter(Boolean).join(', ')
                : raw;
        }
        setSubmitted(true);
        onSubmit(flat);
    }
    return (_jsxs("div", { className: "mt-2 rounded-xl border border-blue-500/30 bg-blue-950/20 overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 border-b border-blue-500/20 bg-blue-900/10", children: [_jsx("svg", { className: "w-3.5 h-3.5 text-blue-400 shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }), _jsxs("span", { className: "text-xs font-medium text-blue-300", children: ["The AI has ", questions.length, " question", questions.length !== 1 ? 's' : '', " before continuing"] })] }), _jsx("div", { className: "px-3 py-2.5 space-y-3", children: questions.map((q, i) => (_jsxs("div", { children: [_jsxs("label", { className: "flex items-baseline gap-1 text-xs text-slate-300 mb-1.5", children: [_jsxs("span", { className: "text-slate-500 shrink-0", children: [i + 1, "."] }), _jsx("span", { children: q.question }), q.multiSelect && (_jsx("span", { className: "ml-1 text-[10px] text-blue-400/70 font-normal", children: "(select all that apply)" }))] }), _jsx(QuestionInput, { q: q, value: answers[q.id] ?? '', onChange: (v) => setAnswers((prev) => ({ ...prev, [q.id]: v })), onEnter: i === questions.length - 1 ? handleSubmit : undefined })] }, q.id))) }), _jsx("div", { className: "px-3 py-2 border-t border-blue-500/20 flex justify-end", children: _jsx("button", { onClick: handleSubmit, disabled: !allAnswered, className: `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${allAnswered
                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`, children: "Send Answers" }) })] }));
}
//# sourceMappingURL=QuestionsCard.js.map