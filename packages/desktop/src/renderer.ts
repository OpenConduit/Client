import './index.css';
import { initService } from '@openconduit/core/services';
import type { AppService } from '@openconduit/core/services/appService';
import { debugConsole } from '@openconduit/core';
import type { DebugLevel } from '@openconduit/core';
import type { LogCategory } from '@openconduit/core';
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

createRoot(document.getElementById('root')!).render(
  React.createElement(React.StrictMode, null, React.createElement(App)),
);
