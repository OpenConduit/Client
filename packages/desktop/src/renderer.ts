import './index.css';
import { initService } from '@openconduit/core/services';
import type { AppService } from '@openconduit/core/services/appService';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '@openconduit/core/App';

// Wire the Electron IPC bridge to the AppService interface.
// This must run before React renders so stores can access the service.
initService(window.api as AppService);

createRoot(document.getElementById('root')!).render(
  React.createElement(React.StrictMode, null, React.createElement(App)),
);
