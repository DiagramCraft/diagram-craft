import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import { readFileSync, writeFileSync } from 'fs';
import log from 'electron-log/main';
import { isDev, isPackaged } from './mode';
import { initializeLogging } from './logging';
import { resolveAsset, resolveFile } from './path';
import * as fs from 'node:fs';
import { createMenuFrom } from './menu';
import * as path from 'node:path';

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
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
          trafficLightPosition: { x: 10, y: 15 }
        }
      : {}),
    show: false
  });

  let webAppUrl: string;

  if (isDev()) {
    webAppUrl = 'http://localhost:5173';
  } else {
    webAppUrl = `file://${resolveFile('$RESOURCE_ROOT/index.html')}`;
  }

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
  //createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  ipcMain.handle('fileOpen', async (_event, _action) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile']
      /*filters: [
        { name: 'Diagram Files', extensions: ['dcd'] },
        { name: 'All Files', extensions: ['*'] }
      ]*/
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      BrowserWindow.getFocusedWindow()?.setRepresentedFilename(filePath);
      app.addRecentDocument(filePath);
      return { url: filePath };
    }
    return undefined;
  });

  ipcMain.handle('fileLoad', async (_event, rawUrl) => {
    const url = resolveFile(rawUrl);

    try {
      const content = readFileSync(url, 'utf-8');
      return { url: url, content };
    } catch (error) {
      log.error('File load error:', error);
      return undefined;
    }
  });

  ipcMain.handle('fileSave', async (_event, _action, url, content) => {
    try {
      writeFileSync(url, content);
      return url;
    } catch (error) {
      log.error('File save error:', error);
      return undefined;
    }
  });

  ipcMain.handle('fileSaveAs', async (_event, _action, url, content) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow!, {
        defaultPath: url
        /*filters: [
          { name: 'Diagram Files', extensions: ['dcd'] },
          { name: 'All Files', extensions: ['*'] }
        ]*/
      });

      if (!result.canceled && result.filePath) {
        BrowserWindow.getFocusedWindow()?.setRepresentedFilename(result.filePath);
        app.addRecentDocument(result.filePath);
        writeFileSync(result.filePath, content);
        return result.filePath;
      }

      return undefined;
    } catch (error) {
      return undefined;
    }
  });

  ipcMain.handle('menu:set', async (_event, { items, keybindings }) => {
    createMenuFrom(items, keybindings, mainWindow!);
  });

  ipcMain.handle('menu:setState', async (_event, { id, enabled, checked }) => {
    const menuItem = Menu.getApplicationMenu()?.getMenuItemById(id);
    if (menuItem) {
      menuItem.enabled = enabled;
      menuItem.checked = checked;
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

// Handle recent document opening (macOS)
app.on('open-file', (event, path) => {
  event.preventDefault();
  log.info('Opening recent file:', path);

  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('recent-file-open', path);
  } else {
    // If no window exists, create one and then open the file
    createWindow();
    mainWindow?.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('recent-file-open', path);
    });
  }
});
