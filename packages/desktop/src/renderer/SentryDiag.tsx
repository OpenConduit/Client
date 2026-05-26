/**
 * SentryDiag — hidden diagnostics overlay for verifying Sentry integration.
 *
 * Toggle: Cmd+Shift+Option+D (macOS) / Ctrl+Alt+Shift+D (Windows/Linux)
 *
 * Shows:
 *  - Whether a DSN is configured (first/last chars only, never the full URL)
 *  - Whether the Sentry client initialised successfully
 *  - Whether the preload IPC bridge is present (window.__SENTRY_IPC__)
 *  - A button that fires a test captureMessage and returns the event ID
 */

import React, { useEffect, useState, useCallback } from 'react';
import * as Sentry from '@sentry/electron/renderer';

declare const __SENTRY_DSN__: string;

function maskDsn(dsn: string): string {
  try {
    const url = new URL(dsn);
    // Show scheme + first 6 chars of key + *** + host, hide project ID
    const key = url.username;
    return `${url.protocol}//${key.slice(0, 6)}***@${url.host}/***`;
  } catch {
    return dsn.slice(0, 12) + '***';
  }
}

interface Row { label: string; ok: boolean; detail?: string }

function StatusRow({ label, ok, detail }: Row) {
  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, color: ok ? '#4ade80' : '#f87171' }}>{ok ? '✓' : '✗'}</span>
        <span style={{ fontSize: 13, color: '#e2e8f0' }}>{label}</span>
      </div>
      {detail && (
        <div style={{
          fontSize: 11, color: '#94a3b8', fontFamily: 'monospace',
          marginTop: 2, marginLeft: 22,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{detail}</div>
      )}
    </div>
  );
}

export function SentryDiag() {
  const [visible, setVisible] = useState(false);
  const [testResult, setTestResult] = useState<{ id: string | null; ts: number } | null>(null);
  const [sending, setSending] = useState(false);

  // Cmd+Shift+Option+D (mac) / Ctrl+Alt+Shift+D (win/linux)
  // Use e.code (physical key) not e.key — Option+D on macOS produces '∂', not 'd'.
  // Use navigator.userAgent — process.platform is not available in the renderer.
  const isMac = navigator.userAgent.includes('Macintosh');
  const handleKey = useCallback((e: KeyboardEvent) => {
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && e.shiftKey && e.altKey && e.code === 'KeyD') {
      e.preventDefault();
      setVisible(v => !v);
      setTestResult(null);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (!visible) return null;

  const dsn = __SENTRY_DSN__;
  const hasDsn = !!dsn;
  const client = Sentry.getClient();
  const clientOk = !!client;
  // The preload bridge writes window.__SENTRY_IPC__ when hookupIpc() runs
  const bridgeOk = typeof (window as { __SENTRY_IPC__?: unknown }).__SENTRY_IPC__ === 'object';

  const sendTest = async () => {
    setSending(true);
    setTestResult(null);
    const id = Sentry.captureMessage('[OpenConduit] Sentry diagnostics test', 'info');
    // Give the IPC bridge ~2 s to forward the event to the main process
    await new Promise(r => setTimeout(r, 2000));
    setTestResult({ id: id ?? null, ts: Date.now() });
    setSending(false);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) setVisible(false); }}
    >
      <div style={{
        background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
        padding: '24px 28px', width: 420, fontFamily: 'sans-serif', color: '#f8fafc',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Sentry Diagnostics</h3>
          <button
            onClick={() => setVisible(false)}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, padding: 0 }}
          >×</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <StatusRow label="DSN configured"      ok={hasDsn}  detail={hasDsn ? maskDsn(dsn) : '(not set — set SENTRY_DSN at build time)'} />
          <StatusRow label="Client initialised"  ok={clientOk} />
          <StatusRow label="Preload IPC bridge"  ok={bridgeOk} />
        </div>

        <button
          onClick={sendTest}
          disabled={sending || !clientOk}
          style={{
            width: '100%', padding: '8px 0', background: clientOk ? '#3b82f6' : '#334155',
            color: clientOk ? '#fff' : '#64748b', border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 500, cursor: clientOk ? 'pointer' : 'not-allowed',
          }}
        >
          {sending ? 'Sending…' : 'Send test event to Sentry'}
        </button>

        {testResult && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: '#0f172a', borderRadius: 6 }}>
            {testResult.id
              ? <>
                  <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>Event sent ✓</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2, wordBreak: 'break-all' }}>
                    ID: {testResult.id}
                  </div>
                </>
              : <div style={{ fontSize: 12, color: '#f87171' }}>No event ID — check DSN and network.</div>
            }
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 11, color: '#475569', textAlign: 'center' }}>
          {navigator.userAgent.includes('Macintosh') ? '⌘⇧⌥D' : 'Ctrl+Alt+Shift+D'} to toggle
        </div>
      </div>
    </div>
  );
}
