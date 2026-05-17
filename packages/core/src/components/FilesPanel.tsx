import React, { useState, useEffect } from 'react';
import { useUiStore } from '../stores/uiStore';
import { useSavedFilesStore, type SavedFile } from '../stores/filesStore';

// ─── Preview helpers ──────────────────────────────────────────────────────────

function isPreviewable(file: SavedFile): boolean {
  return (
    file.mimeType === 'text/html' ||
    file.mimeType === 'image/svg+xml' ||
    file.name.endsWith('.mmd')
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

    import('mermaid')
      .then(({ default: mermaid }) => {
        if (cancelled) return;
        mermaid.initialize({ startOnLoad: false, theme: 'dark', themeVariables: { background: 'transparent', primaryTextColor: '#e2e8f0' } });
        const id = `mermaid-fp-${Math.random().toString(36).slice(2)}`;
        mermaid
          .render(id, code)
          .then(({ svg }) => {
            if (!cancelled) { setSvgContent(svg); setLoading(false); }
          })
          .catch((e: Error) => {
            if (!cancelled) { setError(e.message); setLoading(false); }
          });
      })
      .catch((e: Error) => {
        if (!cancelled) { setError(e.message); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div className="p-4 text-xs text-red-400 bg-slate-950 flex-1">
        <span className="font-medium">Diagram error:</span> {error}
      </div>
    );
  }

  if (loading || !svgContent) {
    return (
      <div className="bg-slate-950 flex items-center justify-center" style={{ width: '100%', height: '100%' }}>
        <span className="text-[11px] text-slate-500 animate-pulse">Rendering…</span>
      </div>
    );
  }

  return (
    <div
      style={{ width: '100%', height: '100%', background: '#0f172a', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}

function FilePreview({ file }: { file: SavedFile }) {
  if (file.name.endsWith('.mmd')) return <MermaidPreview code={file.content} />;

  const srcDoc =
    file.mimeType === 'image/svg+xml'
      ? `<!DOCTYPE html><html><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;padding:16px;min-height:100vh">${file.content}</body></html>`
      : file.content;

  return (
    <iframe
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      title={file.name}
    />
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return isToday
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function typeBadge(mimeType: string): string {
  if (mimeType === 'text/html') return 'HTML';
  if (mimeType === 'image/svg+xml') return 'SVG';
  if (mimeType.includes('javascript')) return 'JS';
  if (mimeType === 'text/css') return 'CSS';
  if (mimeType === 'application/json') return 'JSON';
  return mimeType.split('/').pop()?.toUpperCase().slice(0, 4) ?? 'FILE';
}

function downloadFile(file: SavedFile) {
  const blob = new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

interface FileRowProps {
  file: SavedFile;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onPreview: (file: SavedFile) => void;
}

function FileRow({ file, onDelete, onRename, onPreview }: FileRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.name);
  const [copied, setCopied] = useState(false);

  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== file.name) onRename(file.id, trimmed);
    else setDraft(file.name);
    setEditing(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(file.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="px-3 py-2.5 border-b border-slate-800 hover:bg-slate-800/50 transition-colors group">
      <div className="flex items-start gap-2">
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 uppercase tracking-wide flex-shrink-0 mt-0.5">
          {typeBadge(file.mimeType)}
        </span>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') { setDraft(file.name); setEditing(false); }
              }}
              className="w-full bg-slate-700 text-slate-100 text-xs rounded px-1.5 py-0.5 outline-none"
            />
          ) : (
            <button
              onClick={() => { setDraft(file.name); setEditing(true); }}
              className="text-xs text-slate-200 hover:text-white truncate text-left w-full block"
              title="Click to rename"
            >
              {file.name}
            </button>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-600">{formatDate(file.savedAt)}</span>
            <span className="text-[10px] text-slate-700">·</span>
            <span className="text-[10px] text-slate-600">{formatBytes(file.size)}</span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {/* Preview */}
          {isPreviewable(file) && (
            <button
              onClick={() => onPreview(file)}
              title="Preview file"
              className="p-1 rounded text-slate-500 hover:text-blue-400 hover:bg-slate-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          )}

          {/* Copy */}
          <button
            onClick={handleCopy}
            title="Copy content"
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

          {/* Download */}
          <button
            onClick={() => downloadFile(file)}
            title="Download file"
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(file.id)}
            title="Delete file"
            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FilesPanel() {
  const { showFilesPanel, setShowFilesPanel } = useUiStore();
  const { files, deleteFile, renameFile } = useSavedFilesStore();
  const [previewFile, setPreviewFile] = useState<SavedFile | null>(null);

  if (!showFilesPanel) return null;

  return (
    <div
      className={`absolute inset-y-0 right-0 bg-slate-900 border-l border-slate-700 flex flex-col z-40 shadow-2xl ${previewFile ? 'w-[520px]' : 'w-72'}`}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {/* Header */}
      {previewFile ? (
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-700 flex-shrink-0" style={{ position: 'relative', zIndex: 10 }}>
          <button
            type="button"
            onClick={() => setPreviewFile(null)}
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
            title="Back to files"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs text-slate-400 truncate flex-1">{previewFile.name}</span>
          <button
            type="button"
            onClick={() => setShowFilesPanel(false)}
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="text-sm font-medium text-slate-200">Files</span>
          {files.length > 0 && (
            <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
              {files.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowFilesPanel(false)}
          className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      )}

      {/* Preview content */}
      {previewFile && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <FilePreview file={previewFile} />
        </div>
      )}

      {/* File list */}
      {!previewFile && <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="p-6 flex flex-col items-center text-center">
            <svg className="w-8 h-8 text-slate-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-xs text-slate-500">No saved files yet</p>
            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
              Use the save button on any code block to store it here
            </p>
          </div>
        ) : (
          files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              onDelete={deleteFile}
              onRename={renameFile}
              onPreview={setPreviewFile}
            />
          ))
        )}
      </div>}
    </div>
  );
}
