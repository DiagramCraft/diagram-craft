import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import type { MenuEntry } from '@diagram-craft/electron-client-api/electron-api';

const isDev = process.argv.includes('--dev');

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
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
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

  const webAppUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../../../../main/dist/index.html')}`;

  mainWindow.loadURL(webAppUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
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
};

const processMenuEntry = (entry: MenuEntry): Electron.MenuItemConstructorOptions => {
  const e: Electron.MenuItemConstructorOptions = {
    id: entry.id,
    label: entry.label,
    submenu: entry.submenu ? entry.submenu.map(processMenuEntry) : undefined
  };

  if (entry.type === 'action') {
    e.click = () => {
      mainWindow?.webContents.send('menu-action', entry.action);
    };
  } else if (entry.type === 'toggle') {
    e.click = () => {
      mainWindow?.webContents.send('menu-action', entry.action);
    };
    e.type = 'checkbox';
  } else if (entry.type === 'separator') {
    e.type = 'separator';
  }

  return e;
};

const createMenuFrom = (entries: MenuEntry[]): void => {
  const template: Electron.MenuItemConstructorOptions[] = [];

  for (const topLevel of entries) {
    template.push(processMenuEntry(topLevel));
  }

  if (process.platform === 'win32') {
    (template.find(e => e.id === 'file')!.submenu! as Electron.MenuItemConstructorOptions[]).push(
      ...[{ type: 'separator' as const }, { role: 'quit' as const }]
    );
  }

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });

    template.push({
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

app.whenReady().then(() => {
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
      return { url: result.filePaths[0] };
    }
    return undefined;
  });

  ipcMain.handle('fileLoad', async (_event, url) => {
    try {
      const content = readFileSync(url, 'utf-8');
      return { url: url, content };
    } catch (error) {
      console.log(error);
      return undefined;
    }
  });

  ipcMain.handle('fileSave', async (_event, _action, url, content) => {
    try {
      writeFileSync(url, content);
      return url;
    } catch (error) {
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
        writeFileSync(result.filePath, content);
        return result.filePath;
      }

      return undefined;
    } catch (error) {
      return undefined;
    }
  });

  ipcMain.handle('menu:set', async (_event, entries) => {
    createMenuFrom(entries);
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
