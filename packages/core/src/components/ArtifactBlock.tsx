import React, { useState, useEffect, useCallback, useMemo } from 'react';
import hljs from 'highlight.js';
import { useSavedFilesStore } from '../stores/filesStore';

const PREVIEWABLE = new Set(['html', 'svg', 'mermaid']);

const MIME_MAP: Record<string, string> = {
  html: 'text/html',
  svg: 'image/svg+xml',
  css: 'text/css',
  json: 'application/json',
  js: 'text/javascript',
  javascript: 'text/javascript',
  ts: 'text/plain',
  typescript: 'text/plain',
  mermaid: 'text/plain',
};

const EXT_MAP: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  mermaid: 'mmd',
  plaintext: 'txt',
};

interface Props {
  language: string;
  code: string;
  conversationId?: string;
}

export default function ArtifactBlock({ language, code, conversationId }: Props) {
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const { saveFile } = useSavedFilesStore();

  const highlighted = useMemo(() => {
    try {
      return hljs.highlight(code, { language }).value;
    } catch {
      try {
        return hljs.highlight(code, { language: 'plaintext' }).value;
      } catch {
        return code;
      }
    }
  }, [code, language]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [code]);

  const handleSave = useCallback(() => {
    const ext = EXT_MAP[language] ?? language;
    const mimeType = MIME_MAP[language] ?? 'text/plain';
    saveFile({
      name: `artifact.${ext}`,
      content: code,
      mimeType,
      size: new Blob([code]).size,
      conversationId,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [code, language, conversationId, saveFile]);

  const canPreview = PREVIEWABLE.has(language);

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-slate-700">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-slate-800 px-3 py-1.5 border-b border-slate-700" style={{ position: 'relative', zIndex: 1 }}>
        <span className="text-[11px] font-mono text-slate-500">{language}</span>
        <div className="flex items-center gap-2">
          {canPreview && (
            <button
              onClick={() => setPreview((p) => !p)}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                preview
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              {preview ? 'Code' : 'Preview'}
            </button>
          )}

          {/* Copy */}
          <button
            onClick={handleCopy}
            title="Copy code"
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
          >
            {copied ? (
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          {/* Save to files */}
          <button
            onClick={handleSave}
            title="Save to files panel"
            className={`p-1 rounded transition-colors ${
              saved
                ? 'text-green-400'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
            }`}
          >
            {saved ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Code or Preview */}
      {preview ? (
        <ArtifactPreview language={language} code={code} />
      ) : (
        <pre className="bg-slate-900 overflow-x-auto">
          <code
            className={`hljs language-${language} text-[12px] p-4 block font-mono leading-relaxed`}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      )}
    </div>
  );
}

function ArtifactPreview({ language, code }: { language: string; code: string }) {
  if (language === 'mermaid') return <MermaidPreview code={code} />;

  const srcDoc =
    language === 'svg'
      ? `<!DOCTYPE html><html><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;padding:16px;min-height:100vh">${code}</body></html>`
      : code;

  return (
    <iframe
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className="w-full bg-white"
      style={{ height: '300px', border: 'none' }}
      title="Artifact preview"
    />
  );
}

function MermaidPreview({ code }: { code: string }) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSvgContent(null);

    import('mermaid').then(({ default: mermaid }) => {
      if (cancelled) return;
      mermaid.initialize({ startOnLoad: false, theme: 'dark', themeVariables: { background: 'transparent', primaryTextColor: '#e2e8f0' } });
      const id = `mermaid-${Math.random().toString(36).slice(2)}`;
      mermaid
        .render(id, code)
        .then(({ svg }) => {
          if (!cancelled) {
            setSvgContent(svg);
            setLoading(false);
          }
        })
        .catch((e: Error) => {
          if (!cancelled) {
            setError(e.message);
            setLoading(false);
          }
        });
    }).catch((e: Error) => {
      if (!cancelled) {
        setError(e.message);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="p-4 text-xs text-red-400 bg-slate-950">
        <span className="font-medium">Diagram error:</span> {error}
      </div>
    );
  }

  if (loading || !svgContent) {
    return (
      <div className="bg-slate-950 flex items-center justify-center min-h-[120px] p-4">
        <span className="text-[11px] text-slate-500 animate-pulse">Rendering…</span>
      </div>
    );
  }

  return (
    <div
      className="bg-slate-950 overflow-auto p-4 flex items-center justify-center"
      style={{ minHeight: '120px', maxHeight: '400px' }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
