import './index.css';
import { initService } from '@openconduit/core/services';
import type { AppService } from '@openconduit/core/services/appService';
import { debugConsole } from '@openconduit/core';
import type { DebugLevel, LogCategory } from '@openconduit/core';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '@openconduit/core/App';

// Wire the Electron IPC bridge to the AppService interface.
// This must run before React renders so stores can access the service.
initService(window.api as AppService);

// Forward main-process log entries to the in-app debug console panel.
window.api.log.onConsoleEntry((entry) => {
  const fn = debugConsole[entry.level as DebugLevel] ?? debugConsole.log;
  fn(entry.message, entry.data, entry.category as LogCategory | undefined);
});

// ── Global renderer error capture ────────────────────────────────────────────
// Catches errors that escape React (setTimeout, IPC callbacks, etc.) and
// writes them to the debug log so they show up in Settings → Logs.
function logRendererError(message: string, stack?: string) {
  try {
    window.api.log.write({ ts: Date.now(), level: 'error', message, data: { stack }, category: 'renderer' });
  } catch { /* log failure must never throw */ }
}

window.addEventListener('error', (e) => {
  logRendererError(`Uncaught error: ${e.message}`, e.error?.stack);
});
window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason instanceof Error ? e.reason.message : String(e.reason);
  logRendererError(`Unhandled rejection: ${msg}`, e.reason?.stack);
});

// ── React Error Boundary ──────────────────────────────────────────────────────
// Without this, any render-time throw silently unmounts the whole tree → white screen.
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logRendererError(
      `React boundary caught: ${error.message}`,
      (error.stack ?? '') + '\n\nComponent stack:' + info.componentStack,
    );
  }

  reload() {
    window.location.reload();
  }

  render() {
    if (this.state.error) {
      const err = this.state.error;
      return React.createElement(
        'div',
        {
          style: {
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'sans-serif', gap: '16px',
            padding: '32px', boxSizing: 'border-box',
          },
        },
        React.createElement('div', { style: { fontSize: '32px' } }, '⚠️'),
        React.createElement('h2', { style: { margin: 0, fontSize: '18px', fontWeight: 600 } }, 'Something went wrong'),
        React.createElement(
          'p',
          { style: { margin: 0, fontSize: '13px', color: '#94a3b8', maxWidth: '480px', textAlign: 'center' } },
          err.message,
        ),
        React.createElement(
          'button',
          {
            onClick: this.reload,
            style: {
              marginTop: '8px', padding: '8px 20px', background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer',
            },
          },
          'Reload',
        ),
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(AppErrorBoundary, null, React.createElement(App)),
  ),
);
