import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import started from 'electron-squirrel-startup';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';
import { registerIpcHandlers } from './main/ipc';

if (started) app.quit();

// Pin userData to a stable name so it never moves when productName changes.
app.setPath('userData', path.join(app.getPath('appData'), 'openconduit'));

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

};

app.on('ready', () => {
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

  // Auto-update: resolve the best update URL after window creation so startup
  // isn't delayed. Tries the custom domain first; falls back to the direct
  // Worker URL if unreachable.
  if (app.isPackaged) {
    const version = app.getVersion();
    const channel = version.includes('alpha') ? 'alpha' : version.includes('beta') ? 'beta' : 'stable';
    const urlPath = `updates/${channel}/${process.platform}/${process.arch}`;
    const primary = `https://updates.openconduit.ai/${urlPath}`;
    const backup  = `https://openconduit-release-api.chumchal-account.workers.dev/${urlPath}`;
    const probe   = process.platform === 'darwin' ? 'RELEASES.json' : 'RELEASES';

    void (async () => {
      let baseUrl = backup;
      try {
        const res = await fetch(`${primary}/${probe}`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok || res.status === 204) baseUrl = primary;
      } catch { /* primary unreachable — use backup */ }

      updateElectronApp({
        updateSource: { type: UpdateSourceType.StaticStorage, baseUrl },
        updateInterval: '1 hour',
        notifyUser: true,
      });
    })();
  }
});
registerIpcHandlers();

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
