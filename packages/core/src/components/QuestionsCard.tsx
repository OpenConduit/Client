import React, { useState } from 'react';
import type { AiQuestion } from '../types';

interface Props {
  questions: AiQuestion[];
  onSubmit: (answers: Record<string, string>) => void;
}

/** Single question input — free text, single-select, or multi-select */
function QuestionInput({
  q,
  value,
  onChange,
  onEnter,
}: {
  q: AiQuestion;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
}) {
  const [otherText, setOtherText] = useState('');

  // ── Multi-select ────────────────────────────────────────────────────────
  if (q.options && q.multiSelect) {
    const selected = value ? value.split('|||') : [];

    const toggle = (opt: string) => {
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
      if (hasOther) setOtherText('');
    };

    const hasOther = selected.includes('__other__');

    // Rebuild final value when otherText changes
    const finalValue = selected
      .map((s) => (s === '__other__' ? otherText.trim() : s))
      .filter(Boolean)
      .join(', ');
    // Keep internal state consistent
    void finalValue; // used via onSubmit path below — callers read `value` directly

    return (
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5">
          {q.options.map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500/60'
                }`}
              >
                {active && <span className="mr-1">✓</span>}
                {opt}
              </button>
            );
          })}
          {q.allowOther && (
            <button
              type="button"
              onClick={toggleOther}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                hasOther
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500/60'
              }`}
            >
              {hasOther && <span className="mr-1">✓</span>}
              Other…
            </button>
          )}
        </div>
        {hasOther && (
          <input
            autoFocus
            type="text"
            value={otherText}
            onChange={(e) => {
              setOtherText(e.target.value);
              // Patch the "other" entry into the parent value
              const withOther = selected
                .map((s) => (s === '__other__' ? e.target.value.trim() : s))
                .filter(Boolean)
                .join('|||');
              onChange(withOther);
            }}
            placeholder="Describe…"
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        )}
      </div>
    );
  }

  // ── Single-select ────────────────────────────────────────────────────────
  if (q.options && !q.multiSelect) {
    const isOther = value === '__other__' || (value && !q.options.includes(value));

    return (
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-1.5">
          {q.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                value === opt
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500/60'
              }`}
            >
              {opt}
            </button>
          ))}
          {q.allowOther && (
            <button
              type="button"
              onClick={() => onChange('__other__')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                isOther
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-blue-500/60'
              }`}
            >
              Other…
            </button>
          )}
        </div>
        {isOther && (
          <input
            autoFocus
            type="text"
            value={value === '__other__' ? '' : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Describe…"
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        )}
      </div>
    );
  }

  // ── Free text ────────────────────────────────────────────────────────────
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
      placeholder="Your answer…"
      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
    />
  );
}

export default function QuestionsCard({ questions, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(
    () => Object.fromEntries(questions.map((q) => [q.id, ''])),
  );
  const [submitted, setSubmitted] = useState(false);

  if (submitted) return null;

  const allAnswered = questions.every((q) => {
    const v = answers[q.id] ?? '';
    if (!v.trim()) return false;
    // For multi-select, "|||" segments stripped → must have real text
    if (q.multiSelect) return v.split('|||').some((s) => s.trim());
    // For single-select with Other, must have typed something
    if (q.options && q.allowOther && v === '__other__') return false;
    return true;
  });

  function handleSubmit() {
    if (!allAnswered) return;
    // Flatten multi-select "|||"-joined values to comma-separated for readability
    const flat: Record<string, string> = {};
    for (const q of questions) {
      const raw = answers[q.id] ?? '';
      flat[q.id] = q.multiSelect
        ? raw.split('|||').filter(Boolean).join(', ')
        : raw;
    }
    setSubmitted(true);
    onSubmit(flat);
  }

  return (
    <div className="mt-2 rounded-xl border border-blue-500/30 bg-blue-950/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-500/20 bg-blue-900/10">
        <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-xs font-medium text-blue-300">
          The AI has {questions.length} question{questions.length !== 1 ? 's' : ''} before continuing
        </span>
      </div>

      {/* Questions */}
      <div className="px-3 py-2.5 space-y-3">
        {questions.map((q, i) => (
          <div key={q.id}>
            <label className="flex items-baseline gap-1 text-xs text-slate-300 mb-1.5">
              <span className="text-slate-500 shrink-0">{i + 1}.</span>
              <span>{q.question}</span>
              {q.multiSelect && (
                <span className="ml-1 text-[10px] text-blue-400/70 font-normal">(select all that apply)</span>
              )}
            </label>
            <QuestionInput
              q={q}
              value={answers[q.id] ?? ''}
              onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
              onEnter={i === questions.length - 1 ? handleSubmit : undefined}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-blue-500/20 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            allAnswered
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          Send Answers
        </button>
      </div>
    </div>
  );
}
