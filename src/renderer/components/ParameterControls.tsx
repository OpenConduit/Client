import React from 'react';
import { useConversationStore } from '../stores/conversationStore';
import { useUiStore } from '../stores/uiStore';
import type { ModelParameters } from '../../shared/types';

interface Props {
  conversationId: string;
  defaultParams: ModelParameters;
}

export default function ParameterControls({ conversationId, defaultParams }: Props) {
  const { conversations, updateConversation } = useConversationStore();
  const { showParameters, setShowParameters } = useUiStore();
  const conv = conversations.find((c) => c.id === conversationId);
  const params: ModelParameters = conv?.parameters ?? defaultParams;

  const update = (key: keyof ModelParameters, value: number) => {
    updateConversation(conversationId, {
      parameters: { ...params, [key]: value },
    });
  };

  const reset = () => {
    updateConversation(conversationId, { parameters: undefined });
  };

  return (
    <div className="border-t border-slate-700 flex-shrink-0">
      <button
        onClick={() => setShowParameters(!showParameters)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${showParameters ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Model Parameters
        {conv?.parameters && (
          <span className="ml-auto text-blue-400 text-[10px]">custom</span>
        )}
      </button>

      {showParameters && (
        <div className="px-4 pb-3 space-y-3">
          <Slider
            label="Temperature"
            value={params.temperature ?? 0.7}
            min={0}
            max={2}
            step={0.01}
            onChange={(v) => update('temperature', v)}
            format={(v) => v.toFixed(2)}
          />
          <Slider
            label="Top P"
            value={params.topP ?? 1}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update('topP', v)}
            format={(v) => v.toFixed(2)}
          />
          <NumberInput
            label="Max Tokens"
            value={params.maxTokens ?? 4096}
            min={1}
            max={200000}
            onChange={(v) => update('maxTokens', v)}
          />
          <NumberInput
            label="Frequency Penalty"
            value={params.frequencyPenalty ?? 0}
            min={-2}
            max={2}
            step={0.1}
            onChange={(v) => update('frequencyPenalty', v)}
          />
          <NumberInput
            label="Presence Penalty"
            value={params.presencePenalty ?? 0}
            min={-2}
            max={2}
            step={0.1}
            onChange={(v) => update('presencePenalty', v)}
          />

          <button
            onClick={reset}
            className="text-[10px] text-slate-500 hover:text-slate-300 underline transition-colors"
          >
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format = (v) => String(v),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-[11px] text-slate-400">{label}</label>
        <span className="text-[11px] text-slate-300 font-mono">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-500 h-1.5 cursor-pointer"
      />
    </div>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-[11px] text-slate-400">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-24 bg-slate-800 border border-slate-600 focus:border-blue-500 rounded px-2 py-0.5 text-xs text-slate-200 outline-none text-right"
      />
    </div>
  );
}
