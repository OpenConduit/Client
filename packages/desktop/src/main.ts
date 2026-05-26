import { app, BrowserWindow, session, autoUpdater } from 'electron';
import * as Sentry from '@sentry/electron/main';
import { sentryMinidumpIntegration } from '@sentry/electron/main';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import started from 'electron-squirrel-startup';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';
import { registerIpcHandlers, fireTelemetrySessionStart, fireTelemetryCrash } from './main/ipc';
import { getSettings, getMachineId } from './main/store/settings';
import { destroyBrowserWindow } from './main/webtools/browser';

if (started) app.quit();

// Initialise Sentry before `app.ready` as required by @sentry/electron.
// The minidump (Crashpad) integration is excluded here and added explicitly
// inside app.on('ready') — calling crashReporter.start() before the framework
// is fully initialised conflicts with Chromium's exception handler on Apple Silicon.
Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  release: `openconduit@${app.getVersion()}`,
  environment: app.isPackaged ? 'production' : 'development',
  // Exclude the minidump integration — it is registered after app.ready below.
  integrations: (defaults) => defaults.filter((i) => i.name !== 'SentryMinidump'),
  initialScope: {
    tags: {
      appVersion:  app.getVersion(),
      platform:    process.platform,
      arch:        process.arch,
      electronV:   process.versions.electron,
      nodeV:       process.versions.node,
      v8V:         process.versions.v8,
    },
  },
  // Respect the user's crash-reporting opt-out. beforeSend runs at event-send
  // time (not at init time) so getSettings() is safe to call here — userData
  // is always set before any event can be generated.
  beforeSend(event) {
    try {
      if (getSettings().telemetry?.crashReports === false) return null;
    } catch { /* store not ready yet — allow the event through */ }
    return event;
  },
});

// Pin userData to a stable name so it never moves when productName changes.
app.setPath('userData', path.join(app.getPath('appData'), 'openconduit'));

// Identify this device in Sentry. getMachineId() requires userData to be set first
// (it reads from electron-store). The ID is a random UUID generated on first launch
// and is never tied to any personal information.
Sentry.setUser({ id: getMachineId() });

// Register openconduit:// as a deep-link protocol (e.g. openconduit://join?roomId=xxx)
app.setAsDefaultProtocolClient('openconduit');

// Ensure only one instance handles deep links on Windows/Linux.
// On macOS the OS enforces single-instance and fires 'open-url' instead.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function handleDeepLink(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'join') {
      const roomId = parsed.searchParams.get('roomId');
      if (!roomId) return;
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('collab:join-invite', roomId);
        win.focus();
      }
    }
  } catch { /* malformed URL — ignore */ }
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

const createWindow = () => {
  // When packaged, icons are copied to Contents/Resources/icons/ via extraResources.
  // Native OS APIs (e.g. dock.setIcon) cannot read from inside an asar archive,
  // so they must live outside it.
  const iconsDir = app.isPackaged
    ? path.join(process.resourcesPath, 'icons')
    : path.join(__dirname, '../../icons');

  const iconPath =
    process.platform === 'darwin'
      ? path.join(iconsDir, 'icon.icns')
      : process.platform === 'win32'
        ? path.join(iconsDir, 'favicon.ico')
        : path.join(iconsDir, 'icon-512x512.png');

  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(iconsDir, 'icon-512x512.png'));
  }

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false, // needed so preload can use Node APIs (MCP stdio)
      nodeIntegration: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Crash-loop guard: track recent renderer crash timestamps.
  // If the renderer crashes 3+ times within 15 seconds, stop reloading and
  // show a static error page so the user isn't stuck in an infinite loop.
  const CRASH_WINDOW_MS = 15_000;
  const CRASH_LOOP_THRESHOLD = 3;
  const rendererCrashTimes: number[] = [];

  // Reload automatically when the renderer crashes instead of staying white.
  // Skips clean exits (e.g. deliberate reload / navigation) to avoid loops.
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit') return;

    const err = new Error(`Renderer process gone (${details.reason}, exit ${details.exitCode})`);
    err.name = 'RendererCrash';
    void fireTelemetryCrash(err, {
      crashDumpsDir: app.getPath('crashDumps'),
      reason: details.reason,
      exitCode: details.exitCode,
    });

    const now = Date.now();
    rendererCrashTimes.push(now);
    // Evict timestamps outside the window
    while (rendererCrashTimes.length > 0 && rendererCrashTimes[0] < now - CRASH_WINDOW_MS) {
      rendererCrashTimes.shift();
    }

    if (rendererCrashTimes.length >= CRASH_LOOP_THRESHOLD) {
      // Crash loop detected — load a static fallback instead of reloading.
      // The user can still quit or submit a bug report from this page.
      if (!mainWindow.isDestroyed()) {
        mainWindow.loadURL(
          'data:text/html,' + encodeURIComponent([
            '<!DOCTYPE html><html><head>',
            '<meta charset="utf-8">',
            '<style>body{margin:0;display:flex;flex-direction:column;align-items:center;',
            'justify-content:center;height:100vh;background:#0f172a;color:#f8fafc;',
            'font-family:sans-serif;gap:16px;padding:32px;box-sizing:border-box}',
            'h2{margin:0;font-size:18px}p{margin:0;font-size:13px;color:#94a3b8;',
            'max-width:480px;text-align:center}',
            'button{margin-top:8px;padding:8px 20px;background:#3b82f6;color:#fff;',
            'border:none;border-radius:8px;font-size:14px;cursor:pointer}',
            '</style></head><body>',
            '<div style="font-size:32px">⚠️</div>',
            '<h2>OpenConduit crashed repeatedly</h2>',
            '<p>The app crashed ' + CRASH_LOOP_THRESHOLD + ' times in ' + (CRASH_WINDOW_MS / 1000) + ' seconds. ',
            'Please restart the application. If it keeps happening, use ',
            '<strong>Settings → Feedback</strong> to report the issue.</p>',
            '<button onclick="window.location.reload()">Try reloading anyway</button>',
            '</body></html>',
          ].join('')),
        );
      }
      return;
    }

    setTimeout(() => {
      if (mainWindow.isDestroyed()) return;
      if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      } else {
        mainWindow.loadFile(
          path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
        );
      }
    }, 500);
  });

};

app.on('ready', () => {
  // Register the Crashpad/minidump integration now that the framework is fully
  // initialised. On Apple Silicon, crashReporter.start() must not be called
  // before app.ready or it conflicts with Chromium's own exception handling.
  Sentry.addIntegration(sentryMinidumpIntegration());
  // In production the renderer loads via file://, so absolute paths like
  // /app-icon.png resolve to the filesystem root instead of the bundled asset
  // directory. Intercept those requests and redirect to the correct path.
  if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const assetDir = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['file://*'] },
      (details, callback) => {
        if (details.url.endsWith('/app-icon.png')) {
          callback({ redirectURL: pathToFileURL(path.join(assetDir, 'app-icon.png')).href });
        } else {
          callback({});
        }
      }
    );
  }
  createWindow();

  // Auto-update setup after window creation so startup isn't delayed.
  if (app.isPackaged) {
    const version = app.getVersion();
    const channel = version.includes('alpha') ? 'alpha' : version.includes('beta') ? 'beta' : 'stable';
    const urlPath = `updates/${channel}/${process.platform}/${process.arch}`;
    const baseUrl = `https://updates.openconduit.ai/${urlPath}`;
    const updateMode = getSettings().updateMode ?? 'automatic';

    // manual mode: skip the auto-updater entirely; user checks via Settings
    if (updateMode === 'manual') return;

    // download-only: download silently, then broadcast to renderer when ready
    // automatic:     download silently and show OS restart dialog when ready
    const notifyUser = updateMode === 'automatic';

    updateElectronApp({
      updateSource: { type: UpdateSourceType.StaticStorage, baseUrl },
      updateInterval: '1 hour',
      notifyUser,
    });

    // For download-only mode, broadcast the 'update:downloaded' event so the
    // Updates tab can show the "Restart & Install" banner. Also broadcast
    // 'update:downloading' when Squirrel starts the download so the progress
    // bar appears if Settings is open.
    if (updateMode === 'download-only') {
      const broadcast = (channel: string) => {
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send(channel);
        }
      };
      autoUpdater.once('update-available', () => broadcast('update:downloading'));
      autoUpdater.once('update-downloaded', () => broadcast('update:downloaded'));
      autoUpdater.once('error', () => { /* silent for background downloads */ });
    }
  }
});
registerIpcHandlers();

// Fire anonymous session-start telemetry once the app is fully ready.
// This is a no-op if the user has not opted in.
app.whenReady().then((): void => { void fireTelemetrySessionStart(); });

// Catch uncaught main-process errors and report them if crash reports are enabled.
process.on('uncaughtException', (err) => { void fireTelemetryCrash(err); });
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  void fireTelemetryCrash(err);
});

// macOS: deep link fired while app is already running
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Windows / Linux: second instance was launched with the URL in argv
app.on('second-instance', (_event, argv) => {
  const url = argv.find((arg) => arg.startsWith('openconduit://'));
  if (url) handleDeepLink(url);

  // Bring existing window to front
  const [win] = BrowserWindow.getAllWindows();
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

// macOS: deep link when app is launched cold (URL in process.argv)
app.on('will-finish-launching', () => {
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });
});

app.on('window-all-closed', () => {
  destroyBrowserWindow();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
