import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
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
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
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

  registerIpcHandlers(mainWindow);
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
