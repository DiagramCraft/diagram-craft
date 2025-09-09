import { app, BrowserWindow, Menu, shell } from 'electron';
import log from 'electron-log/main';
import { isDev, isMac, isPackaged } from './utils/platform';
import { initializeLogging } from './logging';
import { resolveAsset, resolveFile } from './utils/path';
import * as fs from 'node:fs';
import { menuHandlers } from './menu/menu';
import * as path from 'node:path';
import { Channels, registerIpcHandlers } from './ipc';
import { fileHandlers } from './file/file';
import { userHandlers } from './user/user';
import { autosaveHandlers } from './autosave/autosave';

initializeLogging();

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    ...(isMac()
      ? {
          titleBarStyle: isMac() ? 'hiddenInset' : 'default',
          trafficLightPosition: { x: 10, y: 15 }
        }
      : {}),
    show: false
  });

  const webAppUrl = isDev()
    ? 'http://localhost:5173'
    : `file://${resolveFile('$RESOURCE_ROOT/index.html')}`;

  log.info('Loading web resources from:', webAppUrl);
  mainWindow.loadURL(webAppUrl);

  if (isDev() && !isPackaged()) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.insertCSS(fs.readFileSync(resolveAsset('electron.css'), 'utf-8'));
};

app.whenReady().then(() => {
  log.info('Electron app is ready');

  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  registerIpcHandlers(fileHandlers, mainWindow!);
  registerIpcHandlers(menuHandlers, mainWindow!);
  registerIpcHandlers(userHandlers, mainWindow!);
  registerIpcHandlers(autosaveHandlers, mainWindow!);
});

app.on('window-all-closed', () => {
  app.quit();
});

// Handle recent document opening (macOS)
app.on('open-file', (event, path) => {
  event.preventDefault();
  log.info('Opening recent file:', path);

  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(Channels.FileRecentFileOpen, path);
  } else {
    // If no window exists, create one and then open the file
    createWindow();
    mainWindow?.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send(Channels.FileRecentFileOpen, path);
    });
  }
});
