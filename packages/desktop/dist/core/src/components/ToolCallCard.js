import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
/** Summarise input args as a compact "(key: val, …)" string for the collapsed pill */
function argSummary(input) {
    const entries = Object.entries(input);
    if (entries.length === 0)
        return '()';
    const parts = entries.slice(0, 2).map(([k, v]) => {
        const val = typeof v === 'string' ? (v.length > 30 ? v.slice(0, 30) + '…' : v) : JSON.stringify(v);
        return `${k}: ${val}`;
    });
    const suffix = entries.length > 2 ? `, +${entries.length - 2}` : '';
    return `(${parts.join(', ')}${suffix})`;
}
export default function ToolCallCard({ toolCall, onApprove, onDeny }) {
    const isPending = !!toolCall.pending;
    const isDenied = toolCall.approved === false;
    const isError = toolCall.isError;
    // Pending calls start open so Approve/Deny are immediately visible;
    // completed calls start collapsed.
    const [open, setOpen] = useState(isPending);
    // Colour scheme derived from state
    const accent = isPending
        ? { pill: 'border-amber-500/60 bg-amber-950/30 text-amber-300 hover:border-amber-400/80', chevron: 'text-amber-400', detail: 'border-amber-500/30' }
        : isDenied
            ? { pill: 'border-slate-600 bg-slate-800/40 text-slate-400 hover:border-slate-500', chevron: 'text-slate-500', detail: 'border-slate-700/50' }
            : isError
                ? { pill: 'border-red-500/50 bg-red-950/20 text-red-300 hover:border-red-400/70', chevron: 'text-red-400', detail: 'border-red-500/30' }
                : { pill: 'border-green-500/30 bg-green-950/10 text-green-300 hover:border-green-400/50', chevron: 'text-green-400', detail: 'border-green-500/20' };
    return (_jsxs("div", { className: `rounded-md border font-mono text-xs my-1.5 overflow-hidden transition-colors ${accent.pill}`, children: [_jsxs("div", { className: "flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer select-none", onClick: () => !isPending && setOpen((o) => !o), role: isPending ? undefined : 'button', "aria-expanded": open, children: [_jsx(StatusIcon, { pending: isPending, denied: isDenied, error: isError }), _jsx("span", { className: "font-semibold", children: toolCall.name }), !open && (_jsx("span", { className: "text-slate-500 truncate max-w-[320px]", children: argSummary(toolCall.input) })), toolCall.serverId && (_jsxs("span", { className: "ml-auto text-slate-600 text-[10px] shrink-0", children: ["@", toolCall.serverId.slice(0, 12)] })), isPending && onApprove && onDeny && (_jsxs("div", { className: "flex gap-1.5 ml-2 shrink-0", children: [_jsx("button", { onClick: (e) => { e.stopPropagation(); onApprove(toolCall.id); }, className: "px-2 py-0.5 rounded bg-green-700 hover:bg-green-600 text-white text-xs transition-colors", children: "Allow" }), _jsx("button", { onClick: (e) => { e.stopPropagation(); onDeny(toolCall.id); }, className: "px-2 py-0.5 rounded bg-red-800 hover:bg-red-700 text-white text-xs transition-colors", children: "Deny" })] })), !isPending && (_jsx("svg", { className: `w-3 h-3 shrink-0 ml-1 transition-transform duration-150 ${accent.chevron} ${open ? 'rotate-90' : ''}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) }))] }), open && (_jsxs("div", { className: `border-t ${accent.detail}`, children: [_jsxs("div", { className: "px-3 py-2", children: [_jsx("p", { className: "text-slate-600 mb-1 text-[9px] uppercase tracking-widest", children: "Input" }), _jsx("pre", { className: "text-slate-300 whitespace-pre-wrap break-all text-[11px] leading-relaxed", children: JSON.stringify(toolCall.input, null, 2) })] }), !isPending && toolCall.result !== undefined && (_jsxs("div", { className: `px-3 py-2 border-t ${accent.detail}`, children: [_jsx("p", { className: "text-slate-600 mb-1 text-[9px] uppercase tracking-widest", children: "Result" }), _jsx("pre", { className: `whitespace-pre-wrap break-all text-[11px] leading-relaxed ${isError ? 'text-red-300' : 'text-slate-300'}`, children: typeof toolCall.result === 'string'
                                    ? toolCall.result
                                    : JSON.stringify(toolCall.result, null, 2) })] }))] }))] }));
}
function StatusIcon({ pending, denied, error }) {
    if (pending)
        return _jsx("span", { className: "inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" });
    if (denied)
        return (_jsx("svg", { className: "w-3 h-3 shrink-0 text-slate-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }));
    if (error)
        return (_jsx("svg", { className: "w-3 h-3 shrink-0 text-red-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }));
    return (_jsx("svg", { className: "w-3 h-3 shrink-0 text-green-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }));
}
//# sourceMappingURL=ToolCallCard.js.map